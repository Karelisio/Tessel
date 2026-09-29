import type { AudioEngine } from '@/audio/AudioEngine';
import type { HapticsEngine } from '@/audio/haptics';
import { TRANSPARENT, type Grid, type Rgb } from '@/content/grid';
import { PlaceResult, Progress, type Bitset } from '@/content/progress';
import { Op } from '@/db/codecs';
import { FINALE, FRAME_RATIO } from '@/fx/finaleTimeline';
import type { ParticleFx } from '@/fx/Particles';
import type { ToolId } from '@/meta/rewards';
import type { ModeDefinition } from '@/modes/types';
import { READABLE_CELL_PX, type Camera } from './Camera';
import { FeedbackBus, type FeedbackEvent } from './feedback';
import type { GestureHandlers } from './Gestures';
import { CellState, type GridRenderer } from './GridRenderer';
import { traverseCells } from './raster';

/** Taille minimale d'une case (px CSS) pour qu'un glissé à un doigt peigne au lieu de déplacer. */
const MIN_PAINT_CELL_PX = 12;
const MAX_UNDO = 200;
/** Intervalle minimal entre deux mises à jour de l'interface React (s) : compteurs fluides, sans coût par frame. */
const SNAPSHOT_INTERVAL = 0.1;

export interface GameSnapshot {
  readonly remaining: readonly number[];
  readonly totals: readonly number[];
  readonly selected: number;
  readonly left: number;
  readonly total: number;
  /** Outil armé (pot de peinture). */
  readonly armed: 'bucket' | null;
}

export type GamePhase = 'playing' | 'finale' | 'finished' | 'timelapse';

export interface GameOptions {
  autoCorrect: boolean;
  reducedMotion: boolean;
}

interface Scheduled {
  at: number;
  run: () => void;
}

/** Pose en vague déclenchée par un outil (pot, baguette) : les cases apparaissent par distance. */
interface Reveal {
  tool: ToolId;
  color: number;
  cells: number[];
  /** Distance de chaque case à l'origine, croissante. */
  dist: Float32Array;
  start: number;
  duration: number;
  done: number;
  lastFx: number;
}

/** Au-delà, les cases d'une vague se posent sans animation individuelle (le pool reste disponible). */
const REVEAL_ANIM_BUDGET = 360;

function rgbToNumber([r, g, b]: Rgb): number {
  return (r << 16) | (g << 8) | b;
}

function lighten([r, g, b]: Rgb, k: number): number {
  const l = (c: number) => Math.round(c + (255 - c) * k);
  return (l(r) << 16) | (l(g) << 8) | l(b);
}

/**
 * Logique d'une partie : traduit les gestes en poses, met à jour la progression,
 * déclenche rendu, particules, son et haptique de façon synchronisée.
 */
export class Game implements GestureHandlers {
  progress: Progress;
  readonly feedback = new FeedbackBus();
  selected = 0;
  options: GameOptions = { autoCorrect: true, reducedMotion: false };
  onSnapshot: ((s: GameSnapshot) => void) | null = null;
  onChangeRequest: (() => void) | null = null;
  onPhase: ((phase: GamePhase) => void) | null = null;
  /** Chaque pose ou annulation, dans l'ordre (sauvegarde incrémentale). */
  onOp: ((op: Op, index: number) => void) | null = null;
  /** La partie a été recommencée à zéro. */
  onRestart: (() => void) | null = null;
  /** Un trait a été annulé (succès « sans retour »). */
  onUndo: (() => void) | null = null;
  /** Un outil vient de servir (`cells` = cases posées par l'outil). */
  onToolUsed: ((tool: ToolId, cells: number) => void) | null = null;
  /** Outil armé : le prochain tap l'applique (pot de peinture). */
  armedTool: 'bucket' | null = null;
  private readonly phaseListeners = new Set<(phase: GamePhase) => void>();

  private mode: ModeDefinition;
  private paintLast: [number, number] | null = null;
  private paintScreen: [number, number] | null = null;
  private currentStroke: number[] = [];
  private readonly undoStack: number[][] = [];
  private readonly redoStack: number[][] = [];
  private readonly shaken = new Set<number>();
  private readonly scheduled: Scheduled[] = [];
  private dirtySnapshot = true;
  private lastSnapshot = -Infinity;
  private time = 0;
  private phaseValue: GamePhase = 'playing';
  /** Ordre de pose (sans les poses annulées) : sert au timelapse. */
  private readonly history: number[] = [];
  private replay: { start: number; duration: number; done: number } | null = null;
  private lastReplaySound = -Infinity;
  private reveal: Reveal | null = null;

