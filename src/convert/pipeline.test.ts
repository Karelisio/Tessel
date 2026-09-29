import { describe, expect, it } from 'vitest';
import { TRANSPARENT, countByColor } from '@/content/grid';
import { assignDithered } from './assign';
import { detectBackground } from './background';
import { mergeSmallRegions, minRegionSize } from './cleanup';
import { srgb8ToOklab } from './color';
import { convertPixels, DEFAULT_PARAMS, type ConvertParams } from './pipeline';
import { resampleToCells } from './resample';

function image(w: number, h: number, fill: (x: number, y: number) => [number, number, number]) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set([...fill(x, y), 255], (y * w + x) * 4);
  return px;
}

const params = (over: Partial<ConvertParams> = {}): ConvertParams => ({
  ...DEFAULT_PARAMS,
  width: 40,
  height: 40,
  sharpen: 0,
  saturation: 0,
  ...over,
});

/** Disque rouge sur fond bleu ciel, avec un bruit léger de « photo ». */
function disc(w = 200, h = 200) {
  let s = 7;
  const noise = () => {
    s = (s * 48271) % 2147483647;
    return Math.round((s / 2147483647 - 0.5) * 16);
  };
  return image(w, h, (x, y) => {
    const inside = (x - w / 2) ** 2 + (y - h / 2) ** 2 < (w * 0.3) ** 2;
    const n = noise();
    return inside ? [210 + n, 40 + n, 50 + n] : [150 + n, 200 + n, 240 + n];
  });
}

describe('pipeline de conversion', () => {
  it('produit une grille valide, aux bonnes dimensions', () => {
    const { grid, stats } = convertPixels(disc(), 200, 200, params({ width: 50, height: 30, colors: 8 }));
    expect(grid.width).toBe(50);
    expect(grid.height).toBe(30);
    expect(grid.palette.length).toBe(stats.colors);
    expect(stats.colors).toBeLessThanOrEqual(8);
    expect(stats.colors).toBeGreaterThanOrEqual(2);
  });

  it('est déterministe', () => {
    const a = convertPixels(disc(), 200, 200, params({ colors: 16 }));
    const b = convertPixels(disc(), 200, 200, params({ colors: 16 }));
    expect(a.grid.cells).toEqual(b.grid.cells);
    expect(a.grid.palette).toEqual(b.grid.palette);
  });

  it('le bruit de la photo ne crée pas de cases isolées', () => {
    const { grid } = convertPixels(disc(), 200, 200, params({ colors: 12, cleanup: 0.5 }));
    const w = grid.width;
    let isolated = 0;
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < w; x++) {
        const c = grid.cells[y * w + x];
        let same = false;
        for (let dy = -1; dy <= 1 && !same; dy++)
          for (let dx = -1; dx <= 1 && !same; dx++) {
            if ((dx || dy) && grid.cells[(y + dy) * w + x + dx] === c && x + dx >= 0 && x + dx < w)
              same = true;
          }
        if (!same) isolated++;
      }
    expect(isolated).toBe(0);
  });

  it('supprime un fond uni et garde le sujet', () => {
    const { grid, stats } = convertPixels(disc(), 200, 200, params({ removeBackground: true }));
    expect(stats.backgroundFound).toBe(true);
    expect(grid.cells[0]).toBe(TRANSPARENT);
    expect(grid.cells[20 * 40 + 20]).not.toBe(TRANSPARENT);
    // le disque couvre ~28 % de l'image
    expect(stats.transparent / (40 * 40)).toBeGreaterThan(0.6);
  });

  it('ne supprime rien quand le bord n’est pas uni', () => {
    const rainbow = image(100, 100, (x, y) => [(x * 7) % 256, (y * 11) % 256, (x * y) % 256]);
    const img = resampleToCells(rainbow, 100, 100, 30, 30);
    expect(detectBackground(img, 0.4).found).toBe(false);
  });

  it('respecte les pixels transparents d’un PNG', () => {
    const px = disc(100, 100);
    for (let i = 0; i < 100 * 100; i++) if (i % 100 < 50) px[i * 4 + 3] = 0;
    const { grid } = convertPixels(px, 100, 100, params({ width: 20, height: 20 }));
    expect(grid.cells[0]).toBe(TRANSPARENT);
    expect(grid.cells[19]).not.toBe(TRANSPARENT);
  });

  it('dégradé : le tramage conserve la couleur moyenne', () => {
    const w = 64;
    const px = image(w, 8, (x) => {
      const v = Math.round((x / (w - 1)) * 255);
      return [v, v, v];
    });
    const img = resampleToCells(px, w, 8, w, 8);
    const include = new Uint8Array(w * 8).fill(1);
    const black = srgb8ToOklab(0, 0, 0);
    const white = srgb8ToOklab(255, 255, 255);
    const pal = new Float32Array([...black, ...white]);
    const cells = assignDithered(img.lab, include, w, 8, pal, 1);
    // moitié gauche majoritairement noire, moitié droite majoritairement blanche, milieu mélangé
    const whiteShare = (x0: number, x1: number) => {
      let n = 0;
      let t = 0;
      for (let y = 0; y < 8; y++)
        for (let x = x0; x < x1; x++) {
          t++;
          if (cells[y * w + x] === 1) n++;
        }
      return n / t;
    };
    expect(whiteShare(0, 8)).toBeLessThan(0.15);
    expect(whiteShare(56, 64)).toBeGreaterThan(0.85);
    expect(whiteShare(28, 36)).toBeGreaterThan(0.2);
    expect(whiteShare(28, 36)).toBeLessThan(0.8);
  });

  it('fusion des îlots : préserve les lignes diagonales fines', () => {
    const w = 10;
    const cells = new Uint8Array(w * w);
    for (let i = 0; i < w; i++) cells[i * w + i] = 1; // diagonale de 10 cases
    cells[5] = 2; // case isolée
    const lab = new Float32Array(w * w * 3);
    const pal = new Float32Array([0.2, 0, 0, 0.8, 0, 0, 0.5, 0.1, 0]);
    mergeSmallRegions(cells, w, w, lab, pal, minRegionSize(0.5));
    expect(cells[5]).toBe(0);
    for (let i = 0; i < w; i++) expect(cells[i * w + i]).toBe(1);
  });

  it('300×300 en 64 couleurs en un temps raisonnable', () => {
    const big = disc(900, 900);
    const t0 = performance.now();
    const { grid } = convertPixels(
      big,
      900,
      900,
      params({ width: 300, height: 300, colors: 64, mergeDistance: 0 }),
    );
    const ms = performance.now() - t0;
    expect(countByColor(grid).length).toBeLessThanOrEqual(64);
    expect(ms).toBeLessThan(4000);
  });
});
