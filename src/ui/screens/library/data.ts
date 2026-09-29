import { CATEGORIES } from '@/content/categories';
import { libraryId } from '@/content/library';
import type { Difficulty, LibraryEntry } from '@/content/library/types';
import type { ProjectMeta } from '@/db/ProgressStore';
import { locale } from '@/i18n/locale';
import type { Filters } from './types';

/** Parties d'une œuvre de la bibliothèque : en cours et terminées (les plus récentes d'abord). */
export interface WorkState {
  open: ProjectMeta[];
  done: ProjectMeta[];
}

export type WorkStatus = 'todo' | 'doing' | 'done';

export function projectDifficulty(p: ProjectMeta): Difficulty {
  return (p.artworkId.split('@')[1] ?? 'medium') as Difficulty;
}

/** Regroupe les parties par œuvre de la bibliothèque (les autres sources sont ignorées). */
export function buildStates(projects: readonly ProjectMeta[] | undefined): Map<string, WorkState> {
  const map = new Map<string, WorkState>();
  for (const p of projects ?? []) {
    if (p.source !== 'library') continue;
    const id = libraryId(p.artworkId);
    const state = map.get(id) ?? { open: [], done: [] };
    (p.completedAt === null ? state.open : state.done).push(p);
    map.set(id, state);
  }
  return map;
}

/** Avancement de 0 à 1. */
export const fraction = (p: ProjectMeta): number => (p.total > 0 ? p.filled / p.total : 0);

/** Pourcentage affiché d'une partie en cours (jamais 100 tant qu'elle n'est pas terminée). */
export const percent = (p: ProjectMeta): number => Math.min(99, Math.floor(fraction(p) * 100));

/** Statut d'une œuvre, éventuellement limité à une difficulté ; `project` : la partie en cours la plus récente. */
export function statusOf(
  state: WorkState | undefined,
  difficulty: Difficulty | null,
): { status: WorkStatus; project: ProjectMeta | undefined } {
  const match = (p: ProjectMeta) => difficulty === null || projectDifficulty(p) === difficulty;
  const project = state?.open.find(match);
  if (project) return { status: 'doing', project };
  if (state?.done.some(match)) return { status: 'done', project: undefined };
  return { status: 'todo', project: undefined };
}

/** Minuscules sans accents, pour la recherche. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .trim();
}

const CATEGORY_RANK = new Map<string, number>(CATEGORIES.map((c, i) => [c.id, i]));

/** Œuvres correspondant aux filtres (l'ordre de la bibliothèque, regroupé par catégorie). */
export function applyFilters(
  entries: readonly LibraryEntry[],
  states: ReadonlyMap<string, WorkState>,
  filters: Filters,
): LibraryEntry[] {
  const lang = locale();
  const q = normalize(filters.query);
  const out = entries.filter((e) => {
    if (filters.category !== null && e.category !== filters.category) return false;
    if (q && !normalize(e.title[lang]).includes(q)) return false;
    if (filters.status !== 'all') {
      const { status } = statusOf(states.get(e.id), filters.difficulty);
      if (status !== filters.status) return false;
    }
    return true;
  });
  if (filters.category === null) {
    out.sort((a, b) => (CATEGORY_RANK.get(a.category) ?? 0) - (CATEGORY_RANK.get(b.category) ?? 0));
  }
  return out;
}

/** Des filtres de difficulté ou d'avancement sont-ils actifs ? */
export const filtersActive = (f: Filters): boolean => f.difficulty !== null || f.status !== 'all';

/** Petit hachage stable (idée du jour). */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