  constructor(
    readonly grid: Grid,
    mode: ModeDefinition,
    private readonly camera: Camera,
    private readonly renderer: GridRenderer,
    private readonly particles: ParticleFx,
    private readonly audio: AudioEngine,
    private readonly haptics: HapticsEngine,
  ) {
    this.mode = mode;
    this.progress = new Progress(grid);
    this.selected = this.firstRemainingColor(0);
    this.renderer.setSelected(this.selected, -10);
    this.feedback.on((e) => {
      this.onFeedback(e);
    });
  }

  get currentMode(): ModeDefinition {
    return this.mode;
  }

  setMode(mode: ModeDefinition): void {
    this.mode = mode;
    this.renderer.setMode(mode);
  }

  get phase(): GamePhase {
    return this.phaseValue;
  }

  private setPhase(phase: GamePhase): void {
    this.phaseValue = phase;
    this.onPhase?.(phase);
    for (const l of this.phaseListeners) l(phase);
    this.onChangeRequest?.();
  }

  addPhaseListener(l: (phase: GamePhase) => void): () => void {
    this.phaseListeners.add(l);
    return () => this.phaseListeners.delete(l);
  }

  /**
   * Restaure une partie sauvegardée : cases posées et ordre des poses (timelapse).
   * Une œuvre déjà terminée s'affiche directement encadrée.
   */
  restore(filled: Bitset, history: readonly number[]): void {
    this.progress = new Progress(this.grid, filled);
    this.history.length = 0;
    this.history.push(...history);
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    for (let i = 0; i < this.grid.cells.length; i++) {
      if (filled.get(i) && this.grid.cells[i] !== TRANSPARENT) this.renderer.setCell(i, CellState.Filled);
    }
    this.selected = this.firstRemainingColor(0);
    this.renderer.setSelected(this.selected, this.time);
    this.dirtySnapshot = true;
    if (this.progress.complete) {
      this.renderer.setSelected(-1, this.time);
      this.renderer.setNumberScale(0);
      this.renderer.setFinale(this.time - FINALE.done);
      const framed = this.framedScale();
      this.camera.minScaleFactor = framed / this.camera.fitScale;
      this.camera.flyTo(this.grid.width / 2, this.grid.height / 2, framed);
      this.setPhase('finished');
    }
    this.onChangeRequest?.();
  }

  /** Temps courant (s), fourni par le moteur à chaque frame. */
  tick(time: number): boolean {
    this.time = time;
    if (this.replay) this.stepReplay();
    if (this.reveal) this.stepReveal();
    for (let i = this.scheduled.length - 1; i >= 0; i--) {
      const s = this.scheduled[i];
      if (s && s.at <= time) {
        this.scheduled.splice(i, 1);
        s.run();
      }
    }
    if (this.dirtySnapshot && time - this.lastSnapshot >= SNAPSHOT_INTERVAL) {
      this.dirtySnapshot = false;
      this.lastSnapshot = time;
      this.onSnapshot?.(this.snapshot());
    }
    return this.scheduled.length > 0 || this.dirtySnapshot || this.replay !== null || this.reveal !== null;
  }

  snapshot(): GameSnapshot {
    return {
      remaining: Array.from(this.progress.remaining),
      totals: Array.from(this.progress.totals),
      selected: this.selected,
      left: this.progress.left,
      total: this.progress.total,
      armed: this.armedTool,
    };
  }

  selectColor(color: number): void {
    if (color < 0 || color >= this.grid.palette.length || color === this.selected) return;
    this.selected = color;
    this.renderer.setSelected(color, this.time);
    this.haptics.soft();
    this.dirtySnapshot = true;
    this.onChangeRequest?.();
  }

  // --- Gestes -------------------------------------------------------------

  canPaintAt(sx: number, sy: number): boolean {
    if (this.phaseValue !== 'playing' || this.armedTool !== null || this.reveal) return false;
    if (this.camera.scale < MIN_PAINT_CELL_PX) return false;
    const i = this.indexAt(sx, sy);
    return i >= 0 && this.progress.check(i, this.selected) === PlaceResult.Placed;
  }

  onTap(sx: number, sy: number): boolean {
    void this.audio.unlock();
    const i = this.indexAt(sx, sy);
    if (i < 0 || this.reveal) return false;
    if (this.armedTool === 'bucket') {
      this.useBucketAt(i);
      return true;
    }
    this.currentStroke = [];
    const placed = this.tryPlace(i, false, true);
    this.commitStroke();
    return placed;
  }

