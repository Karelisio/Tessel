import { describe, expect, it } from 'vitest';
import {
  cropAspect,
  fitInside,
  fitRatio,
  FULL_CROP,
  moveRect,
  normalizedRatio,
  resizeRect,
  toCropRect,
  type NormRect,
} from './crop';

const FREE = { ratio: null, minW: 0.1, minH: 0.1 };

function inside(r: NormRect): boolean {
  const eps = 1e-9;
  return r.x >= -eps && r.y >= -eps && r.x + r.w <= 1 + eps && r.y + r.h <= 1 + eps && r.w > 0 && r.h > 0;
}

describe('formats et conversions', () => {
  it('convertit un format en pixels en rapport normalisé', () => {
    // photo portrait 800 × 1000 : un carré en pixels est plus large que haut en unités normalisées
    expect(normalizedRatio(1, 800, 1000)).toBeCloseTo(1.25, 10);
    expect(normalizedRatio(4 / 3, 1000, 1000)).toBeCloseTo(4 / 3, 10);
  });

  it('mesure le format d’un recadrage en pixels', () => {
    expect(cropAspect(FULL_CROP, 800, 600)).toBeCloseTo(4 / 3, 10);
    expect(cropAspect({ x: 0, y: 0, w: 0.5, h: 1 }, 800, 600)).toBeCloseTo(2 / 3, 10);
  });

  it('exprime le recadrage en pixels de la photo réduite', () => {
    expect(toCropRect({ x: 0.25, y: 0.1, w: 0.5, h: 0.8 }, 1200, 800)).toEqual({
      x: 300,
      y: 80,
      w: 600,
      h: 640,
    });
  });

  it('ajuste un rapport dans un rectangle', () => {
    expect(fitInside(2, 300, 300)).toEqual({ w: 300, h: 150 });
    expect(fitInside(0.5, 300, 300)).toEqual({ w: 150, h: 300 });
    expect(fitInside(1, 0, 300)).toEqual({ w: 0, h: 0 });
  });
});

describe('moveRect', () => {
  const r: NormRect = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };

  it('déplace le rectangle', () => {
    const m = moveRect(r, 0.1, -0.05);
    expect(m.x).toBeCloseTo(0.3, 10);
    expect(m.y).toBeCloseTo(0.15, 10);
    expect(m.w).toBe(0.4);
    expect(m.h).toBe(0.4);
  });

  it('ne sort jamais de la photo', () => {
    expect(moveRect(r, 5, 5)).toEqual({ x: 0.6, y: 0.6, w: 0.4, h: 0.4 });
    expect(moveRect(r, -5, -5)).toEqual({ x: 0, y: 0, w: 0.4, h: 0.4 });
  });
});

describe('resizeRect (format libre)', () => {
  const r: NormRect = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };

  it('le coin opposé reste fixe (coin bas droite)', () => {
    const m = resizeRect(r, 'se', 0.1, -0.1, FREE);
    expect(m.x).toBe(0.2);
    expect(m.y).toBe(0.2);
    expect(m.w).toBeCloseTo(0.6, 10);
    expect(m.h).toBeCloseTo(0.4, 10);
  });

  it('le coin opposé reste fixe (coin haut gauche)', () => {
    const m = resizeRect(r, 'nw', 0.1, 0.1, FREE);
    expect(m.x).toBeCloseTo(0.3, 10);
    expect(m.y).toBeCloseTo(0.3, 10);
    expect(m.x + m.w).toBeCloseTo(0.7, 10);
    expect(m.y + m.h).toBeCloseTo(0.7, 10);
  });

  it('gère les coins haut droite et bas gauche', () => {
    const ne = resizeRect(r, 'ne', 0.1, -0.1, FREE);
    expect(ne.x).toBeCloseTo(0.2, 10);
    expect(ne.y + ne.h).toBeCloseTo(0.7, 10);
    expect(ne.w).toBeCloseTo(0.6, 10);
    expect(ne.h).toBeCloseTo(0.6, 10);
    const sw = resizeRect(r, 'sw', -0.1, 0.1, FREE);
    expect(sw.x + sw.w).toBeCloseTo(0.7, 10);
    expect(sw.y).toBeCloseTo(0.2, 10);
    expect(sw.w).toBeCloseTo(0.6, 10);
    expect(sw.h).toBeCloseTo(0.6, 10);
  });

  it('reste dans la photo', () => {
    expect(resizeRect(r, 'se', 5, 5, FREE)).toEqual({ x: 0.2, y: 0.2, w: 0.8, h: 0.8 });
    const nw = resizeRect(r, 'nw', -5, -5, FREE);
    expect(nw.x).toBeCloseTo(0, 10);
    expect(nw.y).toBeCloseTo(0, 10);
    expect(inside(nw)).toBe(true);
  });

  it('respecte la taille minimale, même en franchissant le coin fixe', () => {
    const small = resizeRect(r, 'se', -5, -5, { ratio: null, minW: 0.15, minH: 0.2 });
    expect(small.w).toBeCloseTo(0.15, 10);
    expect(small.h).toBeCloseTo(0.2, 10);
    expect(small.x).toBeCloseTo(0.2, 10);
    expect(small.y).toBeCloseTo(0.2, 10);
  });
});

