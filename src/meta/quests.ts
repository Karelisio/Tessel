import type { CategoryId } from '@/content/categories';
import { hashString, mulberry32 } from '@/content/random';
import type { ModeId } from '@/modes/types';
import { xpScale } from './levels';
import type { CounterMetric, Metric } from './metrics';
import { reward, type Reward } from './rewards';

export type QuestPeriod = 'daily' | 'weekly';
export type DailySlot = 'easy' | 'medium' | 'variety';
export type WeeklySlot = 'volume' | 'completion' | 'challenge';
export type QuestSlot = DailySlot | WeeklySlot;

export const SLOTS: Readonly<Record<QuestPeriod, readonly QuestSlot[]>> = {
  daily: ['easy', 'medium', 'variety'],
  weekly: ['volume', 'completion', 'challenge'],
};

export function periodOf(slot: QuestSlot): QuestPeriod {
  return (SLOTS.daily as readonly string[]).includes(slot) ? 'daily' : 'weekly';
}

/** Métrique d'un modèle ; `{mode}` et `{category}` sont tirés parmi ce que le joueur a débloqué. */
export type QuestMetric =
  CounterMetric | 'cells.mode.{mode}' | 'artworks.mode.{mode}' | 'artworks.category.{category}';

export interface QuestTemplate {
  readonly id: string;
  readonly slot: QuestSlot;
  readonly metric: QuestMetric;
  /** Objectif selon le niveau : 1–9, 10–24, 25–49, 50 et plus. */
  readonly targets: readonly [number, number, number, number];
  readonly requires?: { readonly level?: number; readonly stat?: readonly [Metric, number] };
  /** Poids du tirage (1 par défaut). */
  readonly weight?: number;
}

export interface QuestParams {
  mode?: ModeId;
  category?: CategoryId;
}

export interface Quest {
  /** `clé de période:emplacement`, unique : un remplacement garde le même identifiant. */
  readonly id: string;
  readonly period: QuestPeriod;
  readonly periodKey: string;
  readonly slot: QuestSlot;
  readonly template: string;
  readonly params: QuestParams;
  readonly metric: CounterMetric;
  readonly target: number;
  progress: number;
  /** Instant où la quête a été accomplie (récompense versée automatiquement). */
  doneAt: number | null;
}

export interface QuestContext {
  level: number;
  /** Modes et catégories débloqués (et jouables). */
  modes: readonly ModeId[];
  categories: readonly CategoryId[];
  stat: (m: Metric) => number;
  /** Graine propre au joueur : deux joueurs n'ont pas les mêmes quêtes le même jour. */
  seed: number;
}

export function levelTier(level: number): 0 | 1 | 2 | 3 {
  if (level < 10) return 0;
  if (level < 25) return 1;
  if (level < 50) return 2;
  return 3;
}

function eligible(t: QuestTemplate, ctx: QuestContext): boolean {
  if (t.requires?.level !== undefined && ctx.level < t.requires.level) return false;
  if (t.requires?.stat && ctx.stat(t.requires.stat[0]) < t.requires.stat[1]) return false;
  if (t.metric.includes('{mode}') && ctx.modes.length === 0) return false;
  if (t.metric.includes('{category}') && ctx.categories.length === 0) return false;
  return true;
}

function pick<T>(list: readonly T[], rnd: () => number): T | undefined {
  return list[Math.floor(rnd() * list.length)];
}

function instantiate(
  t: QuestTemplate,
  period: QuestPeriod,
  periodKey: string,
  ctx: QuestContext,
  rnd: () => number,
): Quest | null {
  const params: QuestParams = {};
  let metric: string = t.metric;
  if (metric.includes('{mode}')) {
    const mode = pick(ctx.modes, rnd);
    if (!mode) return null;
    params.mode = mode;
    metric = metric.replace('{mode}', mode);
  }
  if (metric.includes('{category}')) {
    const category = pick(ctx.categories, rnd);
    if (!category) return null;
    params.category = category;
    metric = metric.replace('{category}', category);
  }
  return {
    id: `${periodKey}:${t.slot}`,
    period,
    periodKey,
    slot: t.slot,
    template: t.id,
    params,
    metric: metric as CounterMetric,
    target: t.targets[levelTier(ctx.level)],
    progress: 0,
    doneAt: null,
  };
}