  onDoubleTap(sx: number, sy: number): void {
    this.camera.toggleZoomAt(sx, sy);
  }

  onLongPress(): void {
    this.haptics.pulse('click', this.time * 1000);
  }

  onPaintStart(sx: number, sy: number): void {
    void this.audio.unlock();
    this.currentStroke = [];
    this.shaken.clear();
    this.paintLast = this.camera.screenToCell(sx, sy);
    this.paintScreen = [sx, sy];
    const [cx, cy] = this.paintLast;
    this.visitCell(Math.floor(cx), Math.floor(cy));
  }

  onPaintMove(sx: number, sy: number): void {
    if (!this.paintLast || !this.paintScreen) return;
    const next = this.camera.screenToCell(sx, sy);
    const [x0, y0] = this.paintLast;
    let first = true;
    traverseCells(x0, y0, next[0], next[1], (cx, cy) => {
      if (first) {
        first = false; // déjà traitée au mouvement précédent
        return;
      }
      this.visitCell(cx, cy);
    });
    this.emitTrail(this.paintScreen[0], this.paintScreen[1], sx, sy);
    this.paintLast = next;
    this.paintScreen = [sx, sy];
  }

  onPaintEnd(): void {
    this.paintLast = null;
    this.paintScreen = null;
    this.commitStroke();
  }

  onChange(): void {
    this.onChangeRequest?.();
  }

  // --- Annuler / rétablir ---------------------------------------------------

  undo(): void {
    if (this.phaseValue !== 'playing' || this.reveal) return;
    const stroke = this.undoStack.pop();
    if (!stroke) return;
    this.onUndo?.();
    for (const i of stroke) {
      if (this.progress.unplace(i)) {
        this.renderer.setCell(i, CellState.Empty);
        this.onOp?.(Op.Unplace, i);
      }
    }
    // le trait annulé est le plus récent : il occupe la fin de l'historique
    this.history.length = Math.max(0, this.history.length - stroke.length);
    this.redoStack.push(stroke);
    this.dirtySnapshot = true;
    this.haptics.soft();
    this.onChangeRequest?.();
  }

