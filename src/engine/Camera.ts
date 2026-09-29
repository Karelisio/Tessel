import { stepSpring, type SpringState } from '@/fx/spring';
import { spring, type SpringConfig } from '@/theme/motion/tokens';

/** Zone visible en px CSS (les insets réservent la place des barres d'interface). */
export interface Viewport {
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
}

/** Échelle maximale : px CSS par case. */
export const MAX_CELL_PX = 96;
/** Taille d'une case (px CSS) visée par un double tap. */
export const READABLE_CELL_PX = 42;

const FRICTION = 4.2; // décroissance exponentielle de l'inertie (1/s)
const MIN_FLING = 12; // px/s
const EDGE_MARGIN_RATIO = 0.18;
const BOUNCE: SpringConfig = { stiffness: 260, damping: 32, mass: 1 };

interface Axis {
  pos: number;
  view0: number;
  viewLen: number;
  content: number;
  margin: number;
}

function axisRange({ view0, viewLen, content, margin }: Axis): [number, number] {
  const lo = view0 + viewLen - content - margin;
  const hi = view0 + margin;
  if (lo > hi) {
    const c = view0 + (viewLen - content) / 2;
    return [c, c];
  }
  return [lo, hi];
}

/**
 * Caméra 2D : `scale` = px CSS par case, (`tx`, `ty`) = position écran de l'origine de la grille.
 * Gère inertie, bords élastiques, limites de zoom souples et vols animés par ressorts.
 */
export class Camera {
  scale = 1;
  tx = 0;
  ty = 0;

  private gridW = 1;
  private gridH = 1;
  private vp: Viewport = { width: 1, height: 1, insetTop: 0, insetBottom: 0 };
  private vx: SpringState = { x: 0, v: 0 };
  private vy: SpringState = { x: 0, v: 0 };
  private zoomSpring: SpringState | null = null;
  private zoomFocal: [number, number] = [0, 0];
  private fly: { s: SpringState; cx: SpringState; cy: SpringState; target: [number, number, number] } | null =
    null;
  private interacting = false;
  private flingActive = false;

  get fitScale(): number {
    const h = this.vp.height - this.vp.insetTop - this.vp.insetBottom;
    return Math.min((this.vp.width * 0.94) / this.gridW, (h * 0.94) / this.gridH);
  }

  get minScale(): number {
    return this.fitScale;
  }

  get maxScale(): number {
    return Math.max(MAX_CELL_PX, this.fitScale * 2);
  }

  get viewport(): Readonly<Viewport> {
    return this.vp;
  }

  get isAnimating(): boolean {
    return this.flingActive || this.zoomSpring !== null || this.fly !== null || this.outOfBounds();
  }

  setGrid(width: number, height: number): void {
    this.gridW = width;
    this.gridH = height;
  }

  setViewport(vp: Viewport): void {
    const [cx, cy] = this.viewCenterCell();
    const hadSize = this.vp.width > 1;
    this.vp = { ...vp };
    if (hadSize) {
      this.scale = Math.min(Math.max(this.scale, this.minScale), this.maxScale);
      this.centerOn(cx, cy);
    } else this.fit();
  }

  /** Centre de la zone visible (px CSS). */
  viewCenter(): [number, number] {
    return [
      this.vp.width / 2,
      this.vp.insetTop + (this.vp.height - this.vp.insetTop - this.vp.insetBottom) / 2,
    ];
  }

  viewCenterCell(): [number, number] {
    const [sx, sy] = this.viewCenter();
    return this.screenToCell(sx, sy);
  }

  screenToCell(sx: number, sy: number): [number, number] {
    return [(sx - this.tx) / this.scale, (sy - this.ty) / this.scale];
  }

  cellToScreen(cx: number, cy: number): [number, number] {
    return [this.tx + cx * this.scale, this.ty + cy * this.scale];
  }

  centerOn(cx: number, cy: number): void {
    const [sx, sy] = this.viewCenter();
    this.tx = sx - cx * this.scale;
    this.ty = sy - cy * this.scale;
  }

  fit(): void {
    this.stop();
    this.scale = this.fitScale;
    this.centerOn(this.gridW / 2, this.gridH / 2);
  }

  stop(): void {
    this.vx.v = 0;
    this.vy.v = 0;
    this.flingActive = false;
    this.zoomSpring = null;
    this.fly = null;
  }

  beginInteraction(): void {
    this.stop();
    this.interacting = true;
  }

  /** Fin d'un geste : `velocity` en px CSS/s pour l'inertie. */
  endInteraction(velocityX = 0, velocityY = 0, focalX?: number, focalY?: number): void {
    this.interacting = false;
    this.vx = { x: this.tx, v: velocityX };
    this.vy = { x: this.ty, v: velocityY };
    this.flingActive = Math.hypot(velocityX, velocityY) > MIN_FLING;
    const clamped = Math.min(Math.max(this.scale, this.minScale), this.maxScale);
    if (clamped !== this.scale) {
      this.zoomSpring = { x: Math.log(this.scale), v: 0 };
      const [cx, cy] = this.viewCenter();
      this.zoomFocal = [focalX ?? cx, focalY ?? cy];
    }
  }

  /** Déplacement direct (doigt), avec résistance élastique hors limites. */
  panBy(dx: number, dy: number): void {
    const [x, y] = this.axes();
    this.tx += dx * this.resistance(x, dx);
    this.ty += dy * this.resistance(y, dy);
  }

  /** Zoom autour d'un point écran, avec limites souples. */
  zoomAt(sx: number, sy: number, factor: number): void {
    let target = this.scale * factor;
    const min = this.minScale;
    const max = this.maxScale;
    if (target < min && factor < 1) target = this.scale * factor ** (0.35 * Math.min(1, this.scale / min));
    if (target > max && factor > 1) target = this.scale * factor ** (0.35 * Math.min(1, max / this.scale));
    target = Math.min(Math.max(target, min * 0.6), max * 1.4);
    this.applyScale(target, sx, sy);
  }

