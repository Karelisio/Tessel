import { App as CapApp } from '@capacitor/app';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { SplashScreen } from '@capacitor/splash-screen';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getServices, useDataVersion } from '@/app/services';
import { sunsetLake } from '@/content/generators/sunsetLake';
import { installCapture, type CaptureApi } from '@/debug/capture';
import { runBench, type BenchResult } from '@/debug/bench';
import { openSession, type ArtworkRef, type PlaySession } from '@/db/session';
import { ManualClock } from '@/engine/Clock';
import { Engine } from '@/engine/Engine';
import type { Game } from '@/engine/Game';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import type { MetaService } from '@/meta/MetaService';
import { MODE_NAMES } from '@/meta/format';
import type { ToolId } from '@/meta/rewards';
import { CATALOG, catalogItem } from '@/meta/catalog';
import { unlockLevel } from '@/meta/unlocks';
import { getMode } from '@/modes';
import { texturesOf } from '@/modes/textures';
import { MODE_IDS, type ModeId } from '@/modes/types';
import { useMetaStore } from '@/store/meta';
import { useNav, type OpenRequest } from '@/store/nav';
import { usePlayStore } from '@/store/play';
import { useSettings } from '@/store/settings';
import { themeRgb } from '@/theme/applyTheme';
import { spring } from '@/theme/motion/tokens';
import { Sheet } from '@/ui/kit';
import { IconBack, IconMore } from '@/ui/kit/icons';
import { IconLock } from '@/ui/meta/icons';
import { ToolDock } from '@/ui/meta/ToolDock';
import '@/ui/meta/meta.css';
import { Minimap } from './Minimap';
import { Palette } from './Palette';
import { PerfHud } from './PerfHud';
import { SoundControls } from './SoundControls';
import { closeTo, openFrom } from './transition';

/** Ambiances du catalogue (pluie, feu…). */
const AMBIENCE_KEYS = CATALOG.map((i) => i.key).filter((k) => k.startsWith('ambience:'));

const TOP_INSET = 64;
const BOTTOM_INSET = 130;
/** Une main : barre du haut descendue au-dessus de la palette. */
const ONE_HAND_INSETS = [16, 186] as const;

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

function applyEngineSettings(engine: Engine): void {
  const s = useSettings.getState();
  engine.haptics.enabled = s.haptics;
  engine.particles.setQuality(s.quality);
  if (s.oneHanded) engine.setInsets(...ONE_HAND_INSETS);
  else engine.setInsets(TOP_INSET, BOTTOM_INSET);
  engine.setTextures(s.textures);
  engine.setAssist({
    colorblind: s.colorblind,
    ghost: s.ghost,
    highContrast: s.highContrast,
    numberScale: s.numberScale,
  });
}

function applyGameSettings(game: Game): void {
  const s = useSettings.getState();
  game.options.autoCorrect = s.autoCorrect;
  game.options.reducedMotion = s.reducedMotion;
}

/**
 * Écran de jeu, toujours monté sous la coque à onglets (le moteur reste prêt) :
 * il s'affiche quand une œuvre est ouverte (`useNav().open`).
 */
