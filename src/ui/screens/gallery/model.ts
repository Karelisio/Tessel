import type { CSSProperties } from 'react';
import { CATEGORIES, isCategoryId, type CategoryDef } from '@/content/categories';
import type { ProjectMeta } from '@/db/ProgressStore';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { FRAME_RATIO } from '@/fx/finaleTimeline';
import { MODE_NAMES } from '@/meta/format';
import { MODE_IDS, type ModeId } from '@/modes/types';

export type SortKey = 'recent' | 'old' | 'title' | 'size';
export const SORT_KEYS: readonly SortKey[] = ['recent', 'old', 'title', 'size'];

export const sortLabel = (k: SortKey): string =>
  ({
    recent: tr(t('Récentes', 'Newest')),
    old: tr(t('Anciennes', 'Oldest')),
    title: tr(t('Titre', 'Title')),
    size: tr(t('Taille', 'Size')),
  })[k];

export interface Filters {
  mode: ModeId | null;
  category: string | null;
}

export const NO_FILTER: Filters = { mode: null, category: null };

export const displayTitle = (p: ProjectMeta): string => p.title ?? tr(t('Sans titre', 'Untitled'));
export const modeName = (m: ModeId): string => tr(MODE_NAMES[m]);
export const categoryName = (id: string | null): string | null => {
  if (id === null || !isCategoryId(id)) return null;
  const def = CATEGORIES.find((c) => c.id === id);
  return def ? tr(def.name) : null;
};

const finishedAt = (p: ProjectMeta) => p.completedAt ?? p.updatedAt;

export function arrange(list: readonly ProjectMeta[], sort: SortKey, filters: Filters): ProjectMeta[] {
  const out = list.filter(
    (p) =>
      (filters.mode === null || p.mode === filters.mode) &&
      (filters.category === null || p.category === filters.category),
  );
  const lang = locale() === 'fr' ? 'fr' : 'en';
  switch (sort) {
    case 'recent':
      return out.sort((a, b) => finishedAt(b) - finishedAt(a));
    case 'old':
      return out.sort((a, b) => finishedAt(a) - finishedAt(b));
    case 'title':
      return out.sort((a, b) => displayTitle(a).localeCompare(displayTitle(b), lang));
    case 'size':
      return out.sort((a, b) => b.total - a.total || finishedAt(b) - finishedAt(a));
  }
}

/** Modes et catégories présents parmi les œuvres (dans l'ordre habituel). */
export function present(list: readonly ProjectMeta[]): { modes: ModeId[]; categories: CategoryDef[] } {
  const modes = MODE_IDS.filter((m) => list.some((p) => p.mode === m));
  const categories = CATEGORIES.filter((c) => list.some((p) => p.category === c.id));
  return { modes, categories };
}

/** Marge que le rendu laisse autour du cadre (voir ArtworkRenderer : ombre portée). */
const RENDER_MARGIN = 0.07;

/**
 * Géométrie de l'image encadrée d'une partie : rapport largeur / hauteur et retrait du cadre
 * (pour poser l'ombre portée exactement sous le cadre).
 */
export function frameGeometry(width: number, height: number): CSSProperties {
  const big = Math.max(width, height);
  const pad = (FRAME_RATIO.mat + FRAME_RATIO.frame + RENDER_MARGIN) * big;
  const w = width + 2 * pad;
  const h = height + 2 * pad;
  const inset = RENDER_MARGIN * big;
  return {
    ['--ar' as string]: (w / h).toFixed(4),
    ['--ix' as string]: `${((inset / w) * 100).toFixed(2)}%`,
    ['--iy' as string]: `${((inset / h) * 100).toFixed(2)}%`,
  };
}

export const withVars = (vars: Record<string, string | number>): CSSProperties => vars;
