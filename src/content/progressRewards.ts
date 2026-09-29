import type { ProgressStore } from '@/db/ProgressStore';
import type { ArtworkRef } from '@/db/session';
import type { MetaService } from '@/meta/MetaService';
import { reward } from '@/meta/rewards';
import { COLLECTION_REWARDS, completedBy, eventCollectionRewards } from './collections';
import { editionKey, eventById, isActive } from './events';
import { libraryId } from './library';

/**
 * Après une œuvre terminée : collections thématiques complétées, et collection de l'événement en cours
 * (une récompense par édition, le cadre la première fois).
 */
export async function grantCollections(
  store: ProgressStore,
  meta: MetaService,
  artwork: ArtworkRef,
): Promise<void> {
  const id = artwork.libraryId;
  if (id === undefined) return;
  const done = new Set((await store.completedArtworkIds()).map(libraryId));
  for (const def of completedBy(id, done))
    meta.completeCollection(`collection:${def.id}`, def.name, COLLECTION_REWARDS, false);
  const event = artwork.eventId !== undefined ? eventById(artwork.eventId) : undefined;
  const members = artwork.eventArtworks ?? [];
  if (!event || members.length === 0 || !isActive(event, meta.day)) return;
  if (!members.every((a) => done.has(a))) return;
  const first = !meta.isUnlocked(event.frame);
  meta.completeCollection(
    `event:${editionKey(event, meta.day)}`,
    event.name,
    eventCollectionRewards(first ? reward.unlock(event.frame) : null),
    true,
  );
}
