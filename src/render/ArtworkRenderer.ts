import { Application, type BufferImageSource } from 'pixi.js';
import type { Bitset } from '@/content/progress';
import { TRANSPARENT, type Grid } from '@/content/grid';
import { createDigitAtlas, NUMBER_FONT } from '@/engine/digits';
import { CellState, GridRenderer } from '@/engine/GridRenderer';
import { FRAME_RATIO } from '@/fx/finaleTimeline';
import { textureSpec } from '@/modes/textures';
import type { ModeDefinition } from '@/modes/types';

/** Texture maximale sûre sur les GPU mobiles. */
export const MAX_RENDER_SIDE = 4096;

export interface RenderOptions {
  grid: Grid;
  mode: ModeDefinition;
  /** Cases posées (null : toutes). */
  filled?: Bitset | null;
  /** Encadrée (passe-partout + cadre, état final de la cinématique) ou œuvre seule. */
  framed?: boolean;
  /** Cadre (`frame:…`), null = celui du mode. */
  frame?: string | null;
  /** Plus grand côté de l'image (px). */
  size: number;
  /** Fond autour de l'œuvre (rgb 0–1) ; celui du mode par défaut. */
  background?: readonly [number, number, number];
  /** Marge autour du cadre, en fraction du plus grand côté de la grille (ombre portée). */
  margin?: number;
  /** Matière du mode (`texture:…`), la matière de base sinon. */
  texture?: string | null;
  /** Fond transparent autour de l'œuvre encadrée (mur de galerie). */
  transparent?: boolean;
}

/** Étendue (en cases) occupée par l'œuvre encadrée ou non, marge comprise. */
export function renderExtent(
  grid: Grid,
  framed: boolean,
  margin: number,
): { w: number; h: number; pad: number } {
  const big = Math.max(grid.width, grid.height);
  const pad = (framed ? (FRAME_RATIO.mat + FRAME_RATIO.frame) * big : 0) + margin * big;
  return { w: grid.width + 2 * pad, h: grid.height + 2 * pad, pad };
}

/**
 * Rendu hors écran des œuvres (galerie, exports, fonds d'écran, timelapse) avec les mêmes shaders
 * que le jeu, dans un contexte WebGL séparé : la partie à l'écran n'est jamais perturbée.
 */
export class ArtworkRenderer {
  private static instance: Promise<ArtworkRenderer> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly app: Application,
    private readonly digits: BufferImageSource,
  ) {}

  /** Moteur partagé, créé à la première utilisation. */
  static get(): Promise<ArtworkRenderer> {
    ArtworkRenderer.instance ??= (async () => {
      await document.fonts.load(`800 46px ${NUMBER_FONT}`).catch(() => undefined);
      const app = new Application();
      await app.init({
        preference: 'webgl',
        preferWebGLVersion: 2,
        antialias: false,
        autoDensity: false,
        resolution: 1,
        width: 64,
        height: 64,
        autoStart: false,
        sharedTicker: false,
        preserveDrawingBuffer: true,
        backgroundAlpha: 0,
        hello: false,
      });
      app.ticker.stop();
      return new ArtworkRenderer(app, createDigitAtlas());
    })();
    return ArtworkRenderer.instance;
  }

  /** Les rendus passent un par un (un seul contexte). */
  private exclusive<T>(job: () => Promise<T> | T): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Rend une image fixe de l'œuvre dans un canvas 2D (copie, réutilisable librement). */
  render(opts: RenderOptions): Promise<HTMLCanvasElement> {
    return this.exclusive(() => {
      const scene = this.scene(opts);
      try {
        scene.draw();
        return this.copy(scene.width, scene.height);
      } finally {
        scene.dispose();
      }
    });
  }

  /**
   * Scène réutilisable pour une suite d'images (timelapse) : `setFilled` puis `draw`, et `capture`
   * pour récupérer l'image courante. À libérer avec `dispose`.
   */
  sequence<T>(opts: RenderOptions, run: (scene: Scene) => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      const scene = this.scene(opts);
      try {
        return await run(scene);
      } finally {
        scene.dispose();
      }
    });
  }

  private scene(opts: RenderOptions): Scene {
    const { grid, mode } = opts;
    const framed = opts.framed ?? true;
    const margin = opts.margin ?? (framed ? 0.07 : 0);
    const ext = renderExtent(grid, framed, margin);
    const side = Math.min(MAX_RENDER_SIDE, Math.max(16, Math.round(opts.size)));
    const scale = side / Math.max(ext.w, ext.h);
    // dimensions paires (encodeurs vidéo)
    const width = Math.max(2, Math.round((ext.w * scale) / 2) * 2);
    const height = Math.max(2, Math.round((ext.h * scale) / 2) * 2);
    const app = this.app;
    app.renderer.resize(width, height);

    const r = new GridRenderer(grid, mode, this.digits);
    r.setFrame(opts.frame ?? null);
    r.setTexture(textureSpec(mode.id, opts.texture));
    if (opts.background) r.setBackdrop(opts.background);
    r.setTransparentOutside(opts.transparent ?? false);
    r.resize(width, height, 1);
    r.syncCamera({ tx: ext.pad * scale, ty: ext.pad * scale, scale });
    // état final de la cinématique : cadre construit, effets du mode achevés, balayage passé
    r.setTime(1000);
    r.setFinale(framed ? 0 : -1);
    const setFilled = (filled: Bitset | null | undefined, upTo?: number, order?: readonly number[]) => {
      if (order && upTo !== undefined) {
        r.clearAll();
        for (let k = 0; k < upTo && k < order.length; k++) r.setCell(order[k] ?? 0, CellState.Filled);
        return;
      }
      for (let i = 0; i < grid.cells.length; i++) {
        if (grid.cells[i] === TRANSPARENT) continue;
        r.setCell(i, !filled || filled.get(i) ? CellState.Filled : CellState.Empty);
      }
    };
    setFilled(opts.filled);
    app.stage.addChild(r.view);

    return {
      width,
      height,
      renderer: r,
      setFilled,
      setFinale: (seconds) => {
        // secondes écoulées depuis le début de la cinématique (< 0 : pas de cinématique)
        r.setTime(1000);
        r.setFinale(seconds < 0 ? -1 : 1000 - seconds);
      },
      draw: () => {
        r.update(1000);
        app.renderer.render(app.stage);
      },
      capture: () => app.canvas,
      dispose: () => {
        app.stage.removeChild(r.view);
        r.destroy();
      },
    };
  }

  private copy(width: number, height: number): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    out.getContext('2d')?.drawImage(this.app.canvas, 0, 0);
    return out;
  }
}

export interface Scene {
  readonly width: number;
  readonly height: number;
  readonly renderer: GridRenderer;
  /** Cases posées : un masque, ou les `upTo` premières poses de `order` (timelapse). */
  setFilled(filled: Bitset | null | undefined, upTo?: number, order?: readonly number[]): void;
  /** Avancement de la cinématique de fin (s depuis son début ; < 0 : aucune). */
  setFinale(seconds: number): void;
  draw(): void;
  /** Canvas WebGL courant (valide jusqu'au prochain `draw`). */
  capture(): HTMLCanvasElement;
  dispose(): void;
}
