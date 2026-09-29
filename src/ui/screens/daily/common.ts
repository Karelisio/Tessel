import { locale } from '@/i18n/locale';
import type { DayKey } from '@/meta/time';

/** Date locale d'une clé de jour `YYYY-MM-DD`. */
export function dateOf(day: DayKey): Date {
  const [y = 1970, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayLabel(day: DayKey, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale(), opts).format(dateOf(day));
}

/** Petit décalage déterministe (0–1) pour disperser des éclats sans hasard au rendu. */
export function scatter(i: number, salt = 0): number {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** 0 = éteinte, 1 = petite flamme … 4 = grand feu (30 jours et plus). */
export type FlameLevel = 0 | 1 | 2 | 3 | 4;

export function flameLevel(current: number): FlameLevel {
  if (current >= 30) return 4;
  if (current >= 7) return 3;
  if (current >= 3) return 2;
  return current >= 1 ? 1 : 0;
}
