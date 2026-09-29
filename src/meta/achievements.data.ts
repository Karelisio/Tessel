import type { CounterMetric, GaugeMetric, Metric, SecretId } from './metrics';
import { reward } from './rewards';
import type { AchievementDef, AchievementIcon, Rank } from './achievements';

type Tier = readonly [target: number, rank: Rank, extra?: AchievementDef['extra']];

function tiered(
  group: string,
  metric: Metric,
  icon: AchievementIcon,
  tiers: readonly Tier[],
): AchievementDef[] {
  return tiers.map(([target, rank, extra], i) => ({
    id: `${group}-${i + 1}`,
    kind: 'tiered',
    group,
    tier: i + 1,
    metric,
    target,
    rank,
    icon,
    ...(extra && { extra }),
  }));
}

function discovery(
  slug: string,
  metric: CounterMetric | GaugeMetric,
  icon: AchievementIcon,
  target = 1,
  rank: Rank = 1,
): AchievementDef {
  return {
    id: `discover-${slug}`,
    kind: 'discovery',
    group: 'discover',
    tier: 1,
    metric,
    target,
    rank,
    icon,
  };
}

function secret(id: SecretId, icon: AchievementIcon, extra?: AchievementDef['extra']): AchievementDef {
  return {
    id: `secret-${id}`,
    kind: 'secret',
    group: 'secret',
    tier: 1,
    metric: `secret.${id}`,
    target: 1,
    rank: 3,
    icon,
    ...(extra && { extra }),
  };
}

const MODE_CELLS: readonly Tier[] = [
  [1_000, 1],
  [10_000, 2],
  [100_000, 3],
  [500_000, 5],
];
const MODE_ARTWORKS: readonly Tier[] = [
  [1, 1],
  [10, 2],
  [50, 3],
  [150, 5],
];

