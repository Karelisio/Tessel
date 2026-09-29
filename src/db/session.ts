import type { CategoryId } from '@/content/categories';
import type { Grid } from '@/content/grid';
import type { Engine } from '@/engine/Engine';
import type { Game } from '@/engine/Game';
import type { ArtworkTracker, MetaService } from '@/meta/MetaService';
import type { ToolId } from '@/meta/rewards';
import { getMode } from '@/modes';
import type { ModeId } from '@/modes/types';
import { AutoSaver } from './AutoSaver';
import type { ProgressStore, ProjectCounter, ProjectMeta, ProjectSource } from './ProgressStore';

export interface ArtworkRef {
  artworkId: string;
  source: ProjectSource;
  /** Fabrique la grille ; appelée seulement à la création (la grille est ensuite figée en base). */
  grid: () => Grid;
  title?: string;
  category?: CategoryId;
  /** Œuvre d'un événement saisonnier. */
  eventId?: string;
}

export interface PlaySession {
  readonly game: Game;
  readonly meta: ProjectMeta;
  /** Utilise un outil (le pot s'arme puis s'applique au prochain tap). Renvoie false si impossible. */
  useTool(tool: ToolId): boolean;
  /** Prime d'XP de fin d'œuvre, dès qu'elle est connue. */
  onCompleted: ((bonusXp: number) => void) | null;
  /** Écrit tout ce qui est en attente (mise en arrière-plan, sortie d'écran). */
  flush(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Ouvre une partie : reprend la dernière partie de cette œuvre dans ce mode (une œuvre terminée
 * s'affiche encadrée), ou en crée une (grille figée en base), puis branche la sauvegarde continue
 * et la méta-progression (XP, quêtes, succès, outils).
 */
export async function openSession(
  engine: Engine,
  store: ProgressStore,
  artwork: ArtworkRef,
  mode: ModeId,
  meta: MetaService | null = null,
): Promise<PlaySession> {
  const existing = await store.findLatest(artwork.artworkId, mode);
  const project =
    existing ??
    (await store.create({
      artworkId: artwork.artworkId,
      source: artwork.source,
      mode,
      grid: artwork.grid(),
      ...(artwork.title !== undefined && { title: artwork.title }),
      ...(artwork.category !== undefined && { category: artwork.category }),
    }));
  const loaded = await store.load(project.id);
  const game = engine.load(loaded.grid, getMode(mode));
  game.restore(loaded.filled, loaded.history);

  const saver = new AutoSaver(store, project.id, () => game.progress.filled);
  saver.onError = (e) => {
    console.error('Sauvegarde impossible', e);
  };
  const filledCount = () => game.progress.total - game.progress.left;
  const info = loaded.meta;
  const tracker: ArtworkTracker | null =
    meta?.startArtwork(
      {
        projectId: info.id,
        artworkId: info.artworkId,
        mode,
        source: info.source,
        category: artwork.category ?? null,
        cells: game.progress.total,
        colors: loaded.grid.palette.length,
        startedAt: info.createdAt,
        filled: filledCount(),
        undos: info.undos,
        errors: info.errors,
        tools: info.tools,
        ...(artwork.eventId !== undefined && { eventId: artwork.eventId }),
      },
      [...game.progress.remaining.keys()].filter((c) => game.progress.remaining[c] === 0),
    ) ?? null;
  const count = (c: ProjectCounter) => {
    tracker?.count(c);
    void store.bump(info.id, c).catch((e: unknown) => {
      console.error('Compteur de partie non enregistré', e);
    });
  };

  game.onOp = (op, index) => {
    saver.record(op, index);
    tracker?.progress(filledCount());
  };
  saver.onActiveTime = (ms) => {
    tracker?.activeTime(ms);
  };
  game.onUndo = () => {
    count('undos');
  };
  game.onToolUsed = (tool) => {
    meta?.consumeTool(tool);
    count('tools');
  };
  const offFeedback = game.feedback.on((e) => {
    if (e.type === 'error') count('errors');
    else if (e.type === 'colorComplete') {
      const [r, g, b] = loaded.grid.palette[e.color] ?? [0, 0, 0];
      tracker?.colorDone(e.color, (r << 16) | (g << 8) | b, game.progress.totals[e.color] ?? 0);
    }
  });
  game.onRestart = () => {
    tracker?.restart();
    // les poses en attente appartiennent à l'ancienne partie
    void saver.flush().then(() => store.reset(info.id));
  };

  const session: PlaySession = {
    game,
    meta: info,
    onCompleted: null,
    useTool(tool) {
      if (meta && meta.tools(tool) <= 0) return false;
      switch (tool) {
        case 'bucket':
          game.armBucket(game.armedTool !== 'bucket');
          return true;
        case 'wand':
          return game.useWand() > 0;
        case 'loupe':
          return game.useLoupe();
      }
    },
    flush: async () => {
      await saver.flushAndCompact();
      await meta?.flush();
    },
    close: async () => {
      offPhase();
      offFeedback();
      game.onOp = null;
      game.onToolUsed = null;
      game.onUndo = null;
      await saver.dispose();
      await meta?.flush();
    },
  };

  const offPhase = game.addPhaseListener((phase) => {
    if (phase !== 'finale') return;
    void (async () => {
      await saver.flushAndCompact();
      await store.complete(info.id);
      const modes = await store.completedModes(info.artworkId);
      const bonus = tracker?.complete(modes.length) ?? 0;
      session.onCompleted?.(bonus);
      await meta?.flush();
    })().catch((e: unknown) => {
      console.error('Fin d’œuvre non enregistrée', e);
    });
  });

  return session;
}
