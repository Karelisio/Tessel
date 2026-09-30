import { describe, expect, it } from 'vitest';
import { createGrid, TRANSPARENT } from '@/content/grid';
import { veilPixels } from './veil';

describe('veilPixels', () => {
  it('moyenne les couleurs par zone et désature', () => {
    // 4×4 : moitié gauche rouge, moitié droite bleue
    const cells = new Uint8Array(16).map((_, i) => (i % 4 < 2 ? 0 : 1));
    const g = createGrid(
      4,
      4,
      [
        [255, 0, 0],
        [0, 0, 255],
      ],
      cells,
    );
    const px = veilPixels(g, 2);
    const [r, gg, b, a] = px.slice(0, 4);
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(150);
    expect(gg).toBeGreaterThan(0); // désaturé : plus du rouge pur
    expect(b).toBeLessThan(r ?? 0);
    expect(px[6]).toBeGreaterThan(px[4] ?? 0); // zone droite bleue
  });

  it('rend transparentes les zones sans case et centre les grilles non carrées', () => {
    const g = createGrid(4, 2, [[10, 20, 30]], new Uint8Array(8));
    const px = veilPixels(g, 4);
    expect(px[3]).toBe(0); // rangée du haut : hors de la grille
    expect(px[4 * 4 + 3]).toBe(255); // rangée 2 : dans la grille
    const hole = createGrid(2, 2, [[10, 20, 30]], new Uint8Array([0, TRANSPARENT, TRANSPARENT, TRANSPARENT]));
    expect(veilPixels(hole, 1)[3]).toBe(64);
  });
});
