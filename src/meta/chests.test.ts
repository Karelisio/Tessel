import { describe, expect, it } from 'vitest';
import { chestContents } from './chests';
import { totalXp } from './rewards';
import type { ChestSize, Reward } from './rewards';

const tools = (r: readonly Reward[]) => r.reduce((s, x) => s + (x.kind === 'tool' ? x.count : 0), 0);

describe('coffres', () => {
  it('déterministes', () => {
    expect(chestContents('medium', 42, 10)).toEqual(chestContents('medium', 42, 10));
  });

  it('plus le coffre est grand, plus il est généreux', () => {
    const avg = (size: ChestSize, f: (r: Reward[]) => number) => {
      let s = 0;
      for (let seed = 0; seed < 400; seed++) s += f(chestContents(size, seed, 1));
      return s / 400;
    };
    expect(avg('small', tools)).toBeGreaterThanOrEqual(1);
    expect(avg('medium', tools)).toBeGreaterThan(avg('small', tools));
    expect(avg('large', tools)).toBeGreaterThan(avg('medium', tools));
    expect(avg('large', totalXp)).toBeGreaterThan(avg('medium', totalXp));
  });

  it('le grand coffre contient toujours une baguette', () => {
    for (let seed = 0; seed < 100; seed++) {
      const wand = chestContents('large', seed, 1).find((r) => r.kind === 'tool' && r.tool === 'wand');
      expect(wand).toBeDefined();
    }
  });

  it('l’XP suit le niveau', () => {
    expect(totalXp(chestContents('small', 7, 41))).toBeGreaterThan(
      totalXp(chestContents('small', 7, 1)) * 1.9,
    );
  });
});
