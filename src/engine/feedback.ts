import type { ModeId } from '@/modes/types';

/**
 * Événements de jeu diffusés dans la même frame à tous les retours (visuel, son, haptique, UI).
 */
export type FeedbackEvent =
  | {
      type: 'place';
      index: number;
      x: number;
      y: number;
      color: number;
      mode: ModeId;
      drag: boolean;
      time: number;
    }
  | { type: 'error'; index: number; x: number; y: number; time: number }
  | { type: 'colorComplete'; color: number; x: number; y: number; mode: ModeId; time: number }
  | { type: 'artworkComplete'; mode: ModeId; time: number }
  | { type: 'longPress'; time: number };

type Listener = (e: FeedbackEvent) => void;

export class FeedbackBus {
  private readonly listeners = new Set<Listener>();

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  emit(e: FeedbackEvent): void {
    for (const l of this.listeners) l(e);
  }
}
