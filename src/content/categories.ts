import { t, type I18nText } from '@/i18n/text';

export interface CategoryDef {
  readonly id: string;
  readonly name: I18nText;
  /** Complément pour les quêtes : « Termine une œuvre {de fleurs} », « Complete one {flower} artwork ». */
  readonly of: I18nText;
  /** Même complément au pluriel (accord en français) : « Termine 2 œuvres {marines} ». */
  readonly ofMany: I18nText;
}

const cat = (id: string, name: I18nText, fr: string, frMany: string, en: string): CategoryDef => ({
  id,
  name,
  of: t(fr, en),
  ofMany: t(frMany, en),
});

/** Catégories de la bibliothèque, dans l'ordre d'affichage. Les niveaux de déblocage sont dans meta/unlocks. */
export const CATEGORIES = [
  cat('animaux', t('Animaux', 'Animals'), 'd’animaux', 'd’animaux', 'animal'),
  cat('fleurs', t('Fleurs', 'Flowers'), 'de fleurs', 'de fleurs', 'flower'),
  cat('paysages', t('Paysages', 'Landscapes'), 'de paysage', 'de paysage', 'landscape'),
  cat('motifs', t('Motifs', 'Patterns'), 'à motifs', 'à motifs', 'pattern'),
  cat('nourriture', t('Gourmandises', 'Treats'), 'gourmande', 'gourmandes', 'food'),
  cat('chefs-doeuvre', t('Chefs-d’œuvre', 'Masterpieces'), 'de musée', 'de musée', 'museum'),
  cat('mandalas', t('Mandalas', 'Mandalas'), 'mandala', 'mandalas', 'mandala'),
  cat('mer', t('Mer', 'Sea'), 'marine', 'marines', 'sea'),
  cat('oiseaux', t('Oiseaux', 'Birds'), 'd’oiseaux', 'd’oiseaux', 'bird'),
  cat('espace', t('Espace', 'Space'), 'spatiale', 'spatiales', 'space'),
  cat('jardin', t('Jardin', 'Garden'), 'de jardin', 'de jardin', 'garden'),
  cat('architecture', t('Architecture', 'Architecture'), 'd’architecture', 'd’architecture', 'architecture'),
  cat('nuit', t('Nuit', 'Night'), 'nocturne', 'nocturnes', 'night'),
  cat('japon', t('Japon', 'Japan'), 'japonaise', 'japonaises', 'Japanese'),
  cat('insectes', t('Petites bêtes', 'Little critters'), 'de petites bêtes', 'de petites bêtes', 'critter'),
  cat('saisons', t('Saisons', 'Seasons'), 'de saison', 'de saison', 'seasonal'),
] as const satisfies readonly CategoryDef[];

export type CategoryId =
  | 'animaux'
  | 'fleurs'
  | 'paysages'
  | 'motifs'
  | 'nourriture'
  | 'chefs-doeuvre'
  | 'mandalas'
  | 'mer'
  | 'oiseaux'
  | 'espace'
  | 'jardin'
  | 'architecture'
  | 'nuit'
  | 'japon'
  | 'insectes'
  | 'saisons';

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as readonly CategoryId[];

export function isCategoryId(id: string): id is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(id);
}

export function getCategory(id: CategoryId): CategoryDef {
  const c = CATEGORIES.find((x) => x.id === id);
  if (!c) throw new Error(`Catégorie inconnue : ${id}`);
  return c;
}
