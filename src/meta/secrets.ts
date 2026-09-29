import type { SecretId } from './metrics';
import { dayKey, daysBetween, weekday, type DayKey } from './time';

export const SECRET_RULES = {
  /** Heures locales [début, fin[ des succès nocturne et matinal. */
  nightOwl: [0, 4],
  earlyBird: [5, 7],
  noUndoMinCells: 2_500,
  flawlessMinCells: 2_500,
  marathonMs: 2 * 3_600_000,
  minimalistMaxColors: 4,
  rainbowMinColors: 48,
  patienceDays: 30,
  puristMinCells: 40_000,
  anniversaryDays: 365,
} as const;

const SYNODIC_DAYS = 29.530588861;
const RAD = Math.PI / 180;

/**
 * Instant (ms) de la pleine lune de rang `k` depuis janvier 2000 (Meeus, chap. 49, termes principaux) :
 * précis à quelques minutes, ce qui suffit pour savoir quel jour local elle tombe.
 */
export function fullMoonAt(k: number): number {
  const kk = Math.round(k) + 0.5;
  const T = kk / 1236.85;
  const E = 1 - 0.002516 * T;
  const M = (2.5534 + 29.1053567 * kk) * RAD;
  const Mp = (201.5643 + 385.81693528 * kk) * RAD;
  const F = (160.7108 + 390.67050284 * kk) * RAD;
  const O = (124.7746 - 1.56375588 * kk) * RAD;
  const jde =
    2451550.09766 +
    SYNODIC_DAYS * kk +
    0.00015437 * T * T -
    0.40614 * Math.sin(Mp) +
    0.17302 * E * Math.sin(M) +
    0.01614 * Math.sin(2 * Mp) +
    0.01043 * Math.sin(2 * F) +
    0.00734 * E * Math.sin(Mp - M) -
    0.00515 * E * Math.sin(Mp + M) +
    0.00209 * E * E * Math.sin(2 * M) -
    0.00111 * Math.sin(Mp - 2 * F) -
    0.00057 * Math.sin(Mp + 2 * F) +
    0.00056 * E * Math.sin(2 * Mp + M) -
    0.00042 * Math.sin(3 * Mp) +
    0.00042 * E * Math.sin(M + 2 * F) +
    0.00038 * E * Math.sin(M - 2 * F) -
    0.00024 * E * Math.sin(2 * Mp - M) -
    0.00017 * Math.sin(O);
  return (jde - 2440587.5) * 86_400_000;
}

/** Le jour local contient-il l'instant d'une pleine lune ? (un jour par lunaison) */
export function isFullMoonDay(day: DayKey): boolean {
  const [y = 1970, m = 1, d = 1] = day.split('-').map(Number);
  const noon = new Date(y, m - 1, d, 12).getTime();
  const k = Math.floor((noon - Date.UTC(2000, 0, 6, 18, 14)) / 86_400_000 / SYNODIC_DAYS);
  for (let dk = -1; dk <= 1; dk++) if (dayKey(fullMoonAt(k + dk)) === day) return true;
  return false;
}

/** Secrets liés au jour où l'on colorie. */
export function daySecrets(day: DayKey, playerCreatedAt: number): SecretId[] {
  const out: SecretId[] = [];
  const [, m, d] = day.split('-').map(Number);
  if (m === 1 && d === 1) out.push('newYear');
  if (m === 2 && d === 29) out.push('leapDay');
  if (d === 13 && weekday(day) === 4) out.push('friday13');
  if (isFullMoonDay(day)) out.push('fullMoon');
  if (daysBetween(dayKey(playerCreatedAt), day) >= SECRET_RULES.anniversaryDays) out.push('anniversary');
  return out;
}

/** Secrets liés à l'heure où l'on colorie. */
export function hourSecrets(hour: number): SecretId[] {
  const inRange = ([a, b]: readonly [number, number]) => hour >= a && hour < b;
  if (inRange(SECRET_RULES.nightOwl)) return ['nightOwl'];
  if (inRange(SECRET_RULES.earlyBird)) return ['earlyBird'];
  return [];
}

export interface CompletionFacts {
  cells: number;
  colors: number;
  undos: number;
  errors: number;
  tools: number;
  /** Modes dans lesquels cette œuvre est terminée, celui-ci compris. */
  completedModes: number;
  startedAt: number;
  now: number;
}

/** Secrets liés à la façon dont une œuvre a été terminée. */
export function completionSecrets(f: CompletionFacts): SecretId[] {
  const out: SecretId[] = [];
  const r = SECRET_RULES;
  if (f.cells >= r.noUndoMinCells && f.undos === 0) out.push('noUndo');
  if (f.cells >= r.flawlessMinCells && f.errors === 0) out.push('flawless');
  if (f.colors <= r.minimalistMaxColors) out.push('minimalist');
  if (f.colors >= r.rainbowMinColors) out.push('rainbow');
  if (f.completedModes >= 4) out.push('allModes');
  if (f.now - f.startedAt >= r.patienceDays * 86_400_000) out.push('patience');
  if (f.cells >= r.puristMinCells && f.tools === 0) out.push('purist');
  return out;
}
