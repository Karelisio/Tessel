import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sunsetLake } from '@/content/generators/sunsetLake';
import { installCapture, type CaptureApi } from '@/debug/capture';
import { runBench, type BenchResult } from '@/debug/bench';
import { ManualClock } from '@/engine/Clock';
import { openDatabase } from '@/db';
import { ProgressStore } from '@/db/ProgressStore';
import { openSession, type ArtworkRef, type PlaySession } from '@/db/session';
import { Engine } from '@/engine/Engine';
import type { Game } from '@/engine/Game';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { MetaService } from '@/meta/MetaService';
import type { ToolId } from '@/meta/rewards';
import { unlockLevel } from '@/meta/unlocks';
import { getMode } from '@/modes';
import type { ModeId } from '@/modes/types';
import { useMetaStore } from '@/store/meta';
import { usePlayStore } from '@/store/play';
import { spring } from '@/theme/motion/tokens';
import { ImportSheet, type ImportResult } from '@/ui/import/ImportSheet';
import { IconLock } from '@/ui/meta/icons';
import { LevelChip } from '@/ui/meta/LevelChip';
import { ProgressSheet } from '@/ui/meta/ProgressSheet';
import { Toasts } from '@/ui/meta/Toasts';
import { ToolDock } from '@/ui/meta/ToolDock';
import '@/ui/meta/meta.css';
import { Palette } from './Palette';
import { PerfHud } from './PerfHud';

const TOP_INSET = 64;
const BOTTOM_INSET = 130;

declare global {
  interface Window {
    __tessel?: Engine;
    __capture?: CaptureApi;
    __bench?: () => Promise<BenchResult[]>;
    /** Développement : méta-progression (ajouter de l'XP, des outils…). */
    __meta?: MetaService;
    /** Développement : ouvre l'écran d'import directement sur cette image (tests automatisés). */
    __importBlob?: (blob: Blob) => void;
  }
}

const MODE_LABELS: Record<ModeId, string> = {
  pixel: 'Pixel',
  diamond: 'Diamant',
  crossstitch: 'Croix',
  mosaic: 'Mosaïque',
};
const MODE_IDS = Object.keys(MODE_LABELS) as ModeId[];

