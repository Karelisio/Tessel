import type { CategoryId } from '@/content/categories';
import type { I18nText } from '@/i18n/text';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

/** Taille (plus grand côté, en cases) et nombre maximal de couleurs de chaque difficulté. */
export const DIFFICULTY_SPEC: Readonly<Record<Difficulty, { long: number; colors: number }>> = {
  easy: { long: 48, colors: 12 },
  medium: { long: 96, colors: 24 },
  hard: { long: 144, colors: 36 },
  expert: { long: 224, colors: 64 },
};

export type ArtworkKind = 'svg' | 'generator' | 'publicdomain';

export interface ArtworkCredit {
  artist: string;
  title: string;
  date?: string;
  museum: string;
  url: string;
  license: 'CC0' | 'Public Domain';
}

export interface VariantInfo {
  width: number;
  height: number;
  colors: number;
  /** Cases à poser (hors transparentes). */
  cells: number;
}

/** Entrée de l'index de la bibliothèque (public/art/library.json, généré par scripts/art/build-library.ts). */
export interface LibraryEntry {
  /** Identifiant stable, `catégorie/nom` (sert de chemin des grilles). */
  id: string;
  title: I18nText;
  category: CategoryId;
  kind: ArtworkKind;
  variants: Readonly<Record<Difficulty, VariantInfo>>;
  credit?: ArtworkCredit;
  /** Œuvre d'un événement saisonnier (disponible seulement pendant l'événement). */
  event?: string;
}

export interface LibraryIndex {
  version: number;
  artworks: LibraryEntry[];
}
