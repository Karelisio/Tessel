import { useSyncExternalStore } from 'react';

const KEY = 'tessel.library.seen.v1';

interface SeenState {
  /** Faux tant que l'état de départ n'est pas posé (aucune œuvre n'est « nouvelle » avant). */
  ready: boolean;
  ids: ReadonlySet<string>;
}

function load(): SeenState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return { ready: true, ids: new Set(parsed.filter((x): x is string => typeof x === 'string')) };
      }
    }
  } catch {
    // stockage indisponible : on repart d'un état vierge
  }
  return { ready: false, ids: new Set() };
}

let state = load();
const listeners = new Set<() => void>();

function commit(next: SeenState): void {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next.ids]));
  } catch {
    // stockage indisponible : la mémoire suffit pour la session
  }
  listeners.forEach((l) => {
    l();
  });
}

/**
 * Premier passage : les œuvres déjà accessibles comptent comme vues. Seules les suivantes
 * (nouvelle catégorie débloquée, mise à jour de l'application, événement) brillent.
 */
export function ensureBaseline(ids: () => string[]): void {
  if (state.ready) return;
  commit({ ready: true, ids: new Set(ids()) });
}

export function markSeen(id: string): void {
  if (!state.ready || state.ids.has(id)) return;
  commit({ ready: true, ids: new Set([...state.ids, id]) });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useSeen(): SeenState {
  return useSyncExternalStore(subscribe, () => state);
}

export const isNew = (s: SeenState, id: string): boolean => s.ready && !s.ids.has(id);
