import type { ArtworkRef } from '@/db/session';
import type { ModeId } from '@/modes/types';
import { useNav } from '@/store/nav';
import { originOf } from '@/ui/library/origin';

/** Ouvre une œuvre en plein écran ; la transition partagée part de la vignette `from`. */
export function openArtwork(ref: ArtworkRef, mode: ModeId, from: Element | null): void {
  useNav.getState().open(ref, { mode, origin: originOf(from) });
}
