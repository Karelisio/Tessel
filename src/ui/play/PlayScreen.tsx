import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { sunsetLake } from '@/content/generators/sunsetLake';
import { installCapture, type CaptureApi } from '@/debug/capture';
import { runBench, type BenchResult } from '@/debug/bench';
import { ManualClock } from '@/engine/Clock';
import { openDatabase } from '@/db';
import { ProgressStore } from '@/db/ProgressStore';
import { openSession, type ArtworkRef, type PlaySession } from '@/db/session';
import { Engine } from '@/engine/Engine';
import type { Game } from '@/engine/Game';
import { getMode } from '@/modes';
import type { ModeId } from '@/modes/types';
import { usePlayStore } from '@/store/play';
import { spring } from '@/theme/motion/tokens';
import { Palette } from './Palette';
import { PerfHud } from './PerfHud';

const TOP_INSET = 64;
const BOTTOM_INSET = 130;

declare global {
  interface Window {
    __tessel?: Engine;
    __capture?: CaptureApi;
    __bench?: () => Promise<BenchResult[]>;
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
  const { snapshot, mode, showHud, canUndo, canRedo, phase, setSnapshot, setMode, setPhase, toggleHud } =
    usePlayStore();

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let alive = true;
    let created: Engine | null = null;
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
        const bind = (g: Game) => {
          g.onSnapshot = (s) => {
            setSnapshot(s, g.canUndo, g.canRedo);
          };
          g.onPhase = setPhase;
          setPhase(g.phase);
          setGame(g);
        };
        // captures et mesures : partie éphémère, sans base de données
        if (capture || params.has('nodb')) {
          bind(e.load(ref.grid(), getMode(initialMode)));
        } else {
          const db = await openDatabase();
          store.current = new ProgressStore(db);
          session.current = await openSession(e, store.current, ref, initialMode);
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
      created?.destroy();
    };
  }, [setSnapshot, setPhase]);

  /** Change de mode : chaque mode a sa propre progression sur la même œuvre. */
  const switchMode = async (m: ModeId) => {
    setMode(m);
    if (!engine) return;
    const ref = artwork.current;
    if (!store.current || !ref) {
      engine.setMode(getMode(m));
      return;
    }
    await session.current?.close();
    session.current = await openSession(engine, store.current, ref, m);
    const g = session.current.game;
    g.onSnapshot = (s) => {
      setSnapshot(s, g.canUndo, g.canRedo);
    };
    g.onPhase = setPhase;
    setPhase(g.phase);
    setGame(g);
  };

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
        <div className="chip-group" role="group" aria-label="Mode">
          {MODE_IDS.map((m) => (
            <button
              key={m}
              className="chip"
              aria-pressed={mode === m}
              onClick={() => {
                void switchMode(m);
              }}
            >
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
    </div>
  );
}