  /** Vol animé vers une case (centre) à une échelle donnée. */
  flyTo(cellX: number, cellY: number, scale: number): void {
    const [cx, cy] = this.viewCenterCell();
    const clamped = Math.min(Math.max(scale, this.minScale), this.maxScale);
    this.stop();
    this.fly = {
      s: { x: Math.log(this.scale), v: 0 },
      cx: { x: cx, v: 0 },
      cy: { x: cy, v: 0 },
      target: [Math.log(clamped), cellX, cellY],
    };
  }

  /** Double tap : zoom lisible sur le point, ou retour à la vue d'ensemble. */
  toggleZoomAt(sx: number, sy: number): void {
    const [cx, cy] = this.screenToCell(sx, sy);
    const readable = Math.max(READABLE_CELL_PX, this.fitScale * 1.5);
    if (this.scale < readable * 0.8) this.flyTo(cx, cy, readable);
    else this.flyTo(this.gridW / 2, this.gridH / 2, this.fitScale);
  }

  /** Avance la simulation ; renvoie true si la caméra a bougé. */
  update(dt: number): boolean {
    const before = this.tx + this.ty * 7 + this.scale * 131;
    if (this.fly) this.updateFly(dt);
    else if (!this.interacting) {
      if (this.zoomSpring) {
        const target = Math.log(Math.min(Math.max(this.scale, this.minScale), this.maxScale));
        stepSpring(this.zoomSpring, target, spring.camera, dt);
        this.applyScale(Math.exp(this.zoomSpring.x), this.zoomFocal[0], this.zoomFocal[1]);
        if (Math.abs(this.zoomSpring.x - target) < 1e-4 && Math.abs(this.zoomSpring.v) < 1e-3) {
          this.applyScale(Math.exp(target), this.zoomFocal[0], this.zoomFocal[1]);
          this.zoomSpring = null;
        }
      }
      this.vx.x = this.tx;
      this.vy.x = this.ty;
      const [ax, ay] = this.axes();
      this.tx = this.updateAxis(this.vx, ax, dt);
      this.ty = this.updateAxis(this.vy, ay, dt);
      if (Math.abs(this.vx.v) < MIN_FLING && Math.abs(this.vy.v) < MIN_FLING && !this.outOfBounds()) {
        this.flingActive = false;
        this.vx.v = 0;
        this.vy.v = 0;
      }
    }
    return before !== this.tx + this.ty * 7 + this.scale * 131;
  }

  private updateFly(dt: number): void {
    const f = this.fly;
    if (!f) return;
    stepSpring(f.s, f.target[0], spring.camera, dt);
    stepSpring(f.cx, f.target[1], spring.camera, dt);
    stepSpring(f.cy, f.target[2], spring.camera, dt);
    this.scale = Math.exp(f.s.x);
    this.centerOn(f.cx.x, f.cy.x);
    const done =
      Math.abs(f.s.x - f.target[0]) < 1e-4 &&
      Math.abs(f.cx.x - f.target[1]) < 1e-3 &&
      Math.abs(f.cy.x - f.target[2]) < 1e-3 &&
      Math.abs(f.s.v) + Math.abs(f.cx.v) + Math.abs(f.cy.v) < 1e-2;
    if (done) {
      this.scale = Math.exp(f.target[0]);
      this.centerOn(f.target[1], f.target[2]);
      this.fly = null;
    }
  }

  private updateAxis(s: SpringState, axis: Axis, dt: number): number {
    const [lo, hi] = axisRange(axis);
    if (s.x < lo || s.x > hi) {
      stepSpring(s, s.x < lo ? lo : hi, BOUNCE, dt);
      // ne pas osciller de l'autre côté : un ressort de rappel s'arrête à la limite
      if ((s.x >= lo && s.x <= hi) || Math.abs(s.v) < MIN_FLING) {
        if (s.x < lo || s.x > hi) s.x = s.x < lo ? lo : hi;
      }
    } else if (s.v !== 0) {
      s.x += s.v * dt;
      s.v *= Math.exp(-FRICTION * dt);
    }
    return s.x;
  }

  private applyScale(next: number, sx: number, sy: number): void {
    const k = next / this.scale;
    this.tx = sx - (sx - this.tx) * k;
    this.ty = sy - (sy - this.ty) * k;
    this.scale = next;
  }

  private axes(): [Axis, Axis] {
    const vh = this.vp.height - this.vp.insetTop - this.vp.insetBottom;
    const margin = Math.min(this.vp.width, vh) * EDGE_MARGIN_RATIO;
    return [
      { pos: this.tx, view0: 0, viewLen: this.vp.width, content: this.gridW * this.scale, margin },
      { pos: this.ty, view0: this.vp.insetTop, viewLen: vh, content: this.gridH * this.scale, margin },
    ];
  }

  private resistance(axis: Axis, delta: number): number {
    const [lo, hi] = axisRange(axis);
    const over = axis.pos < lo ? lo - axis.pos : axis.pos > hi ? axis.pos - hi : 0;
    const outward = (axis.pos < lo && delta < 0) || (axis.pos > hi && delta > 0);
    if (!outward || over === 0) return 1;
    return 1 / (1 + over / 90);
  }

  private outOfBounds(): boolean {
    const [x, y] = this.axes();
    const [xl, xh] = axisRange(x);
    const [yl, yh] = axisRange(y);
    return this.tx < xl - 0.5 || this.tx > xh + 0.5 || this.ty < yl - 0.5 || this.ty > yh + 0.5;
  }
}
