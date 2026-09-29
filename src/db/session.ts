import type { Grid } from '@/content/grid';
import type { Engine } from '@/engine/Engine';
import type { Game } from '@/engine/Game';
import { getMode } from '@/modes';
import type { ModeId } from '@/modes/types';
import { AutoSaver } from './AutoSaver';
import type { ProgressStore, ProjectMeta, ProjectSource } from './ProgressStore';

export interface ArtworkRef {
  artworkId: string;
  source: ProjectSource;
  /** Fabrique la grille ; appelée seulement à la création (la grille est ensuite figée en base). */
  grid: () => Grid;
  title?: string;
  category?: string;
}

export interface PlaySession {
  readonly game: Game;
  readonly meta: ProjectMeta;
  /** Écrit tout ce qui est en attente (mise en arrière-plan, sortie d'écran). */
  flush(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Ouvre une partie : reprend la dernière partie de cette œuvre dans ce mode (une œuvre terminée
 * s'affiche encadrée), ou en crée une (grille figée en base), puis branche la sauvegarde continue.
 */
export async function openSession(
  engine: Engine,
  store: ProgressStore,
  artwork: ArtworkRef,
  mode: ModeId,
): Promise<PlaySession> {
  const existing = await store.findLatest(artwork.artworkId, mode);
  const meta =
    existing ??
    (await store.create({
      artworkId: artwork.artworkId,
      source: artwork.source,
      mode,
      grid: artwork.grid(),
      ...(artwork.title !== undefined && { title: artwork.title }),
      ...(artwork.category !== undefined && { category: artwork.category }),
    }));
  const loaded = await store.load(meta.id);
  const game = engine.load(loaded.grid, getMode(mode));
  game.restore(loaded.filled, loaded.history);

  const saver = new AutoSaver(store, meta.id, () => game.progress.filled);
  saver.onError = (e) => {
    console.error('Sauvegarde impossible', e);
  };
  game.onOp = (op, index) => {
    saver.record(op, index);
  };
  game.onRestart = () => {
    // les poses en attente appartiennent à l'ancienne partie
    void saver.flush().then(() => store.reset(meta.id));
  };
  const offPhase = game.addPhaseListener((phase) => {
    if (phase === 'finale') {
      void saver.flushAndCompact().then(() => store.complete(meta.id));
    }
  });

  return {
    game,
    meta: loaded.meta,
    flush: () => saver.flushAndCompact(),
    close: async () => {
      offPhase();
      game.onOp = null;
      await saver.dispose();
    },
  };
}
