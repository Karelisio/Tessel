import type { AudioEngine } from '@/audio/AudioEngine';
import type { HapticsEngine } from '@/audio/haptics';
import { TRANSPARENT, type Grid, type Rgb } from '@/content/grid';
import { PlaceResult, Progress } from '@/content/progress';
import type { ParticleFx } from '@/fx/Particles';
import type { ModeDefinition } from '@/modes/types';
import type { Camera } from './Camera';
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
}

export interface GameOptions {
  autoCorrect: boolean;
  reducedMotion: boolean;
}

interface Scheduled {
  at: number;
  run: () => void;
}

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
  readonly progress: Progress;
  readonly feedback = new FeedbackBus();
  selected = 0;
  options: GameOptions = { autoCorrect: true, reducedMotion: false };
  onSnapshot: ((s: GameSnapshot) => void) | null = null;
  onChangeRequest: (() => void) | null = null;

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

  /** Temps courant (s), fourni par le moteur à chaque frame. */
  tick(time: number): boolean {
    this.time = time;
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
    return this.scheduled.length > 0 || this.dirtySnapshot;
  }

  snapshot(): GameSnapshot {
    return {
      remaining: Array.from(this.progress.remaining),
      totals: Array.from(this.progress.totals),
      selected: this.selected,
      left: this.progress.left,
      total: this.progress.total,
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
    if (this.camera.scale < MIN_PAINT_CELL_PX) return false;
    const i = this.indexAt(sx, sy);
    return i >= 0 && this.progress.check(i, this.selected) === PlaceResult.Placed;
  }

  onTap(sx: number, sy: number): boolean {
    void this.audio.unlock();
    const i = this.indexAt(sx, sy);
    if (i < 0) return false;
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
    const stroke = this.undoStack.pop();
    if (!stroke) return;
    for (const i of stroke) {
      if (this.progress.unplace(i)) this.renderer.setCell(i, CellState.Empty);
    }
    this.redoStack.push(stroke);
    this.dirtySnapshot = true;
    this.haptics.soft();
    this.onChangeRequest?.();
  }

  redo(): void {
    const stroke = this.redoStack.pop();
    if (!stroke) return;
    for (const i of stroke) {
      const color = this.grid.cells[i] ?? TRANSPARENT;
      if (this.progress.place(i, color) === PlaceResult.Placed) this.renderer.setCell(i, CellState.Filled);
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

  // --- Interne --------------------------------------------------------------

  private visitCell(cx: number, cy: number): void {
    if (!this.progress.inBounds(cx, cy)) return;
    this.tryPlace(this.progress.index(cx, cy), true, !this.options.autoCorrect);
  }

  private tryPlace(i: number, drag: boolean, feedbackOnError: boolean): boolean {
    const r = this.progress.place(i, this.selected);
    const x = i % this.grid.width;
    const y = Math.floor(i / this.grid.width);
    if (r === PlaceResult.Placed) {
      this.renderer.animatePlace(i, this.time, this.options.reducedMotion);
      this.currentStroke.push(i);
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
        this.schedule(0.6, () => {
          const [w, h] = [this.grid.width, this.grid.height];
          this.camera.flyTo(w / 2, h / 2, this.camera.fitScale);
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
