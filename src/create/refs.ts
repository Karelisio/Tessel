import type { ArtworkRef } from '@/db/session';
import type { CreationDoc } from './document';
import { toGrid } from './document';
import { gridHash, type SharedArtwork } from './format';

/**
 * Partie jouable d'une création : chaque version dessinée est une œuvre distincte
 * (modifier le dessin ne casse pas une partie commencée).
 */
export function creationRef(title: string, doc: CreationDoc): ArtworkRef {
  const grid = toGrid(doc);
  return { artworkId: `creation:${gridHash(grid)}`, source: 'creation', title, grid: () => grid };
}

/** Partie d'une œuvre reçue (.tessel ou QR) : la même œuvre importée deux fois reprend la même partie. */
export function sharedRef(a: SharedArtwork): ArtworkRef {
  return { artworkId: `shared:${gridHash(a.grid)}`, source: 'shared', title: a.title, grid: () => a.grid };
}
