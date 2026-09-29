import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';

/** « Aujourd’hui », « Hier » ou la date courte. */
export function whenText(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return tr(t('Aujourd’hui', 'Today'));
  if (diff === 1) return tr(t('Hier', 'Yesterday'));
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  }).format(d);
}
