import { describe, expect, it } from 'vitest';
import {
  cellXpRate,
  completionXp,
  levelForXp,
  levelInfo,
  sizeMultiplier,
  totalXpForLevel,
  xpToNext,
} from './levels';

describe('niveaux', () => {
  it('coût croissant et illimité', () => {
    for (let n = 1; n < 500; n++) expect(xpToNext(n + 1)).toBeGreaterThan(xpToNext(n));
    expect(Number.isFinite(totalXpForLevel(1000))).toBe(true);
    expect(levelForXp(totalXpForLevel(1000))).toBe(1000);
  });

  it('bornes de niveau exactes', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(-50)).toBe(1);
    const l12 = totalXpForLevel(12);
    expect(levelForXp(l12 - 1)).toBe(11);
    expect(levelForXp(l12)).toBe(12);
    expect(totalXpForLevel(13) - l12).toBe(xpToNext(12));
  });

  it('avancement dans le niveau', () => {
    const base = totalXpForLevel(7);
    const info = levelInfo(base + xpToNext(7) / 2);
    expect(info.level).toBe(7);
    expect(info.span).toBe(xpToNext(7));
    expect(info.progress).toBeCloseTo(0.5, 2);
  });

  it('bonus de taille, de découverte et de fin d’œuvre', () => {
    expect(sizeMultiplier(30 * 30)).toBe(1);
    expect(sizeMultiplier(100 * 100)).toBe(1.2);
    expect(sizeMultiplier(150 * 150)).toBe(1.4);
    expect(sizeMultiplier(300 * 300)).toBe(1.6);
    expect(cellXpRate(900, true)).toBe(1.5);
    expect(completionXp(1000)).toBe(200);
    expect(completionXp(100 * 100)).toBe(Math.round(1550 * 1.2));
  });
});
