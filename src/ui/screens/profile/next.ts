import { levelRewards } from '@/meta/unlocks';
import type { Reward } from '@/meta/rewards';

/** Prochain niveau qui apporte une nouveauté (mode, catégorie, cadre, badge…). */
export function nextUnlock(level: number): { level: number; rewards: Reward[] } | null {
  for (let l = level + 1; l <= level + 120; l++) {
    const rewards = levelRewards(l).filter((r) => r.kind === 'unlock');
    if (rewards.length > 0) return { level: l, rewards };
  }
  return null;
}

/** Palier de prestige (niveau 90 : I, 100 : II…) ; 0 avant le niveau 90. */
export function prestigeTier(level: number): number {
  return Math.max(0, Math.floor((level - 80) / 10));
}
