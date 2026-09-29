import type { Metric } from './metrics';
import { reward, type Reward } from './rewards';

export type AchievementKind = 'tiered' | 'discovery' | 'secret';

/** Rang : fixe la récompense (du simple clin d'œil au grand accomplissement). */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6;

/** Icônes du jeu d'icônes des succès (dessinées dans l'interface). */
export type AchievementIcon =
  | 'brush'
  | 'pixel'
  | 'diamond'
  | 'stitch'
  | 'tile'
  | 'frame'
  | 'expand'
  | 'mountain'
  | 'palette'
  | 'camera'
  | 'sun'
  | 'flame'
  | 'star'
  | 'check'
  | 'calendar'
  | 'clock'
  | 'album'
  | 'leaf'
  | 'compass'
  | 'sunrise'
  | 'pencil'
  | 'share'
  | 'play'
  | 'bucket'
  | 'wand'
  | 'loupe'
  | 'chest'
  | 'snowflake'
  | 'phone'
  | 'image'
  | 'film'
  | 'inbox'
  | 'qr'
  | 'wall'
  | 'rain'
  | 'sparkle'
  | 'grid'
  | 'gift'
  | 'owl'
  | 'feather'
  | 'target'
  | 'dot'
  | 'rainbow'
  | 'hourglass'
  | 'moon'
  | 'clover'
  | 'firework'
  | 'cake'
  | 'heart';

export interface AchievementDef {
  readonly id: string;
  readonly kind: AchievementKind;
  /** Famille (paliers d'une même métrique). */
  readonly group: string;
  /** Palier dans la famille, à partir de 1. */
  readonly tier: number;
  readonly metric: Metric;
  readonly target: number;
  readonly rank: Rank;
  readonly icon: AchievementIcon;
  /** Récompenses spéciales en plus de celles du rang (cadres, murs…). */
  readonly extra?: readonly Reward[];
}

export const RANK_REWARDS: Readonly<Record<Rank, readonly Reward[]>> = {
  1: [reward.xp(50)],
  2: [reward.xp(150), reward.tool('loupe')],
  3: [reward.xp(300), reward.tool('bucket')],
  4: [reward.xp(600), reward.chest('small')],
  5: [reward.xp(1200), reward.chest('medium')],
  6: [reward.xp(2500), reward.chest('large')],
};

export function achievementRewards(def: AchievementDef): Reward[] {
  return [...RANK_REWARDS[def.rank], ...(def.extra ?? [])];
}

/** Index par métrique : seule la métrique qui vient de changer est réévaluée. */
export function indexByMetric(defs: readonly AchievementDef[]): Map<Metric, AchievementDef[]> {
  const map = new Map<Metric, AchievementDef[]>();
  for (const d of defs) {
    const list = map.get(d.metric) ?? [];
    list.push(d);
    map.set(d.metric, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.target - b.target);
  return map;
}

/** Succès atteints par `value` et pas encore obtenus. */
export function reached(
  defs: readonly AchievementDef[] | undefined,
  value: number,
  unlocked: ReadonlySet<string>,
): AchievementDef[] {
  if (!defs) return [];
  const out: AchievementDef[] = [];
  for (const d of defs) {
    if (d.target > value) break;
    if (!unlocked.has(d.id)) out.push(d);
  }
  return out;
}
