import { describe, expect, it } from 'vitest';
import { applyAdjustments, NEUTRAL } from './adjust';
import { oklabToSrgb8, srgb8ToOklab } from './color';
import { gridSizeFor, resampleToCells } from './resample';

function image(w: number, h: number, fill: (x: number, y: number) => [number, number, number, number]) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set(fill(x, y), (y * w + x) * 4);
  return px;
}

function rgbAt(lab: Float32Array, i: number) {
  return oklabToSrgb8(lab[i * 3] ?? 0, lab[i * 3 + 1] ?? 0, lab[i * 3 + 2] ?? 0);
}

describe('rééchantillonnage', () => {
  it('une image unie donne des cases unies', () => {
    const img = resampleToCells(
      image(40, 30, () => [200, 120, 40, 255]),
      40,
      30,
      7,
      5,
    );
    for (let i = 0; i < 35; i++) expect(rgbAt(img.lab, i)).toEqual([200, 120, 40]);
  });

  it('moyenne exacte de blocs, en lumière linéaire', () => {
    // damier noir/blanc 2×2 → gris moyen en lumière linéaire (188 en sRGB, pas 128)
    const img = resampleToCells(
      image(4, 4, (x, y) => ((x + y) % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255])),
      4,
      4,
      2,
      2,
    );
    for (let i = 0; i < 4; i++) {
      const [r] = rgbAt(img.lab, i);
      expect(r).toBeGreaterThanOrEqual(187);
      expect(r).toBeLessThanOrEqual(189);
    }
  });

  it('respecte le recadrage et les bords fractionnaires', () => {
    const px = image(10, 10, (x) => (x < 5 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
    const right = resampleToCells(px, 10, 10, 2, 2, { x: 5, y: 0, w: 5, h: 10 });
    expect(rgbAt(right.lab, 0)).toEqual([0, 0, 255]);
    const half = resampleToCells(px, 10, 10, 1, 1, { x: 4.5, y: 0, w: 1, h: 10 });
    const [r, , b] = rgbAt(half.lab, 0);
    expect(r).toBeGreaterThan(150);
    expect(b).toBeGreaterThan(150);
  });

  it('suit la transparence sans assombrir les bords (alpha prémultiplié)', () => {
    const px = image(4, 2, (x) => (x < 2 ? [255, 0, 0, 255] : [0, 0, 0, 0]));
    const img = resampleToCells(px, 4, 2, 1, 1);
    expect(img.alpha[0]).toBeCloseTo(0.5, 5);
    expect(rgbAt(img.lab, 0)).toEqual([255, 0, 0]);
  });

  it('agrandit une image plus petite que la grille', () => {
    const img = resampleToCells(
      image(2, 1, (x) => (x ? [0, 255, 0, 255] : [255, 0, 0, 255])),
      2,
      1,
      4,
      2,
    );
    expect(rgbAt(img.lab, 0)).toEqual([255, 0, 0]);
    expect(rgbAt(img.lab, 3)).toEqual([0, 255, 0]);
  });

  it('dimensions de grille selon le format', () => {
    expect(gridSizeFor(1.5, 120)).toEqual({ width: 120, height: 80 });
    expect(gridSizeFor(0.5, 100)).toEqual({ width: 50, height: 100 });
    expect(gridSizeFor(1, 999)).toEqual({ width: 300, height: 300 });
  });
});

describe('réglages', () => {
  const cell = (r: number, g: number, b: number) => {
    const lab = new Float32Array(srgb8ToOklab(r, g, b));
    return { width: 1, height: 1, lab, alpha: new Float32Array([1]) };
  };

  it('neutres : ne changent rien', () => {
    const img = cell(120, 80, 200);
    applyAdjustments(img, NEUTRAL);
    expect(rgbAt(img.lab, 0)).toEqual([120, 80, 200]);
  });

  it('luminosité sans écrêter le noir ni le blanc', () => {
    const black = cell(0, 0, 0);
    const white = cell(255, 255, 255);
    const mid = cell(100, 100, 100);
    for (const c of [black, white, mid]) applyAdjustments(c, { ...NEUTRAL, brightness: 0.5 });
    expect(rgbAt(black.lab, 0)).toEqual([0, 0, 0]);
    expect(rgbAt(white.lab, 0)).toEqual([255, 255, 255]);
    expect(rgbAt(mid.lab, 0)[0]).toBeGreaterThan(120);
  });

  it('saturation -1 donne du gris, +1 reste dans le gamut', () => {
    const grey = cell(200, 50, 50);
    applyAdjustments(grey, { ...NEUTRAL, saturation: -1 });
    const [r, g, b] = rgbAt(grey.lab, 0);
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
    const vivid = cell(200, 50, 50);
    applyAdjustments(vivid, { ...NEUTRAL, saturation: 1 });
    expect(rgbAt(vivid.lab, 0)[0]).toBeGreaterThanOrEqual(200);
  });
});