describe('resizeRect (format imposé)', () => {
  const start: NormRect = { x: 0, y: 0, w: 0.5, h: 0.5 };

  it('garde le rapport et projette le doigt sur la diagonale', () => {
    const m = resizeRect(start, 'se', 0.1, 0.3, { ratio: 1, minW: 0.1, minH: 0.1 });
    expect(m.w).toBeCloseTo(m.h, 10);
    expect(m.w).toBeCloseTo(0.7, 10);
    expect(m.x).toBe(0);
    expect(m.y).toBe(0);
  });

  it('tient dans la photo quel que soit le geste', () => {
    for (const handle of ['nw', 'ne', 'sw', 'se'] as const) {
      for (const [dx, dy] of [
        [3, 3],
        [-3, -3],
        [3, -3],
        [-3, 3],
        [0.2, -0.4],
      ] as const) {
        const m = resizeRect({ x: 0.25, y: 0.3, w: 0.4, h: 0.3 }, handle, dx, dy, {
          ratio: 4 / 3,
          minW: 0.1,
          minH: 0.1,
        });
        expect(inside(m)).toBe(true);
        expect(m.w / m.h).toBeCloseTo(4 / 3, 8);
      }
    }
  });

  it('borne la taille par la place disponible depuis le coin fixe', () => {
    const m = resizeRect({ x: 0.5, y: 0.5, w: 0.3, h: 0.3 }, 'se', 5, 5, { ratio: 1, minW: 0.1, minH: 0.1 });
    expect(m).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  });

  it('respecte la taille minimale', () => {
    const m = resizeRect({ x: 0, y: 0, w: 0.6, h: 0.6 }, 'se', -5, -5, { ratio: 2, minW: 0.2, minH: 0.05 });
    expect(m.w).toBeCloseTo(0.2, 10);
    expect(m.h).toBeCloseTo(0.1, 10);
  });
});

describe('fitRatio', () => {
  it('donne le plus grand carré d’une photo portrait, centré', () => {
    const ratio = normalizedRatio(1, 843, 932);
    const m = fitRatio(FULL_CROP, ratio);
    expect(cropAspect(m, 843, 932)).toBeCloseTo(1, 10);
    expect(m.w).toBeCloseTo(1, 10);
    expect(m.h).toBeCloseTo(843 / 932, 10);
    expect(m.y).toBeCloseTo((1 - 843 / 932) / 2, 10);
  });

  it('garde la surface et le centre quand le nouveau format tient', () => {
    const m = fitRatio({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 4 / 3);
    expect(m.w * m.h).toBeCloseTo(0.25, 10);
    expect(m.w / m.h).toBeCloseTo(4 / 3, 10);
    expect(m.x + m.w / 2).toBeCloseTo(0.5, 10);
    expect(m.y + m.h / 2).toBeCloseTo(0.5, 10);
  });

  it('recale le rectangle dans la photo', () => {
    const m = fitRatio({ x: 0.7, y: 0.7, w: 0.3, h: 0.3 }, 3 / 2);
    expect(inside(m)).toBe(true);
    expect(m.w / m.h).toBeCloseTo(3 / 2, 10);
  });

  it('ne dépasse jamais la photo entière', () => {
    for (const ratio of [0.2, 0.75, 1, 4 / 3, 5]) {
      const m = fitRatio(FULL_CROP, ratio);
      expect(inside(m)).toBe(true);
      expect(m.w / m.h).toBeCloseTo(ratio, 10);
    }
  });
});
