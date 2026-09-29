import { decodeGrid } from '@/db/codecs';
import type { Grid } from '../grid';
import type { Difficulty, LibraryEntry, LibraryIndex } from './types';

let index: Promise<LibraryIndex> | null = null;

/** Index de la bibliothèque (chargé une fois, embarqué dans l'application). */
export function loadLibrary(): Promise<LibraryIndex> {
  index ??= fetch('art/library.json').then(async (r) => {
    if (!r.ok) throw new Error(`Bibliothèque introuvable (${r.status})`);
    return (await r.json()) as LibraryIndex;
  });
  index.catch(() => {
    index = null;
  });
  return index;
}

const grids = new Map<string, Promise<Grid>>();

/** Grille d'une œuvre dans une difficulté (mise en cache : les vignettes la réutilisent). */
export function loadGrid(id: string, difficulty: Difficulty): Promise<Grid> {
  const key = `${id}@${difficulty}`;
  let p = grids.get(key);
  if (!p) {
    p = fetch(`art/grids/${id}/${difficulty}.tgrid`).then(async (r) => {
      if (!r.ok) throw new Error(`Grille introuvable : ${key}`);
      return decodeGrid(new Uint8Array(await r.arrayBuffer()));
    });
    p.catch(() => grids.delete(key));
    grids.set(key, p);
  }
  return p;
}

/** Identifiant de projet d'une œuvre de la bibliothèque dans une difficulté. */
export const projectArtworkId = (id: string, difficulty: Difficulty) => `${id}@${difficulty}`;

/** Identifiant d'œuvre de bibliothèque d'un projet (sans la difficulté). */
export const libraryId = (artworkId: string) => artworkId.split('@')[0] ?? artworkId;

export function byCategory(entries: readonly LibraryEntry[]): Map<string, LibraryEntry[]> {
  const map = new Map<string, LibraryEntry[]>();
  for (const e of entries) map.set(e.category, [...(map.get(e.category) ?? []), e]);
  return map;
}
