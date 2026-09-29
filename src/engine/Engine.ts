import { Application, type BufferImageSource } from 'pixi.js';
import { AudioEngine } from '@/audio/AudioEngine';
import { HapticsEngine } from '@/audio/haptics';
import type { Grid } from '@/content/grid';
import { ParticleFx, type Quality } from '@/fx/Particles';
import type { ModeDefinition } from '@/modes/types';
import { Camera } from './Camera';
import { realClock, type Clock } from './Clock';
import { NUMBER_FONT, createDigitAtlas } from './digits';
import { Game } from './Game';
import { Gestures } from './Gestures';
import { GridRenderer } from './GridRenderer';
import { PerfMonitor } from './PerfMonitor';
import { Tilt } from './Tilt';

/** Aides visuelles de la grille (réglages). */
export interface GridAssist {
  colorblind: boolean;
  /** Intensité de l'aperçu des couleurs sur les cases vides (0–2). */
  ghost: number;
  highContrast: boolean;
  /** Taille des numéros (1 = normale). */
  numberScale: number;
}

const RESOLUTION_CAP: Record<Quality, number> = { low: 1.25, medium: 1.6, high: 2 };

export interface EngineOptions {
  quality?: Quality;
  clock?: Clock;
  /** Pas de boucle rAF : le rendu est piloté par `step()` (tests, capture vidéo). */
  manual?: boolean;
}

/**
 * Hôte du rendu : un seul contexte WebGL2 partagé, boucle de rendu à la demande
 * (on ne dessine que si la caméra, une animation, une particule ou la lumière change).
 */
export class Engine {
  readonly camera = new Camera();
  readonly perf = new PerfMonitor();
  readonly audio = new AudioEngine();
  readonly haptics = new HapticsEngine();
  readonly tilt = new Tilt();
  readonly particles: ParticleFx;
  renderer: GridRenderer | null = null;
  game: Game | null = null;
  gestures: Gestures | null = null;

  private readonly clock: Clock;
  private readonly manual: boolean;
  private readonly quality: Quality;
  private digits: BufferImageSource | null = null;
  private raf = 0;
  private lastFrame = -1;
  private dirty = true;
  private resizeObserver: ResizeObserver | null = null;
  private insets = { top: 0, bottom: 0 };
  private readonly startedAt: number;
  private assist: GridAssist = { colorblind: false, ghost: 1, highContrast: false, numberScale: 1 };
  private backdrop: readonly [number, number, number] | null = null;
  private readonly cameraListeners = new Set<() => void>();
  private lastCamera: [number, number, number] = [0, 0, 0];

  private constructor(
    readonly app: Application,
    private readonly host: HTMLElement,
    opts: EngineOptions,
  ) {
    this.clock = opts.clock ?? realClock;
    this.manual = opts.manual ?? false;
    this.quality = opts.quality ?? 'high';
    this.particles = new ParticleFx(this.quality);
    this.startedAt = this.clock.now();
  }