export function PlayScreen() {
  const host = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const session = useRef<PlaySession | null>(null);
  const store = useRef<ProgressStore | null>(null);
  const artwork = useRef<ArtworkRef | null>(null);
  const meta = useRef<MetaService | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [bonusXp, setBonusXp] = useState<number | null>(null);
  const unlockedModes = useMetaStore((st) => st.snap?.modes) ?? MODE_IDS;
  const hasMeta = useMetaStore((st) => st.service !== null);
  const [importPhoto, setImportPhoto] = useState<Blob | null>(null);
  const { snapshot, mode, showHud, canUndo, canRedo, phase, setSnapshot, setMode, setPhase, toggleHud } =
    usePlayStore();

  /** Branche une partie sur l'interface : instantané, phase, et partie courante. */
  const bind = useCallback(
    (g: Game) => {
      setBonusXp(null);
      g.onSnapshot = (s) => {
        setSnapshot(s, g.canUndo, g.canRedo);
      };
      g.onPhase = setPhase;
      // état de la nouvelle partie tout de suite : pas d'image de l'ancienne palette entre deux parties
      setSnapshot(g.snapshot(), g.canUndo, g.canRedo);
      setPhase(g.phase);
      setGame(g);
    },
    [setSnapshot, setPhase],
  );

  /** Prime d'XP de fin d'œuvre, affichée dans le panneau final. */
  const watchCompletion = useCallback((sess: PlaySession) => {
    sess.onCompleted = (bonus) => {
      if (session.current === sess) setBonusXp(bonus);
    };
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let alive = true;
    let created: Engine | null = null;
    let detachMeta: (() => void) | null = null;
    const params = new URLSearchParams(location.search);
    const capture = params.has('capture');
    const clock = new ManualClock();
    void Engine.create(el, capture ? { clock, manual: true } : {})
      .then(async (e) => {
        if (!alive) {
          e.destroy();
          return;
        }
        created = e;
        e.setInsets(TOP_INSET, BOTTOM_INSET);
        const requested = params.get('mode');
        const initialMode = MODE_IDS.find((m) => m === requested) ?? usePlayStore.getState().mode;
        usePlayStore.getState().setMode(initialMode);
        const size = Math.min(300, Math.max(16, Number(params.get('size') ?? 150) || 150));
        const ref: ArtworkRef = {
          artworkId: `demo-sunset-${size}`,
          source: 'generator',
          title: 'Lac au coucher du soleil',
          grid: () => sunsetLake(size, size, 1),
        };
        artwork.current = ref;
        // captures et mesures : partie éphémère, sans base de données
        if (capture || params.has('nodb')) {
          bind(e.load(ref.grid(), getMode(initialMode)));
        } else {
          const db = await openDatabase();
          store.current = new ProgressStore(db);
          const m = await MetaService.open(db);
          meta.current = m;
          detachMeta = useMetaStore.getState().attach(m);
          if (import.meta.env.DEV) window.__meta = m;
          // un mode pas encore débloqué (lien direct, mode mémorisé) laisse la place au pixel
          const playable = m.unlockedModes.includes(initialMode) ? initialMode : 'pixel';
          usePlayStore.getState().setMode(playable);
          session.current = await openSession(e, store.current, ref, playable, m);
          watchCompletion(session.current);
          bind(session.current.game);
        }
        void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);
        window.__tessel = e;
        window.__bench = () => runBench(e);
        if (capture) window.__capture = installCapture(e, clock, params.get('capture') ?? '');
        setEngine(e);
      })
      .catch((err: unknown) => {
        void SplashScreen.hide().catch(() => undefined);
        setError(err instanceof Error ? err.message : String(err));
      });
    // sauvegarde immédiate à la mise en arrière-plan, son coupé
    const appState = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        void session.current?.flush();
        void created?.audio.suspend();
      } else void created?.audio.resume();
    });
    return () => {
      alive = false;
      void appState.then((h) => h.remove());
      void session.current?.close();
      session.current = null;
      detachMeta?.();
      void meta.current?.flush();
      created?.destroy();
    };
  }, [bind, watchCompletion]);

  /** Petit message passager (mode verrouillé, outil épuisé…). */
  const showHint = useCallback((text: string) => {
    setHint(text);
  }, []);
  useEffect(() => {
    if (hint === null) return;
    const h = setTimeout(() => {
      setHint(null);
    }, 2400);
    return () => {
      clearTimeout(h);
    };
  }, [hint]);

  /** Change de mode : chaque mode a sa propre progression sur la même œuvre. */
  const switchMode = async (m: ModeId) => {
    if (meta.current && !meta.current.isUnlocked(`mode:${m}`)) {
      const level = unlockLevel(`mode:${m}`) ?? 0;
      showHint(
        tr(
          t(
            `${MODE_LABELS[m]} se débloque au niveau ${level}`,
            `${MODE_LABELS[m]} unlocks at level ${level}`,
          ),
        ),
      );
      return;
    }
    setMode(m);
    if (!engine) return;
    const ref = artwork.current;
    if (!store.current || !ref) {
      engine.setMode(getMode(m));
      return;
    }
    await session.current?.close();
    session.current = await openSession(engine, store.current, ref, m, meta.current);
    watchCompletion(session.current);
    bind(session.current.game);
  };

  const useTool = (tool: ToolId) => {
    const sess = session.current;
    if (!sess) return;
    if ((meta.current?.tools(tool) ?? 0) <= 0) {
      showHint(
        tr(
          t(
            'Gagne des outils en montant de niveau et avec les quêtes',
            'Earn tools by leveling up and with quests',
          ),
        ),
      );
      return;
    }
    if (!sess.useTool(tool))
      showHint(tr(t('Rien à faire ici pour cet outil', 'Nothing to do here for this tool')));
  };

  /** Remplace la partie par la photo convertie ; le changement de mode continue de jouer sur cette photo. */
  const confirmImport = async ({ grid, mode: chosen, title }: ImportResult) => {
    setImportOpen(false);
    if (!engine) return;
    const ref: ArtworkRef = {
      artworkId: `photo:${crypto.randomUUID()}`,
      source: 'photo',
      title,
      grid: () => grid,
    };
    try {
      if (store.current) {
        const previous = session.current;
        session.current = null;
        await previous?.close();
        meta.current?.record('photos');
        session.current = await openSession(engine, store.current, ref, chosen, meta.current);
        watchCompletion(session.current);
        bind(session.current.game);
      } else {
        // partie éphémère (?nodb, capture) : pas de base de données
        bind(engine.load(grid, getMode(chosen)));
      }
    } catch (err) {
      console.error('Import de la photo impossible', err);
      return;
    }
    artwork.current = ref;
    setMode(chosen);
  };

  // développement : les tests automatisés ouvrent l'écran d'import sans passer par le sélecteur de fichier
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__importBlob = (blob) => {
      setImportPhoto(blob);
      setImportOpen(true);
    };
    return () => {
      delete window.__importBlob;
    };
  }, []);

  const palette = game?.grid.palette ?? [];

  return (
    <div className="play">
      <div className="play__canvas" ref={host} />
      {error && (
        <div className="fatal" role="alert">
          <strong>Impossible de démarrer le rendu</strong>
          <span>{error}</span>
        </div>
      )}
      <div className="topbar">
        <LevelChip
          onOpen={() => {
            setSheetOpen(true);
          }}
        />
        <div className="chip-group" role="group" aria-label="Mode">
          {MODE_IDS.map((m) => (
            <button
              key={m}
              className="chip"
              aria-pressed={mode === m}
              data-locked={!unlockedModes.includes(m)}
              onClick={() => {
                void switchMode(m);
              }}
            >
              {!unlockedModes.includes(m) && <IconLock size={13} />}
              {mode === m && (
                <motion.span
                  layoutId="mode-bg"
                  className="chip__bg"
                  transition={{ type: 'spring', ...spring.snappy }}
                />
              )}
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <div className="spacer" />
        {snapshot && (
          <div className="progress-pill" onDoubleClick={toggleHud}>
            {Math.floor(((snapshot.total - snapshot.left) / snapshot.total) * 100)} %
          </div>
        )}
        <motion.button
          className="icon-btn"
          aria-label="Importer une photo"
          disabled={!engine}
          whileTap={{ scale: 0.88 }}
          onClick={() => {
            setImportPhoto(null);
            setImportOpen(true);
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="M4 17.6l4.8-4.8a1.5 1.5 0 012.1 0l3.2 3.2 2-2a1.5 1.5 0 012.1 0l2.3 2.3" />
          </svg>
        </motion.button>
        <motion.button
          className="icon-btn"
          aria-label="Annuler"
          disabled={!canUndo}
          whileTap={{ scale: 0.88 }}
          onClick={() => game?.undo()}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
          </svg>
        </motion.button>
        <motion.button
          className="icon-btn"
          aria-label="Rétablir"
          disabled={!canRedo}
          whileTap={{ scale: 0.88 }}
          onClick={() => game?.redo()}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 14l5-5-5-5" />
            <path d="M20 9H9.5a5.5 5.5 0 000 11H13" />
          </svg>
        </motion.button>
      </div>
      {engine && showHud && <PerfHud engine={engine} />}
      <AnimatePresence>
        {(phase === 'finished' || phase === 'timelapse') && game && (
          <motion.div
            className="finish-panel"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', ...spring.sheet }}
          >
            <strong>Œuvre terminée</strong>
            {bonusXp !== null && bonusXp > 0 && (
              <motion.span
                className="finish-panel__xp"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', ...spring.bouncy }}
              >
                +{bonusXp} XP
              </motion.span>
            )}
            <div className="finish-panel__actions">
              <motion.button
                className="btn btn--primary"
                whileTap={{ scale: 0.94 }}
                disabled={phase === 'timelapse'}
                onClick={() => {
                  game.playTimelapse();
                }}
              >
                Revoir la création
              </motion.button>
              <motion.button
                className="btn"
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  game.restart();
                }}
              >
                Recommencer
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {game && phase === 'playing' && hasMeta && (
        <ToolDock armed={snapshot?.armed ?? null} disabled={false} onUse={useTool} />
      )}
      <AnimatePresence>
        {hint && (
          <motion.div
            key={hint}
            className="hint"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', ...spring.snappy }}
          >
            {hint}
          </motion.div>
        )}
      </AnimatePresence>
      <Toasts />
      <ProgressSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
        }}
      />
      {snapshot && game && phase === 'playing' && (
        <Palette
          palette={palette}
          remaining={snapshot.remaining}
          totals={snapshot.totals}
          selected={snapshot.selected}
          onSelect={(i) => {
            game.selectColor(i);
          }}
        />
      )}
      <ImportSheet
        open={importOpen}
        initialMode={mode}
        modes={unlockedModes}
        initialPhoto={importPhoto}
        onClose={() => {
          setImportOpen(false);
        }}
        onConfirm={(result) => {
          void confirmImport(result);
        }}
      />
    </div>
  );
}
