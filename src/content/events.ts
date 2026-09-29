import { t, type I18nText } from '@/i18n/text';
import type { UnlockKey } from '@/meta/catalog';
import { addDays, dayNumber, type DayKey } from '@/meta/time';

export type EventDecor = 'stars' | 'hearts' | 'petals' | 'sun' | 'leaves' | 'snow';

export interface SeasonalEvent {
  readonly id: string;
  readonly name: I18nText;
  /** Premier et dernier jour inclus, [mois 1–12, jour]. La fenêtre peut chevaucher le 1er janvier. */
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
  /** Décor animé de l'interface pendant l'événement. */
  readonly decor: EventDecor;
  /** Cadre offert à la première collection terminée. */
  readonly frame: UnlockKey;
}

/** Événements annuels, selon la date du téléphone : leurs œuvres reviennent chaque année. */
export const EVENTS: readonly SeasonalEvent[] = [
  {
    id: 'nouvel-an',
    name: t('Nouvel an', 'New Year'),
    start: [12, 28],
    end: [1, 7],
    decor: 'stars',
    frame: 'frame:nouvel-an',
  },
  {
    id: 'saint-valentin',
    name: t('Saint-Valentin', 'Valentine’s Day'),
    start: [2, 7],
    end: [2, 16],
    decor: 'hearts',
    frame: 'frame:saint-valentin',
  },
  {
    id: 'printemps',
    name: t('Printemps', 'Spring'),
    start: [3, 20],
    end: [4, 30],
    decor: 'petals',
    frame: 'frame:printemps',
  },
  { id: 'ete', name: t('Été', 'Summer'), start: [6, 21], end: [8, 31], decor: 'sun', frame: 'frame:ete' },
  {
    id: 'halloween',
    name: t('Halloween', 'Halloween'),
    start: [10, 15],
    end: [11, 3],
    decor: 'leaves',
    frame: 'frame:halloween',
  },
  {
    id: 'noel',
    name: t('Noël', 'Christmas'),
    start: [12, 1],
    end: [12, 27],
    decor: 'snow',
    frame: 'frame:noel',
  },
];

const pad = (n: number) => String(n).padStart(2, '0');
const key = (year: number, [m, d]: readonly [number, number]): DayKey => `${year}-${pad(m)}-${pad(d)}`;

/** Fenêtre [début, fin] de l'occurrence de l'événement qui contient `day` ou qui la suit. */
export function occurrence(e: SeasonalEvent, day: DayKey): { start: DayKey; end: DayKey } {
  const year = Number(day.slice(0, 4));
  const wraps = e.end[0] < e.start[0];
  for (const y of [year - 1, year, year + 1]) {
    const start = key(y, e.start);
    const end = key(wraps ? y + 1 : y, e.end);
    if (dayNumber(end) >= dayNumber(day)) return { start, end };
  }
  return { start: key(year + 1, e.start), end: key(wraps ? year + 2 : year + 1, e.end) };
}

export function isActive(e: SeasonalEvent, day: DayKey): boolean {
  const { start, end } = occurrence(e, day);
  const n = dayNumber(day);
  return n >= dayNumber(start) && n <= dayNumber(end);
}

export function activeEvents(day: DayKey): SeasonalEvent[] {
  return EVENTS.filter((e) => isActive(e, day));
}

/** Prochain événement à venir (pas déjà en cours) et nombre de jours avant son début. */
export function nextEvent(day: DayKey): { event: SeasonalEvent; inDays: number } {
  let best: { event: SeasonalEvent; inDays: number } | null = null;
  for (const e of EVENTS) {
    if (isActive(e, day)) continue;
    const { start } = occurrence(e, day);
    const inDays = dayNumber(start) - dayNumber(day);
    if (!best || inDays < best.inDays) best = { event: e, inDays };
  }
  if (!best) throw new Error('Aucun événement');
  return best;
}

/** Clé d'une édition (`noel-2026`) : la collection d'un événement se termine une fois par édition. */
export function editionKey(e: SeasonalEvent, day: DayKey): string {
  return `${e.id}-${occurrence(e, day).start.slice(0, 4)}`;
}

/** Derniers jours de l'événement (bandeau « plus que N jours »). */
export function daysLeft(e: SeasonalEvent, day: DayKey): number {
  return dayNumber(occurrence(e, day).end) - dayNumber(day) + 1;
}

export const eventById = (id: string): SeasonalEvent | undefined => EVENTS.find((e) => e.id === id);

/** Jour suivant la fin (utile aux notifications). */
export function dayAfter(e: SeasonalEvent, day: DayKey): DayKey {
  return addDays(occurrence(e, day).end, 1);
}
