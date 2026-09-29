import { describe, expect, it } from 'vitest';
import { dist2, srgb8ToOklab } from './color';
import { histogram, kmeans, medianCut, mergeClose, quantize, type WeightedPoints } from './quantize';

/** Nuage de cases : chaque couleur répétée `n` fois avec un léger bruit déterministe. */
function cloud(
  colors: [number, number, number, number][],
  noise = 0.01,
): { lab: Float32Array; include: Uint8Array } {
  const total = colors.reduce((s, c) => s + c[3], 0);
  const lab = new Float32Array(total * 3);
  let i = 0;
  let seed = 1;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  for (const [r, g, b, n] of colors) {
    const [L, A, B] = srgb8ToOklab(r, g, b);
    for (let k = 0; k < n; k++, i++) {
      lab[i * 3] = L + rnd() * noise;
      lab[i * 3 + 1] = A + rnd() * noise;
      lab[i * 3 + 2] = B + rnd() * noise;
    }
  }
  return { lab, include: new Uint8Array(total).fill(1) };
}

function closestDistance(palette: Float32Array, rgb: [number, number, number]): number {
  const [L, a, b] = srgb8ToOklab(...rgb);
  let best = Infinity;
  for (let j = 0; j < palette.length / 3; j++) {
    best = Math.min(
      best,
      Math.sqrt(dist2(L, a, b, palette[j * 3] ?? 0, palette[j * 3 + 1] ?? 0, palette[j * 3 + 2] ?? 0)),
    );
  }
  return best;
}

const PRIMARIES: [number, number, number][] = [
  [220, 40, 40],
  [40, 160, 60],
  [40, 70, 200],
  [240, 220, 80],
];

describe('quantification', () => {
  it('retrouve les couleurs dominantes d’une image', () => {
    const { lab, include } = cloud(PRIMARIES.map(([r, g, b]) => [r, g, b, 2000]));
    const palette = quantize(histogram(lab, include), { colors: 4 });
    expect(palette.length / 3).toBe(4);
    for (const c of PRIMARIES) expect(closestDistance(palette, c)).toBeLessThan(0.01);
  });

  it('préserve une petite couleur d’accent face à un grand aplat', () => {
    // 20 000 cases de vert dans des nuances proches, 60 cases de rouge vif
    const greens: [number, number, number, number][] = [
      [60, 140, 60, 7000],
      [70, 150, 70, 7000],
      [50, 130, 55, 6000],
    ];
    const { lab, include } = cloud([...greens, [230, 30, 40, 60]]);
    const palette = quantize(histogram(lab, include), { colors: 3 });
    expect(closestDistance(palette, [230, 30, 40])).toBeLessThan(0.03);
  });

  it('est déterministe', () => {
    const { lab, include } = cloud(
      PRIMARIES.map(([r, g, b], i) => [r, g, b, 500 + i * 300]),
      0.08,
    );
    const a = quantize(histogram(lab, include), { colors: 12 });
    const b = quantize(histogram(lab, include), { colors: 12 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('fusionne les couleurs trop proches : pas de doublons dans la palette', () => {
    const { lab, include } = cloud(
      PRIMARIES.map(([r, g, b]) => [r, g, b, 1000]),
      0.03,
    );
    const palette = quantize(histogram(lab, include), { colors: 32, mergeDistance: 0.06 });
    const k = palette.length / 3;
    expect(k).toBeGreaterThanOrEqual(4);
    expect(k).toBeLessThan(12);
    for (let i = 0; i < k; i++)
      for (let j = i + 1; j < k; j++) {
        const d = Math.sqrt(
          dist2(
            palette[i * 3] ?? 0,
            palette[i * 3 + 1] ?? 0,
            palette[i * 3 + 2] ?? 0,
            palette[j * 3] ?? 0,
            palette[j * 3 + 1] ?? 0,
            palette[j * 3 + 2] ?? 0,
          ),
        );
        expect(d).toBeGreaterThanOrEqual(0.06 - 1e-6);
      }
  });

  it('ne dépasse jamais le nombre de couleurs distinctes', () => {
    const { lab, include } = cloud(
      [
        [10, 10, 10, 50],
        [250, 250, 250, 50],
      ],
      0,
    );
    const palette = quantize(histogram(lab, include), { colors: 16 });
    expect(palette.length / 3).toBe(2);
  });

  it('ignore les cases exclues (transparentes)', () => {
    const { lab, include } = cloud(
      [
        [255, 0, 0, 10],
        [0, 0, 255, 10],
      ],
      0,
    );
    include.fill(0, 0, 10);
    const pts = histogram(lab, include);
    expect(Array.from(pts.cells).reduce((s, v) => s + v, 0)).toBe(10);
  });

  it('coupe médiane et k-moyennes réduisent l’erreur', () => {
    const { lab, include } = cloud(
      PRIMARIES.map(([r, g, b]) => [r, g, b, 800]),
      0.12,
    );
    const pts: WeightedPoints = histogram(lab, include);
    const sse = (pal: Float32Array) => {
      let s = 0;
      for (let i = 0; i < pts.count; i++) {
        let best = Infinity;
        for (let j = 0; j < pal.length / 3; j++)
          best = Math.min(
            best,
            dist2(
              pts.lab[i * 3] ?? 0,
              pts.lab[i * 3 + 1] ?? 0,
              pts.lab[i * 3 + 2] ?? 0,
              pal[j * 3] ?? 0,
              pal[j * 3 + 1] ?? 0,
              pal[j * 3 + 2] ?? 0,
            ),
          );
        s += best * (pts.weight[i] ?? 0);
      }
      return s;
    };
    const init = medianCut(pts, 8);
    expect(sse(kmeans(pts, init))).toBeLessThanOrEqual(sse(init) + 1e-9);
    expect(mergeClose(pts, init, 0).length).toBe(init.length);
  });
});
