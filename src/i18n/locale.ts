import type { I18nText, Locale } from './text';

/** Langue de l'interface : français par défaut, anglais si le téléphone est en anglais. */
export function detectLocale(): Locale {
  const lang = typeof navigator === 'undefined' ? 'fr' : navigator.language.toLowerCase();
  return lang.startsWith('en') ? 'en' : 'fr';
}

let current: Locale = detectLocale();

export function locale(): Locale {
  return current;
}

export function setLocale(l: Locale): void {
  current = l;
}

/** Texte dans la langue courante. */
export function tr(text: I18nText): string {
  return text[current];
}
