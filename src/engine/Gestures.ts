import type { Camera } from './Camera';

export interface GestureHandlers {
  /** La case sous ce point peut-elle être peinte avec la couleur active ? */
  canPaintAt(sx: number, sy: number): boolean;
  /** Tap simple ; renvoie true si une case a été peinte. */
  onTap(sx: number, sy: number): boolean;
  onDoubleTap(sx: number, sy: number): void;
  onLongPress(sx: number, sy: number): void;
  onPaintStart(sx: number, sy: number): void;
  onPaintMove(sx: number, sy: number): void;
  onPaintEnd(): void;
  /** Appelé à chaque changement nécessitant un rendu. */
  onChange(): void;
}

export type DragMode = 'smart' | 'pan';

const TAP_SLOP = 9; // px CSS
const LONG_PRESS_MS = 320;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST = 32;
const VELOCITY_WINDOW_MS = 90;

type State = 'idle' | 'pending' | 'pan' | 'paint' | 'pinch';

interface Sample {
  t: number;
  x: number;
  y: number;
}

/**
 * Traduit les Pointer Events en gestes :
 * 2 doigts = pan + pinch ; 1 doigt glissé = peinture si départ sur une case peignable (mode `smart`),
 * sinon déplacement ; appui long = peinture forcée ; double tap = zoom.
 */
export class Gestures {
  dragMode: DragMode = 'smart';

  private state: State = 'idle';
  private pointers = new Map<number, { x: number; y: number }>();
  private start = { x: 0, y: 0, t: 0 };
  private last = { x: 0, y: 0 };
  private samples: Sample[] = [];
  private pinchDist = 0;
  private pinchCenter = { x: 0, y: 0 };
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTap = { t: -1e9, x: 0, y: 0, painted: false };
  private readonly el: HTMLElement;

  constructor(
    el: HTMLElement,
    private readonly camera: Camera,
    private readonly h: GestureHandlers,
  ) {
    this.el = el;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.preventDefault);
  }

  destroy(): void {
    this.clearLongPress();
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onCancel);
    this.el.removeEventListener('wheel', this.onWheel);
    this.el.removeEventListener('contextmenu', this.preventDefault);
  }

  get isPainting(): boolean {
    return this.state === 'paint';
  }

  private readonly preventDefault = (e: Event) => {
    e.preventDefault();
  };

  private local(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.el.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.state = 'pending';
      this.start = { x: p.x, y: p.y, t: e.timeStamp };
      this.last = p;
      this.samples = [{ t: e.timeStamp, x: p.x, y: p.y }];
      this.camera.beginInteraction();
      this.clearLongPress();
      this.longPressTimer = setTimeout(() => {
        if (this.state !== 'pending') return;
        this.h.onLongPress(this.start.x, this.start.y);
        this.state = 'paint';
        this.h.onPaintStart(this.start.x, this.start.y);
        this.h.onChange();
      }, LONG_PRESS_MS);
    } else if (this.pointers.size === 2) {
      this.clearLongPress();
      if (this.state === 'paint') this.h.onPaintEnd();
      this.state = 'pinch';
      this.camera.beginInteraction();
      this.initPinch(e.timeStamp);
    }
  };

  private readonly onMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);

    switch (this.state) {
      case 'pending': {
        if (Math.hypot(p.x - this.start.x, p.y - this.start.y) < TAP_SLOP) return;
        this.clearLongPress();
        if (this.dragMode === 'smart' && this.h.canPaintAt(this.start.x, this.start.y)) {
          this.state = 'paint';
          this.h.onPaintStart(this.start.x, this.start.y);
          this.h.onPaintMove(p.x, p.y);
        } else {
          this.state = 'pan';
          this.camera.panBy(p.x - this.start.x, p.y - this.start.y);
        }
        break;
      }
      case 'pan':
        this.camera.panBy(p.x - this.last.x, p.y - this.last.y);
        break;
      case 'paint':
        this.h.onPaintMove(p.x, p.y);
        break;
      case 'pinch':
        this.updatePinch(e.timeStamp);
        this.h.onChange();
        return;
      case 'idle':
        return;
    }
    this.last = p;
    this.pushSample(e.timeStamp, p.x, p.y);
    this.h.onChange();
  };

  private readonly onUp = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    this.clearLongPress();

    if (this.state === 'pinch') {
      if (this.pointers.size === 1) {
        // reste un doigt : on continue en déplacement simple
        const [rest] = this.pointers.values();
        if (rest) {
          this.state = 'pan';
          this.last = rest;
          this.samples = [{ t: e.timeStamp, x: rest.x, y: rest.y }];
        }
        return;
      }
      const [vx, vy] = this.velocity(e.timeStamp);
      this.camera.endInteraction(vx, vy, this.pinchCenter.x, this.pinchCenter.y);
    } else if (this.state === 'pan') {
      const [vx, vy] = this.velocity(e.timeStamp);
      this.camera.endInteraction(vx, vy);
    } else if (this.state === 'paint') {
      this.h.onPaintEnd();
      this.camera.endInteraction();
    } else if (this.state === 'pending') {
      this.camera.endInteraction();
      const p = this.local(e);
      const lt = this.lastTap;
      const isDouble =
        e.timeStamp - lt.t < DOUBLE_TAP_MS &&
        Math.hypot(p.x - lt.x, p.y - lt.y) < DOUBLE_TAP_DIST &&
        !lt.painted;
      if (isDouble) {
        this.h.onDoubleTap(p.x, p.y);
        this.lastTap = { t: -1e9, x: 0, y: 0, painted: false };
      } else {
        const painted = this.h.onTap(p.x, p.y);
        this.lastTap = { t: e.timeStamp, x: p.x, y: p.y, painted };
      }
    }
    if (this.pointers.size === 0) this.state = 'idle';
    this.h.onChange();
  };

  private readonly onCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.clearLongPress();
    if (this.state === 'paint') this.h.onPaintEnd();
    if (this.pointers.size === 0) {
      this.state = 'idle';
      this.camera.endInteraction();
    }
    this.h.onChange();
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = this.local(e);
    this.camera.beginInteraction();
    this.camera.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
    this.camera.endInteraction(0, 0, p.x, p.y);
    this.h.onChange();
  };

  private initPinch(t: number): void {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    this.pinchDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    this.pinchCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.samples = [{ t, x: this.pinchCenter.x, y: this.pinchCenter.y }];
  }

  private updatePinch(t: number): void {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.camera.panBy(center.x - this.pinchCenter.x, center.y - this.pinchCenter.y);
    this.camera.zoomAt(center.x, center.y, dist / this.pinchDist);
    this.pinchDist = dist;
    this.pinchCenter = center;
    this.pushSample(t, center.x, center.y);
  }

  private pushSample(t: number, x: number, y: number): void {
    this.samples.push({ t, x, y });
    while (this.samples.length > 2 && t - (this.samples[0]?.t ?? t) > VELOCITY_WINDOW_MS)
      this.samples.shift();
  }

  private velocity(now: number): [number, number] {
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    if (!first || !last || now - last.t > 60) return [0, 0];
    const dt = (last.t - first.t) / 1000;
    if (dt < 0.008) return [0, 0];
    return [(last.x - first.x) / dt, (last.y - first.y) / dt];
  }

  private clearLongPress(): void {
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
  }
}
