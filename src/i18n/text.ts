export type Locale = 'fr' | 'en';

/** Texte traduit porté par les données (catalogue, succès, quêtes). */
export interface I18nText {
  readonly fr: string;
  readonly en: string;
}

export const t = (fr: string, en: string): I18nText => ({ fr, en });