  redo(): void {
    if (this.phaseValue !== 'playing' || this.reveal) return;
    const stroke = this.redoStack.pop();
    if (!stroke) return;
    for (const i of stroke) {
      const color = this.grid.cells[i] ?? TRANSPARENT;
      if (this.progress.place(i, color) === PlaceResult.Placed) {
        this.renderer.setCell(i, CellState.Filled);
        this.history.push(i);
        this.onOp?.(Op.Place, i);
      }
    }
    this.undoStack.push(stroke);
    this.dirtySnapshot = true;
    this.haptics.soft();
    this.onChangeRequest?.();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Pose directe (debug, outils) sans passer par un geste. */
  placeIndex(i: number, drag = false): boolean {
    const color = this.grid.cells[i] ?? TRANSPARENT;
    if (color === TRANSPARENT) return false;
    if (color !== this.selected) this.selectColor(color);
    this.currentStroke = [];
    const ok = this.tryPlace(i, drag, false);
    this.commitStroke();
    return ok;
  }

  // --- Outils ----------------------------------------------------------------

  /** Arme (ou désarme) le pot de peinture : le prochain tap remplit la zone touchée. */
  armBucket(on: boolean): void {
    const next = on && this.phaseValue === 'playing' ? 'bucket' : null;
    if (next === this.armedTool) return;
    this.armedTool = next;
    this.haptics.soft();
    this.dirtySnapshot = true;
    this.onChangeRequest?.();
  }

  /**
   * Pot de peinture : remplit toute la zone contiguë (4-voisins) de la couleur de la case touchée,
   * en vague depuis le doigt. Renvoie le nombre de cases posées (0 : rien à remplir).
   */
  fillRegionAt(index: number): number {
    if (this.phaseValue !== 'playing' || this.reveal) return 0;
    const color = this.grid.cells[index] ?? TRANSPARENT;
    if (color === TRANSPARENT) return 0;
    const { width, height } = this.grid;
    const seen = new Uint8Array(this.grid.cells.length);
    const queue = new Int32Array(this.grid.cells.length);
    const depth = new Float32Array(this.grid.cells.length);
    const cells: number[] = [];
    const dist: number[] = [];
    let head = 0;
    let tail = 0;
    queue[tail++] = index;
    seen[index] = 1;
    while (head < tail) {
      const i = queue[head++] ?? 0;
      const d = depth[i] ?? 0;
      if (!this.progress.filled.get(i)) {
        cells.push(i);
        dist.push(d);
      }
      const x = i % width;
      const y = (i - x) / width;
      const visit = (j: number) => {
        if (seen[j] || this.grid.cells[j] !== color) return;
        seen[j] = 1;
        depth[j] = d + 1;
        queue[tail++] = j;
      };
      if (x > 0) visit(i - 1);
      if (x < width - 1) visit(i + 1);
      if (y > 0) visit(i - width);
      if (y < height - 1) visit(i + width);
    }
    if (cells.length === 0) return 0;
    if (color !== this.selected) this.selectColor(color);
    this.startReveal('bucket', color, cells, Float32Array.from(dist));
    return cells.length;
  }

  /** Baguette : termine la couleur sélectionnée (ou la suivante), en vague depuis le centre de la vue. */
  useWand(): number {
    if (this.phaseValue !== 'playing' || this.reveal) return 0;
    const color =
      (this.progress.remaining[this.selected] ?? 0) > 0
        ? this.selected
        : this.firstRemainingColor(this.selected);
    if ((this.progress.remaining[color] ?? 0) === 0) return 0;
    if (color !== this.selected) this.selectColor(color);
    const [ox, oy] = this.viewCenterInGrid();
    const { width } = this.grid;
    const found: { i: number; d: number }[] = [];
    for (let i = 0; i < this.grid.cells.length; i++) {
      if (this.grid.cells[i] !== color || this.progress.filled.get(i)) continue;
      const x = i % width;
      const y = (i - x) / width;
      found.push({ i, d: Math.hypot(x + 0.5 - ox, y + 0.5 - oy) });
    }
    found.sort((a, b) => a.d - b.d);
    this.startReveal(
      'wand',
      color,
      found.map((f) => f.i),
      Float32Array.from(found, (f) => f.d),
    );
    this.onToolUsed?.('wand', found.length);
    return found.length;
  }

  /**
   * Loupe : vole jusqu'à la case restante la plus proche du centre de la vue (couleur sélectionnée,
   * sinon la suivante) et la fait pulser. Renvoie false s'il ne reste rien à trouver.
   */
  useLoupe(): boolean {
    if (this.phaseValue !== 'playing' || this.reveal) return false;
    const color =
      (this.progress.remaining[this.selected] ?? 0) > 0
        ? this.selected
        : this.firstRemainingColor(this.selected);
    if ((this.progress.remaining[color] ?? 0) === 0) return false;
    const [ox, oy] = this.viewCenterInGrid();
    const { width } = this.grid;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.grid.cells.length; i++) {
      if (this.grid.cells[i] !== color || this.progress.filled.get(i)) continue;
      const x = i % width;
      const d = (x + 0.5 - ox) ** 2 + ((i - x) / width + 0.5 - oy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return false;
    if (color !== this.selected) this.selectColor(color);
    const x = (best % width) + 0.5;
    const y = Math.floor(best / width) + 0.5;
    this.camera.flyTo(x, y, Math.max(this.camera.scale, READABLE_CELL_PX * 1.2));
    this.audio.play('chime', { gain: 0.45, semitones: 7 });
    this.haptics.soft();
    const tint = lighten(this.grid.palette[color] ?? [255, 255, 255], 0.35);
    // anneaux qui s'élargissent sur la case trouvée, une fois la caméra arrivée
    for (let k = 0; k < 3; k++) {
      this.schedule(0.45 + k * 0.28, () => {
        this.particles.emitWorld(
          { kind: 'glow', x, y, life: 0.8, size: 1.2, endSize: 7, alpha: 0.55, tint },
          true,
        );
        this.haptics.pulse('tick-light', this.time * 1000);
      });
    }
    this.onToolUsed?.('loupe', 0);
    this.onChangeRequest?.();
    return true;
  }

  get revealing(): boolean {
    return this.reveal !== null;
  }

  // --- Fin d'œuvre et timelapse ---------------------------------------------

  /** Échelle de la vue encadrée (œuvre + passe-partout + cadre, avec une marge). */
  framedScale(): number {
    const extra = 1 + 2 * (FRAME_RATIO.mat + FRAME_RATIO.frame);
    return (this.camera.fitScale / extra) * 0.97;
  }

  /**
   * Cinématique de fin : dézoom, balayage de lumière, effet du mode (GLSL), cadre qui se construit,
   * avec particules, son et haptique synchronisés sur la même chronologie.
   */
  startFinale(): void {
    if (this.phaseValue === 'finale') return;
    this.armedTool = null;
    this.dirtySnapshot = true;
    this.setPhase('finale');
    const t0 = this.time;
    const { width: w, height: h } = this.grid;
    this.renderer.setSelected(-1, t0);
    this.renderer.setNumberScale(0);
    this.renderer.setFinale(this.options.reducedMotion ? t0 - FINALE.done : t0);
    const framed = this.framedScale();
    this.camera.minScaleFactor = framed / this.camera.fitScale;
    this.camera.flyTo(w / 2, h / 2, framed);
    if (this.options.reducedMotion) {
      this.setPhase('finished');
      return;
    }
    this.schedule(FINALE.sweepStart, () => {
      this.audio.play('finale');
      this.haptics.success();
    });
    this.schedule(FINALE.effectStart, () => {
      this.finaleParticles();
    });
    for (let k = 0; k < 4; k++) {
      this.schedule(FINALE.frameStart + (k * FINALE.frameDuration) / 4, () => {
        this.haptics.pulse('tick-light', this.time * 1000);
      });
    }
    this.schedule(FINALE.frameStart + FINALE.frameDuration, () => {
      this.haptics.pulse('click', this.time * 1000);
      this.particles.emitWorld(
        {
          kind: 'glow',
          x: w / 2,
          y: h / 2,
          life: 0.9,
          size: Math.max(w, h) * 0.9,
          endSize: Math.max(w, h) * 1.4,
          alpha: 0.18,
        },
        true,
      );
    });
    this.schedule(FINALE.done, () => {
      this.setPhase('finished');
    });
  }

  /** Rejoue la création en accéléré (ordre réel des poses), dans le cadre. */
  playTimelapse(): void {
    if (this.phaseValue !== 'finished' || this.history.length === 0) return;
    this.renderer.clearAll();
    const duration = Math.min(12, Math.max(5, 4 + this.history.length / 2500));
    this.replay = { start: this.time + 0.4, duration, done: 0 };
    this.setPhase('timelapse');
  }

  /** Recommence l'œuvre à zéro (démo, debug). */
  restart(): void {
    this.replay = null;
    this.reveal = null;
    this.armedTool = null;
    this.scheduled.length = 0;
    this.history.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.progress = new Progress(this.grid);
    this.renderer.clearAll();
    this.renderer.setFinale(-1);
    this.renderer.setNumberScale(1);
    this.camera.minScaleFactor = 1;
    this.selected = this.firstRemainingColor(0);
    this.renderer.setSelected(this.selected, this.time);
    this.camera.flyTo(this.grid.width / 2, this.grid.height / 2, this.camera.fitScale);
    this.dirtySnapshot = true;
    this.onRestart?.();
    this.setPhase('playing');
  }

  /**
   * Debug : pose instantanément toutes les cases sauf `keep`, couleur par couleur en serpentin,
   * comme le ferait un joueur (l'historique alimente le timelapse).
   */
  debugFillExcept(keep: readonly number[]): void {
    const skip = new Set(keep);
    const { width } = this.grid;
    for (let color = 0; color < this.grid.palette.length; color++) {
      for (let y = 0; y < this.grid.height; y++) {
        for (let k = 0; k < width; k++) {
          const x = y % 2 === 0 ? k : width - 1 - k;
          const i = y * width + x;
          if (skip.has(i) || this.grid.cells[i] !== color) continue;
          if (this.progress.place(i, color) === PlaceResult.Placed) {
            this.renderer.setCell(i, CellState.Filled);
            this.history.push(i);
            this.onOp?.(Op.Place, i);
          }
        }
      }
    }
    this.dirtySnapshot = true;
    this.onChangeRequest?.();
  }

  get placementOrder(): readonly number[] {
    return this.history;
  }

  private stepReplay(): void {
    const r = this.replay;
    if (!r) return;
    const t = Math.min(1, Math.max(0, (this.time - r.start) / r.duration));
    // accélère doucement puis ralentit sur les dernières cases
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const target = Math.floor(eased * this.history.length);
    const batch = target - r.done;
    for (let k = r.done; k < target; k++) {
      const i = this.history[k];
      if (i === undefined) continue;
      if (batch <= 3) this.renderer.animatePlace(i, this.time);
      else this.renderer.setCell(i, CellState.Filled);
    }
    if (batch > 0 && this.time - this.lastReplaySound > 0.09) {
      this.lastReplaySound = this.time;
      this.audio.play(this.mode.sound, { gain: 0.35, burst: true });
    }
    r.done = target;
    if (t >= 1) {
      this.replay = null;
      this.haptics.success();
      this.setPhase('finished');
    }
  }

  private finaleParticles(): void {
    const { width: w, height: h } = this.grid;
    const p = this.particles;
    const big = Math.max(w, h);
    if (this.mode.id === 'diamond') {
      // étoiles en cascade depuis le centre, au rythme de l'onde GLSL
      const n = p.n(70);
      for (let k = 0; k < n; k++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const d = Math.hypot((x - w / 2) / big, (y - h / 2) / big) * 1.414;
        this.schedule(d * FINALE.effectSpread + 0.15, () => {
          p.emitWorld(
            {
              kind: 'star',
              x,
              y,
              life: 0.6,
              size: big * 0.02,
              endSize: big * 0.045,
              rotation: Math.random() * 0.4,
              spin: 0.6,
              shape: 1,
            },
            true,
          );
        });
      }
      return;
    }
    // autres modes : confettis aux couleurs de l'œuvre, depuis le centre
    const n = p.n(60);
    for (let k = 0; k < n; k++) {
      const color = this.grid.palette[k % this.grid.palette.length] ?? [255, 255, 255];
      const a = Math.random() * Math.PI * 2;
      const v = big * (0.25 + Math.random() * 0.45);
      p.emitWorld(
        {
          kind: this.mode.id === 'mosaic' ? 'chip' : k % 2 ? 'chip' : 'dust',
          x: w / 2,
          y: h / 2,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - big * 0.2,
          gravity: big * 0.5,
          drag: 1.8,
          life: 1.1 + Math.random() * 0.6,
          size: big * 0.022,
          endSize: big * 0.01,
          tint: rgbToNumber(color),
          rotation: a,
          spin: 6 * (Math.random() - 0.5),
        },
        false,
      );
    }
  }

  // --- Interne --------------------------------------------------------------

  private useBucketAt(i: number): void {
    const n = this.fillRegionAt(i);
    if (n > 0) {
      this.armedTool = null;
      this.dirtySnapshot = true;
      this.onToolUsed?.('bucket', n);
      this.onChangeRequest?.();
      return;
    }
    // rien à remplir ici : le pot reste armé, petit refus
    const x = i % this.grid.width;
    const y = Math.floor(i / this.grid.width);
    this.renderer.animateShake(i, this.time);
    this.feedback.emit({ type: 'error', index: i, x, y, time: this.time });
  }

  /** Centre de la vue, ramené dans la grille (cases). */
  private viewCenterInGrid(): [number, number] {
    const [cx, cy] = this.camera.viewCenterCell();
    return [Math.min(Math.max(cx, 0), this.grid.width), Math.min(Math.max(cy, 0), this.grid.height)];
  }

  private startReveal(tool: ToolId, color: number, cells: number[], dist: Float32Array): void {
    this.commitStroke();
    this.currentStroke = [];
    const duration = this.options.reducedMotion
      ? 0
      : Math.min(1.4, 0.35 + 0.03 * Math.sqrt(cells.length) * 2);
    this.reveal = { tool, color, cells, dist, start: this.time, duration, done: 0, lastFx: -Infinity };
    this.audio.play(tool === 'wand' ? 'chime' : this.mode.sound, {
      gain: 0.6,
      semitones: tool === 'wand' ? 12 : 0,
    });
    this.haptics.pulse('click', this.time * 1000);
    this.stepReveal();
  }

  private stepReveal(): void {
    const r = this.reveal;
    if (!r) return;
    const t = r.duration > 0 ? Math.min(1, Math.max(0, (this.time - r.start) / r.duration)) : 1;
    const eased = 1 - (1 - t) * (1 - t);
    const maxD = r.dist[r.dist.length - 1] ?? 0;
    const threshold = eased * maxD + 1e-6;
    let budget = this.options.reducedMotion
      ? 0
      : REVEAL_ANIM_BUDGET - this.renderer.activeAnimations(this.time);
    let k = r.done;
    while (k < r.cells.length && (r.dist[k] ?? 0) <= threshold) {
      const i = r.cells[k] ?? 0;
      k++;
      if (this.progress.place(i, r.color) !== PlaceResult.Placed) continue;
      if (budget-- > 0) this.renderer.animatePlace(i, this.time);
      else this.renderer.setCell(i, CellState.Filled);
      this.currentStroke.push(i);
      this.history.push(i);
      this.onOp?.(Op.Place, i);
    }
    if (k > r.done) {
      this.dirtySnapshot = true;
      if (this.time - r.lastFx > 0.08) {
        r.lastFx = this.time;
        this.audio.play(this.mode.sound, { gain: 0.45, burst: true });
        this.haptics.pulse('tick-light', this.time * 1000);
        const last = r.cells[k - 1] ?? 0;
        if (!this.options.reducedMotion)
          this.placeParticles(
            last % this.grid.width,
            Math.floor(last / this.grid.width),
            this.grid.palette[r.color] ?? [255, 255, 255],
          );
      }
    }
    r.done = k;
    if (k < r.cells.length) return;
    this.reveal = null;
    this.commitStroke();
    const last = r.cells[r.cells.length - 1] ?? 0;
    const x = last % this.grid.width;
    const y = Math.floor(last / this.grid.width);
    if ((this.progress.remaining[r.color] ?? 0) === 0) {
      this.feedback.emit({
        type: 'colorComplete',
        color: r.color,
        x,
        y,
        mode: this.mode.id,
        time: this.time,
      });
      if (this.progress.complete)
        this.feedback.emit({ type: 'artworkComplete', mode: this.mode.id, time: this.time });
    }
    this.onChangeRequest?.();
  }

  private visitCell(cx: number, cy: number): void {
    if (!this.progress.inBounds(cx, cy)) return;
    this.tryPlace(this.progress.index(cx, cy), true, !this.options.autoCorrect);
  }

  private tryPlace(i: number, drag: boolean, feedbackOnError: boolean): boolean {
    if (this.phaseValue !== 'playing') return false;
    const r = this.progress.place(i, this.selected);
    const x = i % this.grid.width;
    const y = Math.floor(i / this.grid.width);
    if (r === PlaceResult.Placed) {
      this.renderer.animatePlace(i, this.time, this.options.reducedMotion);
      this.currentStroke.push(i);
      this.history.push(i);
      this.onOp?.(Op.Place, i);
      this.feedback.emit({
        type: 'place',
        index: i,
        x,
        y,
        color: this.selected,
        mode: this.mode.id,
        drag,
        time: this.time,
      });
      if ((this.progress.remaining[this.selected] ?? 0) === 0) {
        this.feedback.emit({
          type: 'colorComplete',
          color: this.selected,
          x,
          y,
          mode: this.mode.id,
          time: this.time,
        });
        if (this.progress.complete)
          this.feedback.emit({ type: 'artworkComplete', mode: this.mode.id, time: this.time });
      }
      this.dirtySnapshot = true;
      return true;
    }
    if (r === PlaceResult.WrongColor && feedbackOnError && !this.shaken.has(i)) {
      if (drag) this.shaken.add(i);
      this.renderer.animateShake(i, this.time);
      this.feedback.emit({ type: 'error', index: i, x, y, time: this.time });
    }
    return false;
  }

  private commitStroke(): void {
    if (this.currentStroke.length === 0) return;
    this.undoStack.push(this.currentStroke);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack.length = 0;
    this.currentStroke = [];
  }

  private indexAt(sx: number, sy: number): number {
    const [cx, cy] = this.camera.screenToCell(sx, sy);
    const x = Math.floor(cx);
    const y = Math.floor(cy);
    return this.progress.inBounds(x, y) ? this.progress.index(x, y) : -1;
  }

  private firstRemainingColor(from: number): number {
    const n = this.grid.palette.length;
    for (let k = 0; k < n; k++) {
      const c = (from + k) % n;
      if ((this.progress.remaining[c] ?? 0) > 0) return c;
    }
    return from;
  }

  private schedule(delay: number, run: () => void): void {
    if (delay <= 0) run();
    else this.scheduled.push({ at: this.time + delay, run });
  }

  private onFeedback(e: FeedbackEvent): void {
    const nowMs = this.time * 1000;
    switch (e.type) {
      case 'place': {
        const color = this.grid.palette[e.color] ?? [255, 255, 255];
        const impact = this.options.reducedMotion ? 0 : (this.mode.placeDuration / 1000) * this.mode.impactAt;
        this.schedule(impact, () => {
          this.audio.play(this.mode.sound, { burst: e.drag });
          this.haptics.pulse(this.mode.haptic, this.time * 1000);
          if (!this.options.reducedMotion) this.placeParticles(e.x, e.y, color);
        });
        break;
      }
      case 'error':
        this.audio.play('error');
        this.haptics.pulse('tick-light', nowMs);
        break;
      case 'colorComplete': {
        const color = this.grid.palette[e.color] ?? [255, 255, 255];
        this.schedule(0.12, () => {
          this.renderer.startWave(e.color, e.x + 0.5, e.y + 0.5, this.time);
          this.audio.play('chime');
          this.haptics.success();
          if (!this.options.reducedMotion) this.confetti(e.x + 0.5, e.y + 0.5, color);
          const next = this.firstRemainingColor(e.color + 1);
          if (next !== e.color) this.selectColor(next);
        });
        break;
      }
      case 'artworkComplete':
        // laisse la dernière pose et l'onde de couleur se terminer
        this.schedule(0.55, () => {
          this.startFinale();
        });
        break;
      case 'longPress':
        break;
    }
    this.onChangeRequest?.();
  }

  private placeParticles(x: number, y: number, color: Rgb): void {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const p = this.particles;
    if (this.mode.id === 'diamond') {
      // étoile qui scintille sur un coin du diamant
      const ox = (Math.random() - 0.5) * 0.5;
      const oy = (Math.random() - 0.5) * 0.5 - 0.1;
      p.emitWorld(
        {
          kind: 'star',
          x: cx + ox,
          y: cy + oy,
          life: 0.5,
          size: 0.55,
          endSize: 1.05,
          rotation: (Math.random() - 0.5) * 0.4,
          spin: 0.8,
          shape: 1,
          alpha: 0.95,
        },
        true,
      );
      for (let k = 0; k < p.n(2); k++) {
        p.emitWorld(
          {
            kind: 'dust',
            x: cx + (Math.random() - 0.5) * 0.8,
            y: cy + (Math.random() - 0.5) * 0.8,
            vy: -0.4,
            life: 0.35 + Math.random() * 0.2,
            size: 0.3,
            endSize: 0.1,
            tint: lighten(color, 0.7),
            shape: 1,
          },
          true,
        );
      }
      return;
    }
    if (this.mode.id === 'mosaic') {
      // fine poussière de mortier qui retombe autour de la tesselle
      for (let k = 0; k < p.n(5); k++) {
        const side = Math.random() * Math.PI * 2;
        p.emitWorld(
          {
            kind: 'dust',
            x: cx + Math.cos(side) * 0.5,
            y: cy + Math.sin(side) * 0.5,
            vx: Math.cos(side) * 0.8,
            vy: -0.6 + Math.random() * 0.3,
            gravity: 3.5,
            drag: 3,
            life: 0.5 + Math.random() * 0.25,
            size: 0.22,
            endSize: 0.12,
            tint: 0xb9b2a6,
            alpha: 0.8,
          },
          false,
        );
      }
      return;
    }
    if (this.mode.id === 'crossstitch') {
      // petite lueur de la couleur du fil au croisement
      p.emitWorld(
        {
          kind: 'glow',
          x: cx,
          y: cy,
          life: 0.45,
          size: 0.9,
          endSize: 1.5,
          alpha: 0.22,
          tint: rgbToNumber(color),
        },
        false,
      );
      return;
    }
    // pixel : éclat de couleur
    p.emitWorld(
      {
        kind: 'glow',
        x: cx,
        y: cy,
        life: 0.3,
        size: 1.2,
        endSize: 2.2,
        alpha: 0.28,
        tint: rgbToNumber(color),
      },
      false,
    );
    const n = p.n(5);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.6;
      const v = 2.2 + Math.random() * 1.6;
      p.emitWorld(
        {
          kind: 'chip',
          x: cx,
          y: cy,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          drag: 6,
          life: 0.32 + Math.random() * 0.12,
          size: 0.26,
          endSize: 0.06,
          tint: rgbToNumber(color),
          rotation: a,
          spin: 4,
        },
        false,
      );
    }
  }

  private confetti(x: number, y: number, color: Rgb): void {
    const p = this.particles;
    const n = p.n(18);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = 3 + Math.random() * 5;
      p.emitWorld(
        {
          kind: 'chip',
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 3,
          gravity: 9,
          drag: 2.5,
          life: 0.9 + Math.random() * 0.5,
          size: 0.45,
          endSize: 0.2,
          tint: k % 3 === 0 ? lighten(color, 0.6) : rgbToNumber(color),
          rotation: a,
          spin: 8 * (Math.random() - 0.5),
        },
        false,
      );
    }
    p.emitWorld(
      { kind: 'glow', x, y, life: 0.5, size: 2, endSize: 6, alpha: 0.35, tint: lighten(color, 0.6) },
      true,
    );
  }

  private emitTrail(x0: number, y0: number, x1: number, y1: number): void {
    if (this.options.reducedMotion) return;
    const color = this.grid.palette[this.selected] ?? [255, 255, 255];
    const tint = lighten(color, 0.15);
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.min(8, Math.max(1, Math.floor(d / 7)));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      this.particles.emitScreen({
        kind: 'glow',
        x: x0 + (x1 - x0) * t,
        y: y0 + (y1 - y0) * t,
        life: 0.34,
        size: 26,
        endSize: 6,
        alpha: 0.3,
        tint,
      });
    }
  }
}
