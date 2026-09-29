import { getCategory } from '@/content/categories';
import { t, type I18nText, type Locale } from '@/i18n/text';
import type { ModeId } from '@/modes/types';
import type { Quest } from './quests';

export const MODE_NAMES: Readonly<Record<ModeId, I18nText>> = {
  pixel: t('Pixel art', 'Pixel art'),
  diamond: t('Diamond painting', 'Diamond painting'),
  crossstitch: t('Point de croix', 'Cross-stitch'),
  mosaic: t('Mosaïque', 'Mosaic'),
};

/** Ce qu'on pose dans chaque mode (toujours au pluriel dans les quêtes). */
export const MODE_UNITS: Readonly<Record<ModeId, I18nText>> = {
  pixel: t('pixels', 'pixels'),
  diamond: t('diamants', 'diamonds'),
  crossstitch: t('croix', 'stitches'),
  mosaic: t('tesselles', 'tiles'),
};

export const MODE_IN: Readonly<Record<ModeId, I18nText>> = {
  pixel: t('en pixel art', 'in pixel art'),
  diamond: t('en diamond painting', 'in diamond painting'),
  crossstitch: t('en point de croix', 'in cross-stitch'),
  mosaic: t('en mosaïque', 'in mosaic'),
};

export const PLACEHOLDERS = ['n', 'units', 'inMode', 'category'] as const;

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US').format(n);
}

/** Remplace `{n}`, `{units}`, `{inMode}`, `{category}` ; un paramètre absent reste vide. */
export function fill(
  text: string,
  locale: Locale,
  values: { n?: number; mode?: ModeId; category?: I18nText },
): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    switch (key) {
      case 'n':
        return values.n === undefined ? '' : formatNumber(values.n, locale);
      case 'units':
        return values.mode ? MODE_UNITS[values.mode][locale] : '';
      case 'inMode':
        return values.mode ? MODE_IN[values.mode][locale] : '';
      case 'category':
        return values.category?.[locale] ?? '';
      default:
        return '';
    }
  });
}

export interface QuestText {
  /** Forme au singulier, quand l'objectif vaut 1. */
  readonly one?: I18nText;
  readonly other: I18nText;
}

export function questTitle(text: QuestText, quest: Quest, locale: Locale): string {
  const source = quest.target === 1 && text.one ? text.one : text.other;
  const category = quest.params.category ? getCategory(quest.params.category) : undefined;
  return fill(source[locale], locale, {
    n: quest.target,
    ...(quest.params.mode && { mode: quest.params.mode }),
    ...(category && { category: quest.target === 1 ? category.of : category.ofMany }),
  });
}
