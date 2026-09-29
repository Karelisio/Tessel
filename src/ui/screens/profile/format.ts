import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import type { MetaService } from '@/meta/MetaService';
import type { Metric } from '@/meta/metrics';
import type { MetaSnapshot } from '@/store/meta';

export const bcp47 = () => (locale() === 'fr' ? 'fr-FR' : 'en-US');

export function fmt(n: number): string {
  return new Intl.NumberFormat(bcp47()).format(Math.round(n));
}

/** Durée lisible : « 45 min », « 3 h 20 min ». */
export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${fmt(h)} h` : `${fmt(h)} h ${String(rest).padStart(2, '0')}`;
}

export const formatDuration = (ms: number) => formatMinutes(ms / 60_000);

export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat(bcp47(), { day: 'numeric', month: 'long', year: 'numeric' }).format(ts);
}

/** « 12 mars » à partir d'un jour `YYYY-MM-DD`. */
export function formatDay(
  day: string,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) {
  const [y = 1970, m = 1, d = 1] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(bcp47(), opts).format(new Date(y, m - 1, d));
}

/** Valeur d'une métrique : certaines jauges se rattrapent sur l'état courant. */
export function metricValue(service: MetaService, snap: MetaSnapshot, metric: Metric): number {
  const v = service.stat(metric);
  switch (metric) {
    case 'level':
      return Math.max(v, snap.level.level);
    case 'streak.best':
      return Math.max(v, snap.streak.best);
    case 'modes.unlocked':
      return Math.max(v, snap.modes.length);
    default:
      return v;
  }
}

export const RANK_LABEL = (rank: number) =>
  `${tr(t('Rang', 'Rank'))} ${['I', 'II', 'III', 'IV', 'V', 'VI'][rank - 1] ?? rank}`;