/** Tire une quête pour un emplacement, différente (modèle et métrique) de celles déjà prises. */
export function drawQuest(
  slot: QuestSlot,
  periodKey: string,
  ctx: QuestContext,
  templates: readonly QuestTemplate[],
  taken: readonly Quest[],
  salt = 0,
): Quest | null {
  const period = periodOf(slot);
  const rnd = mulberry32(hashString(`${periodKey}|${slot}|${salt}|${ctx.seed}`));
  const pool = templates.filter(
    (t) => t.slot === slot && eligible(t, ctx) && !taken.some((q) => q.template === t.id),
  );
  // quelques essais pour éviter deux quêtes sur la même métrique (ex. deux fois « pose des cases »)
  for (let attempt = 0; attempt < 8 && pool.length > 0; attempt++) {
    const total = pool.reduce((s, t) => s + (t.weight ?? 1), 0);
    let r = rnd() * total;
    let chosen = pool[pool.length - 1];
    for (const t of pool) {
      r -= t.weight ?? 1;
      if (r < 0) {
        chosen = t;
        break;
      }
    }
    if (!chosen) break;
    const q = instantiate(chosen, period, periodKey, ctx, rnd);
    if (q && !taken.some((o) => o.metric === q.metric)) return q;
  }
  return null;
}

/** Les 3 quêtes d'une période (jour ou semaine), déterministes pour un joueur donné. */
export function generateQuests(
  period: QuestPeriod,
  periodKey: string,
  ctx: QuestContext,
  templates: readonly QuestTemplate[],
): Quest[] {
  const out: Quest[] = [];
  for (const slot of SLOTS[period]) {
    const q = drawQuest(slot, periodKey, ctx, templates, out);
    if (q) out.push(q);
  }
  return out;
}

/** Remplace une quête non accomplie par une autre du même emplacement. */
export function rerollQuest(
  quest: Quest,
  active: readonly Quest[],
  ctx: QuestContext,
  templates: readonly QuestTemplate[],
  salt: number,
): Quest | null {
  if (quest.doneAt !== null) return null;
  const others = active.filter((q) => q.id !== quest.id);
  // le modèle actuel est exclu en le comptant comme « pris »
  return drawQuest(quest.slot, quest.periodKey, ctx, templates, [...others, quest], salt + 1);
}

/** Fait avancer les quêtes suivant `metric` ; renvoie celles qui viennent d'être accomplies. */
export function advanceQuests(quests: readonly Quest[], metric: Metric, delta: number, now: number): Quest[] {
  const done: Quest[] = [];
  if (delta <= 0) return done;
  for (const q of quests) {
    if (q.metric !== metric || q.doneAt !== null) continue;
    q.progress = Math.min(q.target, q.progress + delta);
    if (q.progress >= q.target) {
      q.doneAt = now;
      done.push(q);
    }
  }
  return done;
}

const SLOT_REWARDS: Readonly<Record<QuestSlot, { xp: number; items: readonly Reward[] }>> = {
  easy: { xp: 60, items: [] },
  medium: { xp: 100, items: [reward.tool('loupe')] },
  variety: { xp: 120, items: [reward.tool('bucket')] },
  volume: { xp: 400, items: [reward.chest('small')] },
  completion: { xp: 600, items: [reward.chest('medium')] },
  challenge: { xp: 800, items: [reward.tool('wand')] },
};

export function questRewards(slot: QuestSlot, level: number): Reward[] {
  const { xp, items } = SLOT_REWARDS[slot];
  return [reward.xp(Math.round((xp * xpScale(level)) / 5) * 5), ...items];
}

/** Bonus quand les 3 quêtes de la période sont accomplies. */
export const PERIOD_BONUS: Readonly<Record<QuestPeriod, readonly Reward[]>> = {
  daily: [reward.chest('small')],
  weekly: [reward.chest('large')],
};