export function PlayScreen() {
  const host = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const gameRef = useRef<Game | null>(null);
  const session = useRef<PlaySession | null>(null);
  const current = useRef<ArtworkRef | null>(null);
  const [title, setTitle] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [bonusXp, setBonusXp] = useState<number | null>(null);
  const [modesOpen, setModesOpen] = useState(false);
  /** La fin d'œuvre revient d'une relecture (« Revoir la création ») : léger délai avant le panneau. */
  const [replayed, setReplayed] = useState(false);
  const unlockedModes = useMetaStore((st) => st.snap?.modes) ?? MODE_IDS;
  const hasMeta = useMetaStore((st) => st.service !== null);
  const playing = useNav((s) => s.playing);
  const leftHanded = useSettings((st) => st.leftHanded);
  const minimap = useSettings((st) => st.minimap);
  const oneHanded = useSettings((st) => st.oneHanded);
  const textures = useSettings((st) => st.textures);
  const ambience = useSettings((st) => st.ambience);
  const { snapshot, mode, showHud, canUndo, canRedo, phase, setSnapshot, setMode, setPhase, toggleHud } =
    usePlayStore();

  /** Branche une partie sur l'interface : instantané, phase, et partie courante. */
  const bind = useCallback(
    (g: Game) => {
      setBonusXp(null);
      setReplayed(false);
      g.onSnapshot = (s) => {
        setSnapshot(s, g.canUndo, g.canRedo);
      };
      g.onPhase = (p) => {
        setPhase(p);
        if (p === 'finished') useDataVersion.getState().bump();
      };
      setSnapshot(g.snapshot(), g.canUndo, g.canRedo);
      setPhase(g.phase);
      applyGameSettings(g);
      gameRef.current = g;
      setGame(g);
    },
    [setSnapshot, setPhase],
  );

  // moteur : créé une fois ; en capture ou sans base, une partie de démonstration éphémère
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
        window.__tessel = e;
        window.__bench = () => runBench(e);
        if (capture || params.has('nodb')) {
          const size = Math.min(300, Math.max(16, Number(params.get('size') ?? 150) || 150));
          const requested = MODE_IDS.find((m) => m === params.get('mode')) ?? 'pixel';
          usePlayStore.getState().setMode(requested);
          bind(e.load(sunsetLake(size, size, 1), getMode(requested)));
          setTitle('Lac au coucher du soleil');
          useNav.getState().setPlaying(true);
          if (capture) window.__capture = installCapture(e, clock, params.get('capture') ?? '');
        } else {
          const s = await getServices();
          if (import.meta.env.DEV) window.__meta = s.meta;
        }
        void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);
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
  }, [bind]);

  /** Ouvre une partie dans le mode voulu (le pixel si le mode n'est pas débloqué). */
  const start = useCallback(
    async (ref: ArtworkRef, wanted: ModeId) => {
      if (!engine) return;
      const { store, meta } = await getServices();
      const playable = meta.unlockedModes.includes(wanted) ? wanted : 'pixel';
      const previous = session.current;
      session.current = null;
      await previous?.close();
      if (ref.source === 'daily' && !(await store.findLatest(ref.artworkId, playable)))
        meta.record('daily.opened');
      const sess = await openSession(engine, store, ref, playable, meta);
      sess.onCompleted = (bonus) => {
        if (session.current === sess) setBonusXp(bonus);
      };
      session.current = sess;
      current.current = ref;
      bind(sess.game);
      setTitle(ref.title ?? '');
      setMode(playable);
      useDataVersion.getState().bump();
    },
    [engine, bind, setMode],
  );

  // demandes d'ouverture venues des onglets (bibliothèque, œuvre du jour, import…)
  useEffect(() => {
    if (!engine) return;
    const handle = (req: OpenRequest | null) => {
      if (!req) return;
      void start(req.ref, req.mode ?? usePlayStore.getState().mode)
        .then(() => {
          if (useNav.getState().request !== req) return;
          useNav.getState().setPlaying(true);
          const g = gameRef.current;
          if (req.timelapse && g?.phase === 'finished')
            setTimeout(() => {
              g.playTimelapse();
            }, 500);
        })
        .catch((err: unknown) => {
          console.error('Œuvre impossible à ouvrir', err);
        });
    };
    // une demande faite avant que le moteur soit prêt est servie tout de suite
    handle(useNav.getState().request);
    return useNav.subscribe((s, prev) => {
      if (s.request !== prev.request) handle(s.request);
    });
  }, [engine, start]);

  // réglages appliqués au moteur et à la partie (hors rendu React)
  useEffect(() => {
    if (!engine) return;
    const apply = () => {
      applyEngineSettings(engine);
      if (gameRef.current) applyGameSettings(gameRef.current);
      const s = useSettings.getState();
      const awake = useNav.getState().playing && s.keepAwake;
      void (awake ? KeepAwake.keepAwake() : KeepAwake.allowSleep()).catch(() => undefined);
    };
    apply();
    const offSettings = useSettings.subscribe(apply);
    // fond autour de l'œuvre accordé au thème
    const backdrop = () => {
      engine.setBackdrop(themeRgb('--canvas-bg'));
    };
    backdrop();
    window.addEventListener('tessel-theme', backdrop);
    // sortie du jeu : tout est écrit, les listes se rafraîchissent
    const offNav = useNav.subscribe((s, prev) => {
      if (s.playing === prev.playing) return;
      apply();
      // transition partagée depuis / vers la vignette touchée
      const el = root.current;
      if (el && !useSettings.getState().reducedMotion) {
        if (s.playing) openFrom(el, engine, s.request?.origin);
        else closeTo(el, s.request?.origin);
      }
      if (!s.playing)
        void session.current?.flush().then(() => {
          useDataVersion.getState().bump();
        });
    });
    return () => {
      window.removeEventListener('tessel-theme', backdrop);
      offSettings();
      offNav();
    };
  }, [engine]);

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
    if (hasMeta && !unlockedModes.includes(m)) {
      const level = unlockLevel(`mode:${m}`) ?? 0;
      showHint(
        tr(
          t(
            `${MODE_NAMES[m].fr} se débloque au niveau ${level}`,
            `${MODE_NAMES[m].en} unlocks at level ${level}`,
          ),
        ),
      );
      return;
    }
    setModesOpen(false);
    if (m === mode || !engine) return;
    const ref = current.current;
    if (!ref) {
      setMode(m);
      engine.setMode(getMode(m));
      return;
    }
    await start(ref, m);
  };

  const [sharing, setSharing] = useState(false);
  /** Partage l'œuvre terminée, encadrée, en image. */
  const shareCurrent = async () => {
    const id = session.current?.meta.id;
    if (!id || sharing) return;
    setSharing(true);
    try {
      const ex = await import('@/render/exports');
      const art = await ex.loadArtwork(id);
      const blob = await ex.canvasBlob(await ex.renderArtwork(art, { size: 1600 }));
      await ex.shareFile(blob, ex.fileName(art.title, 'png'), art.title);
    } catch (e) {
      console.error('Partage impossible', e);
      showHint(tr(t('Partage impossible pour le moment', 'Sharing is unavailable right now')));
    } finally {
      setSharing(false);
    }
  };

  const useTool = (tool: ToolId) => {
    const sess = session.current;
    if (!sess) return;
    const meta = useMetaStore.getState().service;
    if ((meta?.tools(tool) ?? 0) <= 0) {
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

  // développement : les tests automatisés ouvrent l'écran d'import sans passer par le sélecteur de fichier
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__importBlob = (blob) => {
      useNav.getState().openImport(blob);
    };
    return () => {
      delete window.__importBlob;
    };
  }, []);

  const palette = game?.grid.palette ?? [];
  const percent = snapshot ? Math.floor(((snapshot.total - snapshot.left) / snapshot.total) * 100) : 0;

  return (
    <div
      ref={root}
      className="play"
      data-active={playing}
      data-left={leftHanded}
      data-onehand={oneHanded}
      aria-hidden={!playing}
    >
      <div className="play__canvas" ref={host} />
      {error && (
        <div className="fatal" role="alert">
          <strong>{tr(t('Impossible de démarrer le rendu', 'Unable to start rendering'))}</strong>
          <span>{error}</span>
        </div>
      )}
      <div className="topbar">
        <motion.button
          className="icon-btn"
          aria-label={tr(t('Retour', 'Back'))}
          whileTap={{ scale: 0.88 }}
          onClick={() => {
            useNav.getState().closePlay();
          }}
        >
          <IconBack size={22} />
        </motion.button>
        <div className="play-title" onDoubleClick={toggleHud}>
          <strong>{title}</strong>
          {snapshot && (
            <span className="play-title__meta">
              <span>{percent} %</span>
              <span className="play-title__bar" aria-hidden>
                <motion.i
                  initial={false}
                  animate={{ scaleX: (snapshot.total - snapshot.left) / Math.max(1, snapshot.total) }}
                  transition={{ type: 'spring', ...spring.gentle }}
                />
              </span>
            </span>
          )}
        </div>
        <motion.button
          className="icon-btn"
          aria-label={tr(t('Annuler', 'Undo'))}
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
          aria-label={tr(t('Rétablir', 'Redo'))}
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
        <motion.button
          className="icon-btn"
          aria-label={tr(t('Mode de jeu', 'Game mode'))}
          whileTap={{ scale: 0.88 }}
          onClick={() => {
            setModesOpen(true);
          }}
        >
          <IconMore size={22} />
        </motion.button>
      </div>
      {engine && showHud && playing && <PerfHud engine={engine} />}
      <AnimatePresence>
        {/* masqué pendant « Revoir la création » : l'œuvre se reconstruit sans rien devant */}
        {phase === 'finished' && game && playing && (
          <motion.div
            className="finish-panel"
            initial={{ y: 40, opacity: 0 }}
            animate={{
              y: 0,
              opacity: 1,
              // au retour d'une relecture, l'œuvre finie reste seule un instant
              transition: { type: 'spring', ...spring.sheet, delay: replayed ? 0.8 : 0 },
            }}
            exit={{ y: 40, opacity: 0, transition: { type: 'spring', ...spring.sheet } }}
          >
            <strong>{tr(t('Œuvre terminée', 'Artwork complete'))}</strong>
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
                onClick={() => {
                  setReplayed(true);
                  game.playTimelapse();
                  useMetaStore.getState().service?.record('timelapses');
                }}
              >
                {tr(t('Revoir la création', 'Replay the creation'))}
              </motion.button>
              <motion.button
                className="btn"
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  setReplayed(false);
                  game.restart();
                }}
              >
                {tr(t('Recommencer', 'Start over'))}
              </motion.button>
            </div>
            <div className="finish-panel__actions finish-panel__actions--more">
              <motion.button
                className="btn btn--text"
                whileTap={{ scale: 0.94 }}
                disabled={sharing}
                onClick={() => {
                  void shareCurrent();
                }}
              >
                {sharing ? tr(t('Préparation…', 'Preparing…')) : tr(t('Partager', 'Share'))}
              </motion.button>
              <motion.button
                className="btn btn--text"
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  // l'œuvre rejoint le mur de la galerie
                  useNav.getState().closePlay();
                  useNav.getState().setTab('gallery');
                }}
              >
                {tr(t('Voir dans la galerie', 'See in the gallery'))}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {engine && game && minimap && phase === 'playing' && (
        <Minimap
          key={game.grid.cells.length + game.grid.width}
          engine={engine}
          game={game}
          left={leftHanded}
        />
      )}
      {game && phase === 'playing' && hasMeta && playing && (
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
      <Sheet
        open={modesOpen && playing}
        onClose={() => {
          setModesOpen(false);
        }}
        label={tr(t('Mode de jeu', 'Game mode'))}
      >
        <h3 className="modes-title">{tr(t('Mode de jeu', 'Game mode'))}</h3>
        <p className="modes-hint">
          {tr(
            t(
              'Chaque mode garde sa propre progression sur cette œuvre.',
              'Each mode keeps its own progress on this artwork.',
            ),
          )}
        </p>
        <div className="modes-grid">
          {MODE_IDS.map((m) => {
            const locked = hasMeta && !unlockedModes.includes(m);
            return (
              <motion.button
                key={m}
                className="mode-card"
                aria-pressed={mode === m}
                data-locked={locked}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  void switchMode(m);
                }}
              >
                <span className={`mode-card__swatch mode-card__swatch--${m}`} />
                <strong>{tr(MODE_NAMES[m])}</strong>
                {locked && (
                  <small>
                    <IconLock size={12} /> {tr(t('Niveau', 'Level'))} {unlockLevel(`mode:${m}`)}
                  </small>
                )}
              </motion.button>
            );
          })}
        </div>
        <h3 className="modes-title modes-title--sub">{tr(t('Matière', 'Material'))}</h3>
        <div className="texture-chips" role="radiogroup" aria-label={tr(t('Matière', 'Material'))}>
          {texturesOf(mode).map((tx, i) => {
            const locked = hasMeta && !(useMetaStore.getState().service?.isUnlocked(tx.key) ?? true);
            const active = (textures[mode] ?? texturesOf(mode)[0]?.key) === tx.key;
            const name = catalogItem(tx.key)?.name;
            return (
              <motion.button
                key={tx.key}
                role="radio"
                aria-checked={active}
                className="texture-chip"
                data-locked={locked}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  if (locked) {
                    const level = unlockLevel(tx.key) ?? 0;
                    showHint(tr(t(`Se débloque au niveau ${level}`, `Unlocks at level ${level}`)));
                    return;
                  }
                  useSettings.getState().set({ textures: { ...textures, [mode]: tx.key } });
                }}
              >
                {locked && <IconLock size={12} />}
                {name ? tr(name) : String(i + 1)}
              </motion.button>
            );
          })}
        </div>
        <h3 className="modes-title modes-title--sub">{tr(t('Ambiance sonore', 'Ambient sound'))}</h3>
        <div
          className="texture-chips"
          role="radiogroup"
          aria-label={tr(t('Ambiance sonore', 'Ambient sound'))}
        >
          {['', ...AMBIENCE_KEYS].map((key) => {
            const locked =
              key !== '' &&
              hasMeta &&
              !(useMetaStore.getState().service?.isUnlocked(key as `ambience:${string}`) ?? true);
            const name = key ? catalogItem(key as `ambience:${string}`)?.name : undefined;
            return (
              <motion.button
                key={key || 'none'}
                role="radio"
                aria-checked={ambience === key}
                className="texture-chip"
                data-locked={locked}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  if (locked) {
                    const level = unlockLevel(key as `ambience:${string}`) ?? 0;
                    showHint(tr(t(`Se débloque au niveau ${level}`, `Unlocks at level ${level}`)));
                    return;
                  }
                  useSettings.getState().set({ ambience: key });
                }}
              >
                {locked && <IconLock size={12} />}
                {name ? tr(name) : tr(t('Aucune', 'None'))}
              </motion.button>
            );
          })}
        </div>
        <h3 className="modes-title modes-title--sub">{tr(t('Volume', 'Volume'))}</h3>
        <SoundControls />
      </Sheet>
    </div>
  );
}
