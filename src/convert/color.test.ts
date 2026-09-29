import { describe, expect, it } from 'vitest';
import {
  gamutMap,
  linearToOklab,
  linearToSrgb8,
  oklabToLinear,
  oklabToSrgb8,
  srgb8ToOklab,
  SRGB_TO_LINEAR,
} from './color';

describe('espaces colorimétriques', () => {
  it('valeurs de référence OKLab', () => {
    const white = srgb8ToOklab(255, 255, 255);
    expect(white[0]).toBeCloseTo(1, 3);
    expect(Math.abs(white[1])).toBeLessThan(1e-3);
    const black = srgb8ToOklab(0, 0, 0);
    expect(black[0]).toBeCloseTo(0, 5);
    // rouge sRGB pur (valeurs publiées par B. Ottosson)
    const red = srgb8ToOklab(255, 0, 0);
    expect(red[0]).toBeCloseTo(0.628, 2);
    expect(red[1]).toBeCloseTo(0.2249, 2);
    expect(red[2]).toBeCloseTo(0.1258, 2);
  });

  it('aller-retour sRGB → OKLab → sRGB exact sur un échantillon de couleurs', () => {
    for (let r = 0; r < 256; r += 17)
      for (let g = 0; g < 256; g += 51)
        for (let b = 0; b < 256; b += 85) {
          const [L, a, bb] = srgb8ToOklab(r, g, b);
          expect(oklabToSrgb8(L, a, bb)).toEqual([r, g, b]);
        }
  });

  it('linéaire ↔ sRGB 8 bits', () => {
    for (let i = 0; i < 256; i++) expect(linearToSrgb8(SRGB_TO_LINEAR[i] ?? 0)).toBe(i);
  });

  it('projette hors gamut en réduisant la chroma, sans changer la luminosité', () => {
    const lab = [0.7, 0.4, 0.3];
    gamutMap(lab);
    expect(lab[0]).toBe(0.7);
    const rgb = [0, 0, 0];
    oklabToLinear(lab[0] ?? 0, lab[1] ?? 0, lab[2] ?? 0, rgb);
    for (const c of rgb) {
      expect(c).toBeGreaterThanOrEqual(-1e-3);
      expect(c).toBeLessThanOrEqual(1 + 1e-3);
    }
    // la teinte est conservée
    expect(Math.atan2(lab[2] ?? 0, lab[1] ?? 0)).toBeCloseTo(Math.atan2(0.3, 0.4), 5);
  });

  it('écrit sans allocation dans un tableau typé', () => {
    const out = new Float32Array(6);
    linearToOklab(1, 1, 1, out, 3);
    expect(out[3]).toBeCloseTo(1, 3);
  });
});
