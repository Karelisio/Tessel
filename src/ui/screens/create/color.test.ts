import { describe, expect, it } from 'vitest';
import type { Rgb } from '@/content/grid';
import { hslToRgb, inkOn, rgbToHsl } from './color';

describe('couleurs du sélecteur', () => {
  it('reconnaît les couleurs primaires', () => {
    expect(rgbToHsl([255, 0, 0])).toEqual({ h: 0, s: 100, l: 50 });
    expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual([0, 255, 0]);
    expect(hslToRgb({ h: 240, s: 100, l: 50 })).toEqual([0, 0, 255]);
  });

  it('les gris n’ont ni teinte ni saturation', () => {
    const hsl = rgbToHsl([128, 128, 128]);
    expect(hsl.s).toBe(0);
    expect(Math.round(hsl.l)).toBe(50);
  });

  it('fait l’aller-retour RVB → TSL → RVB à un niveau près', () => {
    const samples: Rgb[] = [
      [200, 120, 160],
      [12, 200, 90],
      [250, 250, 20],
      [30, 28, 34],
    ];
    for (const c of samples) {
      const back = hslToRgb(rgbToHsl(c));
      c.forEach((v, i) => {
        expect(Math.abs((back[i] ?? 0) - v)).toBeLessThanOrEqual(1);
      });
    }
  });

  it('borne les valeurs hors plage', () => {
    expect(hslToRgb({ h: 400, s: 150, l: 120 })).toEqual([255, 255, 255]);
    expect(hslToRgb({ h: -60, s: 100, l: 50 })).toEqual([255, 0, 255]);
  });

  it('choisit une encre lisible', () => {
    expect(inkOn([255, 255, 255])).toContain('40, 30, 40');
    expect(inkOn([10, 10, 10])).toContain('255, 255, 255');
  });
});