/** Les 150 succès : 110 à paliers, 25 découvertes, 15 secrets. Textes : achievements.text.ts. */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  ...tiered('cells', 'cells', 'brush', [
    [100, 1],
    [1_000, 1],
    [10_000, 2],
    [50_000, 3],
    [100_000, 3],
    [250_000, 4],
    [500_000, 5],
    [1_000_000, 5],
    [2_500_000, 6],
  ]),
  ...tiered('cells-pixel', 'cells.mode.pixel', 'pixel', MODE_CELLS),
  ...tiered('cells-diamond', 'cells.mode.diamond', 'diamond', MODE_CELLS),
  ...tiered('cells-crossstitch', 'cells.mode.crossstitch', 'stitch', MODE_CELLS),
  ...tiered('cells-mosaic', 'cells.mode.mosaic', 'tile', MODE_CELLS),
  ...tiered('artworks', 'artworks', 'frame', [
    [1, 1],
    [5, 1],
    [10, 2],
    [25, 3],
    [50, 4, [reward.unlock('wall:atelier')]],
    [100, 5, [reward.unlock('frame:centenaire')]],
    [250, 5, [reward.unlock('wall:musee')]],
    [500, 6],
    [1_000, 6, [reward.unlock('frame:millier')]],
  ]),
  ...tiered('artworks-pixel', 'artworks.mode.pixel', 'pixel', MODE_ARTWORKS),
  ...tiered('artworks-diamond', 'artworks.mode.diamond', 'diamond', MODE_ARTWORKS),
  ...tiered('artworks-crossstitch', 'artworks.mode.crossstitch', 'stitch', MODE_ARTWORKS),
  ...tiered('artworks-mosaic', 'artworks.mode.mosaic', 'tile', MODE_ARTWORKS),
  ...tiered('large', 'artworks.size.large', 'expand', [
    [1, 2],
    [10, 3],
    [50, 5],
  ]),
  ...tiered('huge', 'artworks.size.huge', 'mountain', [
    [1, 3],
    [5, 4],
    [20, 6],
  ]),
  ...tiered('colors', 'colors', 'palette', [
    [50, 1],
    [250, 2],
    [1_000, 3],
    [5_000, 5],
  ]),
  ...tiered('photo', 'artworks.photo', 'camera', [
    [1, 2],
    [10, 3],
    [50, 4],
  ]),
  ...tiered('daily', 'artworks.daily', 'sun', [
    [1, 1],
    [7, 2],
    [30, 3],
    [100, 5],
    [365, 6],
  ]),
  ...tiered('streak', 'streak.best', 'flame', [
    [3, 1],
    [7, 2],
    [14, 3],
    [30, 4],
    [60, 4],
    [100, 5],
    [200, 5],
    [365, 6],
  ]),
  ...tiered('level', 'level', 'star', [
    [5, 1],
    [10, 2],
    [20, 3],
    [30, 3],
    [50, 4],
    [75, 5],
    [100, 6],
  ]),
  ...tiered('quests-daily', 'quests.daily', 'check', [
    [10, 1],
    [50, 2],
    [200, 4],
    [500, 5],
  ]),
  ...tiered('quests-weekly', 'quests.weekly', 'calendar', [
    [5, 2],
    [20, 3],
    [52, 5],
  ]),
  ...tiered('playtime', 'playtime.minutes', 'clock', [
    [60, 1],
    [600, 3],
    [3_000, 4],
    [6_000, 5],
  ]),
  ...tiered('collections', 'collections', 'album', [
    [1, 2],
    [5, 3],
    [10, 4],
    [20, 6],
  ]),
  ...tiered('events', 'artworks.event', 'leaf', [
    [1, 2],
    [10, 3],
    [30, 5],
  ]),
  ...tiered('categories', 'categories', 'compass', [
    [4, 1],
    [8, 2],
    [12, 3],
    [16, 4],
  ]),
  ...tiered('days', 'days', 'sunrise', [
    [7, 1],
    [30, 3],
    [100, 4],
    [365, 6],
  ]),
  ...tiered('gallery', 'gallery.hung', 'frame', [[10, 2]]),

  discovery('photo', 'photos', 'camera'),
  discovery('creation', 'creations', 'pencil'),
  discovery('share', 'shares', 'share'),
  discovery('timelapse', 'timelapses', 'play'),
  discovery('gallery', 'gallery.hung', 'frame'),
  discovery('bucket', 'tools.bucket', 'bucket'),
  discovery('wand', 'tools.wand', 'wand'),
  discovery('loupe', 'tools.loupe', 'loupe'),
  discovery('chest', 'chests', 'chest'),
  discovery('quest', 'quests.daily', 'check'),
  discovery('weekly', 'quests.weekly', 'calendar'),
  discovery('freeze', 'freezes.used', 'snowflake'),
  discovery('wallpaper', 'wallpapers', 'phone'),
  discovery('export', 'exports', 'image'),
  discovery('video', 'videos', 'film'),
  discovery('shared', 'shared.imported', 'inbox'),
  discovery('qr', 'qr', 'qr'),
  discovery('wall', 'gallery.walls', 'wall', 2),
  discovery('frame', 'frames.changed', 'frame'),
  discovery('ambience', 'ambience.played', 'rain'),
  discovery('daily-gift', 'daily.opened', 'gift'),
  discovery('modes', 'modes.unlocked', 'sparkle', 4, 2),
  discovery('own-artwork', 'artworks.creation', 'pencil', 1, 2),
  discovery('all-modes', 'modes.completed', 'grid', 4, 3),
  discovery('event-collection', 'events.collections', 'leaf', 1, 3),

  secret('nightOwl', 'owl'),
  secret('earlyBird', 'feather'),
  secret('noUndo', 'target'),
  secret('flawless', 'heart'),
  secret('marathon', 'hourglass'),
  secret('minimalist', 'dot'),
  secret('rainbow', 'rainbow'),
  secret('allModes', 'diamond', [reward.unlock('frame:prisme')]),
  secret('newYear', 'firework'),
  secret('patience', 'hourglass'),
  secret('fullMoon', 'moon'),
  secret('friday13', 'clover'),
  secret('leapDay', 'calendar'),
  secret('anniversary', 'cake'),
  secret('purist', 'brush'),
];
