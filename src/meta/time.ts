/** Jour local, `YYYY-MM-DD`. */
export type DayKey = string;
/** Semaine ISO-8601, `YYYY-Www` (lundi → dimanche). */
export type WeekKey = string;

const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Horloge de la méta-progression : décalable depuis le menu debug (« forcer la date »). */
export interface MetaClock {
  now(): number;
}

export const systemClock: MetaClock = { now: () => Date.now() };

export class OffsetClock implements MetaClock {
  constructor(public offsetMs = 0) {}
  now(): number {
    return Date.now() + this.offsetMs;
  }
}

/** Jour local d'un instant (le jour change à minuit, heure du téléphone). */
export function dayKey(d: Date | number): DayKey {
  const date = typeof d === 'number' ? new Date(d) : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Numéro absolu d'un jour : indépendant du fuseau et des changements d'heure. */
export function dayNumber(key: DayKey): number {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNumber(n: number): DayKey {
  const d = new Date(n * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return dayNumber(to) - dayNumber(from);
}

export function addDays(key: DayKey, n: number): DayKey {
  return fromDayNumber(dayNumber(key) + n);
}

/** Jour de la semaine, lundi = 0 … dimanche = 6. */
export function weekday(key: DayKey): number {
  // le 1er janvier 1970 (jour 0) était un jeudi
  return (((dayNumber(key) + 3) % 7) + 7) % 7;
}

/** Semaine ISO d'un jour : la semaine 1 est celle qui contient le premier jeudi de l'année. */
export function weekOf(key: DayKey): WeekKey {
  const thursday = dayNumber(key) - weekday(key) + 3;
  const year = new Date(thursday * DAY_MS).getUTCFullYear();
  const jan1 = Math.round(Date.UTC(year, 0, 1) / DAY_MS);
  return `${year}-W${pad(Math.floor((thursday - jan1) / 7) + 1)}`;
}

export function weekKey(d: Date | number): WeekKey {
  return weekOf(dayKey(d));
}

/** Premier jour (lundi) de la semaine suivante : fin des quêtes hebdomadaires. */
export function nextWeekStart(key: DayKey): DayKey {
  return addDays(key, 7 - weekday(key));
}
