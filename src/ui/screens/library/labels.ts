import type { Difficulty } from '@/content/library/types';
import { t, type I18nText } from '@/i18n/text';
import type { ModeId } from '@/modes/types';
import { MODE_NAMES } from '@/meta/format';
import { unlockLevel } from '@/meta/unlocks';

export const DIFFICULTY_NAMES: Readonly<Record<Difficulty, I18nText>> = {
  easy: t('Facile', 'Easy'),
  medium: t('Moyen', 'Medium'),
  hard: t('Difficile', 'Hard'),
  expert: t('Expert', 'Expert'),
};

export { MODE_NAMES };

export const categoryLevel = (id: string): number | undefined => unlockLevel(`category:${id}`);
export const modeLevel = (id: ModeId): number | undefined => unlockLevel(`mode:${id}`);

/** « il y a 3 h », « hier »… (`now` est passé par l'appelant pour garder le rendu pur). */
export function ago(ts: number, now: number, lang: 'fr' | 'en'): string {
  const rtf = new Intl.RelativeTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { numeric: 'auto' });
  const minutes = Math.max(0, Math.round((now - ts) / 60000));
  if (minutes < 2) return lang === 'fr' ? 'à l’instant' : 'just now';
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}