  static async create(host: HTMLElement, opts: EngineOptions = {}): Promise<Engine> {
    const quality = opts.quality ?? 'high';
    // la police des numéros doit être prête avant de générer l'atlas SDF
    await document.fonts.load(`800 46px ${NUMBER_FONT}`).catch(() => undefined);
    const app = new Application();
    await app.init({
      preference: 'webgl',
      preferWebGLVersion: 2,
      antialias: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, RESOLUTION_CAP[quality]),
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      backgroundColor: 0xf3eee9,
      autoStart: false,
      sharedTicker: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: opts.manual ?? false,
      hello: false,
    });
    app.ticker.stop();
    const canvas = app.canvas;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    host.appendChild(canvas);
    const engine = new Engine(app, host, opts);
    engine.observeSize();
    void engine.tilt.start();
    if (!engine.manual) engine.raf = requestAnimationFrame(engine.loop);
    return engine;
  }

  /** Charge une grille dans un mode ; remplace la partie en cours. */
  load(grid: Grid, mode: ModeDefinition): Game {
    this.unload();
    this.digits ??= createDigitAtlas();
    const renderer = new GridRenderer(grid, mode, this.digits);
    this.renderer = renderer;
    this.applyAssist();
    this.camera.setGrid(grid.width, grid.height);
    this.app.stage.addChild(renderer.view, this.particles.world, this.particles.screen);
    this.applySize();
    this.camera.fit();
    const game = new Game(grid, mode, this.camera, renderer, this.particles, this.audio, this.haptics);
    game.onChangeRequest = () => {
      this.dirty = true;
    };
    this.game = game;
    this.gestures = new Gestures(this.app.canvas, this.camera, game);
    this.dirty = true;
    return game;
  }

  unload(): void {
    this.gestures?.destroy();
    this.gestures = null;
    this.game = null;
    if (this.renderer) {
      this.app.stage.removeChildren();
      this.renderer.destroy();
      this.renderer = null;
    }
    this.particles.clear();
  }

  setMode(mode: ModeDefinition): void {
    this.game?.setMode(mode);
    this.dirty = true;
  }

  setAssist(assist: GridAssist): void {
    this.assist = assist;
    this.applyAssist();
  }

  /** Fond autour de l'œuvre, accordé au thème (null : celui du mode). */
  setBackdrop(rgb: readonly [number, number, number] | null): void {
    this.backdrop = rgb;
    this.renderer?.setBackdrop(rgb);
    this.dirty = true;
  }

  /** Prévient à chaque mouvement de caméra (minicarte, radar). */
  onCamera(listener: () => void): () => void {
    this.cameraListeners.add(listener);
    return () => {
      this.cameraListeners.delete(listener);
    };
  }

  private applyAssist(): void {
    const r = this.renderer;
    if (!r) return;
    const a = this.assist;
    r.setAssist(a.colorblind, a.ghost, a.highContrast);
    r.setNumberScale(a.numberScale);
    if (this.backdrop) r.setBackdrop(this.backdrop);
    this.dirty = true;
  }

  /** Espace occupé par l'interface en haut et en bas (px CSS). */
  setInsets(top: number, bottom: number): void {
    this.insets = { top, bottom };
    this.applySize();
  }

  invalidate(): void {
    this.dirty = true;
  }

  /** Temps moteur en secondes. */
  get time(): number {
    return (this.clock.now() - this.startedAt) / 1000;
  }

  /** Une frame complète (utilisée par la boucle rAF et par la capture pas à pas). */
  step(): boolean {
    const t0 = performance.now();
    const now = this.clock.now();
    const dt = this.lastFrame < 0 ? 1 / 60 : Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    const frameMs = this.lastFrame < 0 ? 16.7 : now - this.lastFrame;
    this.lastFrame = now;
    const time = this.time;

    let needs = this.dirty;
    this.dirty = false;
    if (this.camera.update(dt)) needs = true;
    if (this.camera.isAnimating) needs = true;
    const r = this.renderer;
    if (r) {
      if (this.game?.tick(time)) needs = true;
      if (r.currentMode.usesLight) {
        if (this.tilt.update(dt, true)) {
          r.setLight(this.tilt.light[0], this.tilt.light[1], this.tilt.light[2]);
          needs = true;
        }
      }
      r.setTime(time);
      r.syncCamera(this.camera);
      if (r.update(time)) needs = true;
    }
    if (this.particles.active) {
      this.particles.update(dt);
      needs = true;
    }
    this.particles.syncCamera(this.camera.tx, this.camera.ty, this.camera.scale);
    const cam = this.lastCamera;
    if (cam[0] !== this.camera.tx || cam[1] !== this.camera.ty || cam[2] !== this.camera.scale) {
      this.lastCamera = [this.camera.tx, this.camera.ty, this.camera.scale];
      for (const l of this.cameraListeners) l();
    }
    if (needs) this.app.renderer.render(this.app.stage);
    this.perf.record(frameMs, performance.now() - t0, needs);
    return needs;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.tilt.stop();
    this.unload();
    this.app.destroy(true, { children: true });
  }

  private readonly loop = () => {
    this.step();
    this.raf = requestAnimationFrame(this.loop);
  };

  private observeSize(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.applySize();
    });
    this.resizeObserver.observe(this.host);
  }

  private applySize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    if (this.app.renderer.width !== w || this.app.renderer.height !== h) this.app.renderer.resize(w, h);
    this.renderer?.resize(w, h, this.app.renderer.resolution);
    this.camera.setViewport({
      width: w,
      height: h,
      insetTop: this.insets.top,
      insetBottom: this.insets.bottom,
    });
    this.dirty = true;
  }
}
