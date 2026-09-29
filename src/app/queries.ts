import { useEffect, useState } from 'react';
import type { Grid } from '@/content/grid';
import { libraryId } from '@/content/library';
import type { LibraryIndex } from '@/content/library/types';
import type { Bitset } from '@/content/progress';
import type { ProjectMeta } from '@/db/ProgressStore';
import { getServices, useDataVersion, useServices } from './services';

/** Bibliothèque (null pendant le chargement). */
export function useLibrary(): LibraryIndex | null {
  return useServices((s) => s.services?.library ?? null);
}

/**
 * Charge une valeur asynchrone liée aux données de partie : relancée à chaque `useDataVersion().bump()`
 * (fin d'œuvre, retour du jeu…). `undefined` pendant le premier chargement.
 */
export function useQuery<T>(load: () => Promise<T>, deps: readonly unknown[] = []): T | undefined {
  const version = useDataVersion((s) => s.version);
  const [value, setValue] = useState<{ v: T } | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void load()
      .then((v) => {
        if (alive) setValue({ v });
      })
      .catch((e: unknown) => {
        console.error(e);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);
  return value?.v;
}

/** Parties (les plus récentes d'abord). `completed` : terminées seulement, ou en cours seulement. */
export function useProjects(opts: { completed?: boolean; limit?: number } = {}): ProjectMeta[] | undefined {
  return useQuery(async () => (await getServices()).store.list(opts), [opts.completed, opts.limit]);
}

/** Œuvres de la bibliothèque terminées au moins une fois (identifiants sans difficulté). */
export function useCompletedArtworks(): Set<string> | undefined {
  return useQuery(
    async () => new Set((await (await getServices()).store.completedArtworkIds()).map(libraryId)),
  );
}

/** Aperçu d'une partie pour sa miniature (grille + cases posées). */
export function useProjectPreview(id: string): { grid: Grid; filled: Bitset } | null | undefined {
  return useQuery(async () => (await (await getServices()).store.preview(id)) ?? null, [id]);
}

export function useDailyHistory(limit = 30) {
  return useQuery(async () => (await getServices()).meta.dailyHistory(limit), [limit]);
}

export function useFavoriteColors(limit = 8) {
  return useQuery(async () => (await getServices()).meta.favoriteColors(limit), [limit]);
}
