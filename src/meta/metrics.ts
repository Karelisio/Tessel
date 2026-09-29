import { CATEGORY_IDS, type CategoryId } from '@/content/categories';
import { MODE_IDS, type ModeId } from '@/modes/types';
import { TOOL_IDS, type ToolId } from './rewards';

/** Compteurs cumulés depuis le premier lancement (table `stats`, additionnés). */
export const COUNTERS = [
  'cells',
  'artworks',
  /** Œuvres d'au moins 10 000 cases (≈ 100×100). */
  'artworks.size.large',
  /** Œuvres d'au moins 40 000 cases (≈ 200×200). */
  'artworks.size.huge',
  'artworks.photo',
  'artworks.daily',
  'artworks.event',
  'artworks.creation',
  /** Couleurs terminées. */
  'colors',
  'playtime.minutes',
  /** Journées validées (série ou non). */
  'days',
  'quests.daily',
  'quests.weekly',
  'tools',
  'chests',
  'freezes.used',
  'photos',
  'creations',
  'shares',
  'exports',
  'videos',
  'wallpapers',
  'shared.imported',
  'qr',
  'timelapses',
  'gallery.hung',
  'collections',
  'events.collections',
  'frames.changed',
  'ambience.played',
  'daily.opened',
] as const;

/** Jauges : on conserve le maximum atteint. */
export const GAUGES = [
  'streak.best',
  'level',
  /** Catégories dans lesquelles au moins une œuvre est terminée. */
  'categories',
  /** Modes dans lesquels au moins une œuvre est terminée. */
  'modes.completed',
  'modes.unlocked',
  'gallery.walls',
] as const;

/** Succès secrets : jauges 0/1 levées par la méta-progression. */
export const SECRETS = [
  'nightOwl',
  'earlyBird',
  'noUndo',
  'flawless',
  'marathon',
  'minimalist',
  'rainbow',
  'allModes',
  'newYear',
  'patience',
  'fullMoon',
  'friday13',
  'leapDay',
  'anniversary',
  'purist',
] as const;

export type SecretId = (typeof SECRETS)[number];

export type CounterMetric =
  | (typeof COUNTERS)[number]
  | `cells.mode.${ModeId}`
  | `artworks.mode.${ModeId}`
  | `artworks.category.${CategoryId}`
  | `tools.${ToolId}`;

export type GaugeMetric = (typeof GAUGES)[number] | `secret.${SecretId}`;

export type Metric = CounterMetric | GaugeMetric;

const COUNTER_SET = new Set<string>([
  ...COUNTERS,
  ...MODE_IDS.flatMap((m) => [`cells.mode.${m}`, `artworks.mode.${m}`]),
  ...CATEGORY_IDS.map((c) => `artworks.category.${c}`),
  ...TOOL_IDS.map((t) => `tools.${t}`),
]);
const GAUGE_SET = new Set<string>([...GAUGES, ...SECRETS.map((s) => `secret.${s}`)]);

export function isCounter(key: string): key is CounterMetric {
  return COUNTER_SET.has(key);
}

export function isGauge(key: string): key is GaugeMetric {
  return GAUGE_SET.has(key);
}

export function isMetric(key: string): key is Metric {
  return isCounter(key) || isGauge(key);
}

/** Seuils de taille des œuvres (cases à poser). */
export const SIZE = { large: 10_000, huge: 40_000 } as const;
