import type { ProjectMeta } from '@/db/ProgressStore';
import type { ArtworkRef } from '@/db/session';
import { locale } from '@/i18n/locale';
import type { DayKey } from '@/meta/time';
import { dailyArtwork } from './daily';
import { libraryId, loadGrid, projectArtworkId } from './library';
import type { Difficulty, LibraryEntry, LibraryIndex } from './library/types';

/** Partie d'une œuvre de la bibliothèque dans une difficulté. */
export function libraryRef(entry: LibraryEntry, difficulty: Difficulty, index: LibraryIndex): ArtworkRef {
  return {
    artworkId: projectArtworkId(entry.id, difficulty),
    source: 'library',
    title: entry.title[locale()],
    category: entry.category,
    libraryId: entry.id,
    grid: () => loadGrid(entry.id, difficulty),
    ...(entry.event !== undefined && {
      eventId: entry.event,
      eventArtworks: index.artworks.filter((a) => a.event === entry.event).map((a) => a.id),
    }),
  };
}

export function dailyRef(day: DayKey): ArtworkRef {
  const d = dailyArtwork(day);
  return {
    artworkId: d.id,
    source: 'daily',
    title: d.title[locale()],
    category: d.category,
    grid: () => d.grid(),
  };
}

/** Reprend une partie existante (la grille est déjà figée en base : elle n'est pas refabriquée). */
export function refForProject(p: ProjectMeta, index: LibraryIndex | null): ArtworkRef {
  if (p.source === 'daily') return dailyRef(p.artworkId.slice('daily:'.length));
  const entry =
    p.source === 'library' ? index?.artworks.find((a) => a.id === libraryId(p.artworkId)) : undefined;
  if (entry && index) {
    const diff = (p.artworkId.split('@')[1] ?? 'medium') as Difficulty;
    return libraryRef(entry, diff, index);
  }
  return {
    artworkId: p.artworkId,
    source: p.source,
    ...(p.title !== null && { title: p.title }),
    grid: () => {
      throw new Error('Partie introuvable');
    },
  };
}
