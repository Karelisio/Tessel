import type { Editor } from '@/create/Editor';
import { docRgba } from '../render';

export interface ViewInfo {
  /** Zoom relatif à l'ajustement à l'écran (1 = toile entière visible). */
  zoom: number;
  /** La vue n'est plus celle par défaut : proposer de recentrer. */
  moved: boolean;
}

interface Colors {
  surface2: string;
  surface3: string;
  ink: string;
  accent: string;
  outline: string;
}

interface Pt {
  x: number;
  y: number;
}

const MARGIN = 14;
const CHECKER = 8;
/** Attente avant de commencer un trait au doigt : laisse le temps à un deuxième doigt d'arriver (pincement). */
const TOUCH_DELAY = 70;
const MAX_CELL_PX = 64;
const GRID_FROM = 6;
const CHECKER_CELLS_FROM = 5;
const GRID_FULL = 14;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Toile de l'éditeur : dessin 2D net, damier de transparence, grille au zoom, axes de symétrie,
 * pan / zoom à deux doigts et dessin à un doigt. Tout est impératif : le canvas ne se redessine que sur
 * `editor.on(...)` ou quand la vue bouge, jamais à cause d'un rendu React.
 */
export class CanvasView {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly art = document.createElement('canvas');
  private readonly artCtx: CanvasRenderingContext2D;
  private artDirty = true;
  private artW = 0;
  private artH = 0;

  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private fitScale = 1;
  private moved = false;

  private colors: Colors = {
    surface2: '#eee',
    surface3: '#ddd',
    ink: '#000',
    accent: '#88f',
    outline: '#888',
  };
  private checker: CanvasPattern | null = null;

  private readonly pointers = new Map<number, Pt>();
  private mode: 'idle' | 'pending' | 'draw' | 'pinch' | 'pan' = 'idle';
  private pendingId = -1;
  private pendingStart: Pt = { x: 0, y: 0 };
  private pendingTimer = 0;
  private drawId = -1;
  private pinch = { dist: 1, mid: { x: 0, y: 0 }, scale: 1, ox: 0, oy: 0 };
  private panFrom = { x: 0, y: 0, ox: 0, oy: 0 };
  private space = false;

  private raf = 0;
  private anim = 0;
  private lastInfo = '';

  constructor(
    private readonly editor: Editor,
    private readonly canvas: HTMLCanvasElement,
    private readonly onInfo: (info: ViewInfo) => void,
    private readonly isReduced: () => boolean,
  ) {
    const ctx = canvas.getContext('2d');
    const artCtx = this.art.getContext('2d', { willReadFrequently: true });
    if (!ctx || !artCtx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.artCtx = artCtx;
  }

  // ------------------------------------------------------------------ cycle de vie

  attach(): () => void {
    const c = this.canvas;
    const off = this.editor.on(() => {
      this.artDirty = true;
      this.requestDraw();
    });
    const down = (e: PointerEvent) => {
      this.onDown(e);
    };
    const move = (e: PointerEvent) => {
      this.onMove(e);
    };
    const up = (e: PointerEvent) => {
      this.onUp(e, false);
    };
    const cancel = (e: PointerEvent) => {
      this.onUp(e, true);
    };
    const wheel = (e: WheelEvent) => {
      this.onWheel(e);
    };
    const menu = (e: Event) => {
      e.preventDefault();
    };
    const keyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) this.space = true;
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') this.space = false;
    };
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', cancel);
    c.addEventListener('wheel', wheel, { passive: false });
    c.addEventListener('contextmenu', menu);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);

    const ro = new ResizeObserver(() => {
      this.resize();
    });
    ro.observe(c);
    // thème changé (jetons CSS) : couleurs de la toile à relire
    const mo = new MutationObserver(() => {
      this.readColors();
      this.requestDraw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style', 'class'],
    });
    this.readColors();
    this.resize();

    return () => {
      off();
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', cancel);
      c.removeEventListener('wheel', wheel);
      c.removeEventListener('contextmenu', menu);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      ro.disconnect();
      mo.disconnect();
      window.clearTimeout(this.pendingTimer);
      cancelAnimationFrame(this.raf);
      cancelAnimationFrame(this.anim);
      if (this.mode === 'draw') this.editor.end();
    };
  }

  // ------------------------------------------------------------------ vue

  private readColors(): void {
    const cs = getComputedStyle(document.documentElement);
    const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    this.colors = {
      surface2: get('--surface-2', '#ffffff'),
      surface3: get('--surface-3', '#e6e6e6'),
      ink: get('--on-surface', '#333333'),
      accent: get('--primary', '#b77ba8'),
      outline: get('--outline-strong', '#888888'),
    };
    this.checker = null;
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.cssW = rect.width;
    this.cssH = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.checker = null;
    const { width, height } = this.editor.doc;
    this.fitScale = Math.min((this.cssW - MARGIN * 2) / width, (this.cssH - MARGIN * 2) / height);
    if (this.moved) this.clampPan();
    else this.fit();
    this.requestDraw();
  }

  /** Toile entière, centrée, avec un grossissement entier en pixels de l'appareil quand c'est possible. */
  private fit(): void {
    const { width, height } = this.editor.doc;
    let s = this.fitScale;
    if (s * this.dpr > 2) s = Math.floor(s * this.dpr) / this.dpr;
    this.scale = s;
    this.ox = Math.round(((this.cssW - width * s) / 2) * this.dpr) / this.dpr;
    this.oy = Math.round(((this.cssH - height * s) / 2) * this.dpr) / this.dpr;
    this.moved = false;
    this.report();
  }

  /** Revient à la vue d'ensemble, en douceur. */
  reset(): void {
    const { width, height } = this.editor.doc;
    let s = this.fitScale;
    if (s * this.dpr > 2) s = Math.floor(s * this.dpr) / this.dpr;
    const to = {
      scale: s,
      ox: Math.round(((this.cssW - width * s) / 2) * this.dpr) / this.dpr,
      oy: Math.round(((this.cssH - height * s) / 2) * this.dpr) / this.dpr,
    };
    this.animateTo(to, () => {
      this.moved = false;
      this.report();
    });
  }

  private animateTo(to: { scale: number; ox: number; oy: number }, done: () => void): void {
    cancelAnimationFrame(this.anim);
    if (this.isReduced()) {
      Object.assign(this, { scale: to.scale, ox: to.ox, oy: to.oy });
      done();
      this.requestDraw();
      return;
    }
    const from = { scale: this.scale, ox: this.ox, oy: this.oy };
    const start = performance.now();
    const step = (now: number) => {
      const p = clamp((now - start) / 260, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      this.scale = from.scale + (to.scale - from.scale) * e;
      this.ox = from.ox + (to.ox - from.ox) * e;
      this.oy = from.oy + (to.oy - from.oy) * e;
      this.draw();
      this.report();
      if (p < 1) this.anim = requestAnimationFrame(step);
      else done();
    };
    this.anim = requestAnimationFrame(step);
  }

  private get minScale(): number {
    return this.fitScale * 0.6;
  }

  /** Plafond du zoom : jamais plus de quelques cases à l'écran. */
  private get maxScale(): number {
    return Math.max(MAX_CELL_PX, this.fitScale * 2);
  }

  private clampPan(): void {
    const { width, height } = this.editor.doc;
    const keepX = Math.min(90, width * this.scale * 0.5);
    const keepY = Math.min(90, height * this.scale * 0.5);
    this.ox = clamp(this.ox, keepX - width * this.scale, this.cssW - keepX);
    this.oy = clamp(this.oy, keepY - height * this.scale, this.cssH - keepY);
  }

  private report(): void {
    const zoom = Math.round((this.scale / this.fitScale) * 10) / 10;
    const info = { zoom, moved: this.moved };
    const key = `${String(zoom)}|${String(this.moved)}`;
    if (key === this.lastInfo) return;
    this.lastInfo = key;
    this.onInfo(info);
  }

  private zoomAt(p: Pt, factor: number): void {
    const s = clamp(this.scale * factor, this.minScale, this.maxScale);
    const k = s / this.scale;
    this.ox = p.x - (p.x - this.ox) * k;
    this.oy = p.y - (p.y - this.oy) * k;
    this.scale = s;
    this.moved = true;
    this.clampPan();
    this.report();
    this.requestDraw();
  }

  // ------------------------------------------------------------------ gestes

  private local(e: PointerEvent | WheelEvent): Pt {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private cellAt(p: Pt): [number, number] {
    return [Math.floor((p.x - this.ox) / this.scale), Math.floor((p.y - this.oy) / this.scale)];
  }

  private onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button === 0 && !this.space) e.preventDefault();
    cancelAnimationFrame(this.anim);
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || this.space)) {
        this.mode = 'pan';
        this.panFrom = { x: p.x, y: p.y, ox: this.ox, oy: this.oy };
        return;
      }
      if (e.pointerType === 'touch') {
        this.mode = 'pending';
        this.pendingId = e.pointerId;
        this.pendingStart = p;
        window.clearTimeout(this.pendingTimer);
        this.pendingTimer = window.setTimeout(() => {
          this.startDraw();
        }, TOUCH_DELAY);
      } else {
        this.pendingId = e.pointerId;
        this.pendingStart = p;
        this.mode = 'pending';
        this.startDraw();
      }
      return;
    }
    if (this.pointers.size === 2) {
      // deuxième doigt : le trait annoncé est abandonné, le pincement prend le relais
      window.clearTimeout(this.pendingTimer);
      if (this.mode === 'draw') this.editor.end();
      this.mode = 'pinch';
      const [a, b] = [...this.pointers.values()];
      if (a && b) {
        this.pinch = {
          dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          scale: this.scale,
          ox: this.ox,
          oy: this.oy,
        };
      }
    }
  }

  private startDraw(): void {
    window.clearTimeout(this.pendingTimer);
    if (this.mode !== 'pending') return;
    const now = this.pointers.get(this.pendingId);
    this.mode = 'draw';
    this.drawId = this.pendingId;
    const [x0, y0] = this.cellAt(this.pendingStart);
    this.editor.begin(x0, y0);
    if (now && (now.x !== this.pendingStart.x || now.y !== this.pendingStart.y)) {
      const [x1, y1] = this.cellAt(now);
      this.editor.move(x1, y1);
    }
  }

  private onMove(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    switch (this.mode) {
      case 'pending':
        if (Math.hypot(p.x - this.pendingStart.x, p.y - this.pendingStart.y) > 10) this.startDraw();
        break;
      case 'draw': {
        if (e.pointerId !== this.drawId) break;
        // les points intermédiaires du geste : un trait rapide reste continu
        const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        const events = list.length > 0 ? list : [e];
        for (const ev of events) {
          const [x, y] = this.cellAt(this.local(ev));
          this.editor.move(x, y);
        }
        break;
      }
      case 'pinch': {
        const [a, b] = [...this.pointers.values()];
        if (!a || !b) break;
        const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const s = clamp(this.pinch.scale * (dist / this.pinch.dist), this.minScale, this.maxScale);
        const docX = (this.pinch.mid.x - this.pinch.ox) / this.pinch.scale;
        const docY = (this.pinch.mid.y - this.pinch.oy) / this.pinch.scale;
        this.scale = s;
        this.ox = mid.x - docX * s;
        this.oy = mid.y - docY * s;
        this.moved = true;
        this.clampPan();
        this.report();
        this.requestDraw();
        break;
      }
      case 'pan':
        this.ox = this.panFrom.ox + (p.x - this.panFrom.x);
        this.oy = this.panFrom.oy + (p.y - this.panFrom.y);
        this.moved = true;
        this.clampPan();
        this.report();
        this.requestDraw();
        break;
      default:
        break;
    }
  }

  private onUp(e: PointerEvent, cancelled: boolean): void {
    if (!this.pointers.has(e.pointerId)) return;
    if (this.mode === 'pending' && e.pointerId === this.pendingId) {
      // simple toucher : le point est posé au relâchement
      if (!cancelled) this.startDraw();
      else {
        window.clearTimeout(this.pendingTimer);
        this.mode = 'idle';
      }
    }
    if (this.mode === 'draw' && e.pointerId === this.drawId) {
      this.editor.end();
      this.mode = 'idle';
    }
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) this.mode = 'idle';
    else if (this.mode === 'pinch' && this.pointers.size < 2) this.mode = 'idle';
    else if (this.mode === 'pan') this.mode = 'idle';
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    cancelAnimationFrame(this.anim);
    const p = this.local(e);
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0)
      this.zoomAt(p, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }

  // ------------------------------------------------------------------ dessin

  requestDraw(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  }

  private refreshArt(): void {
    const doc = this.editor.doc;
    if (this.artW !== doc.width || this.artH !== doc.height) {
      this.art.width = doc.width;
      this.art.height = doc.height;
      this.artW = doc.width;
      this.artH = doc.height;
    }
    this.artCtx.putImageData(new ImageData(docRgba(doc), doc.width, doc.height), 0, 0);
    this.artDirty = false;
  }

  private checkerPattern(): CanvasPattern | null {
    if (this.checker) return this.checker;
    const px = Math.max(2, Math.round(CHECKER * this.dpr));
    const tile = document.createElement('canvas');
    tile.width = px * 2;
    tile.height = px * 2;
    const c = tile.getContext('2d');
    if (!c) return null;
    c.fillStyle = this.colors.surface2;
    c.fillRect(0, 0, px * 2, px * 2);
    c.fillStyle = this.colors.surface3;
    c.fillRect(0, 0, px, px);
    c.fillRect(px, px, px, px);
    const pattern = this.ctx.createPattern(tile, 'repeat');
    pattern?.setTransform(new DOMMatrix().scale(1 / this.dpr));
    this.checker = pattern;
    return pattern;
  }

  draw(): void {
    if (this.cssW < 2) return;
    if (this.artDirty) this.refreshArt();
    const { ctx, dpr, scale: s, ox, oy } = this;
    const { width, height } = this.editor.doc;
    const w = width * s;
    const h = height * s;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);

    // damier de transparence : une case sur deux quand elles sont grandes (aligné sur la grille),
    // sinon des carreaux fixes
    const edge = (v: number) => Math.round(v * dpr) / dpr;
    const c0 = Math.max(0, Math.floor(-ox / s));
    const c1 = Math.min(width, Math.ceil((this.cssW - ox) / s));
    const r0 = Math.max(0, Math.floor(-oy / s));
    const r1 = Math.min(height, Math.ceil((this.cssH - oy) / s));
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, w, h);
    ctx.clip();
    if (s >= CHECKER_CELLS_FROM) {
      ctx.fillStyle = this.colors.surface2;
      ctx.fillRect(ox, oy, w, h);
      ctx.fillStyle = this.colors.surface3;
      ctx.globalAlpha = 0.6;
      for (let r = r0; r < r1; r++) {
        const y0 = edge(oy + r * s);
        const y1 = edge(oy + (r + 1) * s);
        for (let c = c0 + ((r + c0) % 2 === 1 ? 0 : 1); c < c1; c += 2) {
          const x0 = edge(ox + c * s);
          ctx.fillRect(x0, y0, edge(ox + (c + 1) * s) - x0, y1 - y0);
        }
      }
      ctx.globalAlpha = 1;
    } else {
      const pattern = this.checkerPattern();
      if (pattern) {
        ctx.translate(ox, oy);
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);
        ctx.translate(-ox, -oy);
      } else {
        ctx.fillStyle = this.colors.surface2;
        ctx.fillRect(ox, oy, w, h);
      }
    }
    // cases : plus proche voisin, jamais lissées
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.art, ox, oy, w, h);

    // grille fine, visible dès que les cases sont assez grandes
    if (s >= GRID_FROM) {
      ctx.globalAlpha = 0.22 * clamp((s - GRID_FROM) / (GRID_FULL - GRID_FROM), 0, 1);
      ctx.fillStyle = this.colors.ink;
      const line = 1 / dpr;
      const top = Math.max(oy, 0);
      const bottom = Math.min(oy + h, this.cssH);
      const left = Math.max(ox, 0);
      const right = Math.min(ox + w, this.cssW);
      for (let i = c0; i <= c1; i++) {
        const x = Math.round((ox + i * s) * dpr) / dpr;
        ctx.fillRect(x, top, line, bottom - top);
      }
      for (let j = r0; j <= r1; j++) {
        const y = Math.round((oy + j * s) * dpr) / dpr;
        ctx.fillRect(left, y, right - left, line);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // cadre de la toile
    ctx.strokeStyle = this.colors.outline;
    ctx.lineWidth = 1;
    ctx.strokeRect(ox - 0.5, oy - 0.5, w + 1, h + 1);

    // axes de symétrie
    const sym = this.editor.symmetry;
    if (sym !== 'none') {
      ctx.save();
      ctx.strokeStyle = this.colors.accent;
      ctx.lineWidth = 1.75;
      ctx.setLineDash([7, 6]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (sym === 'x' || sym === 'xy') {
        ctx.moveTo(ox + w / 2, oy - 8);
        ctx.lineTo(ox + w / 2, oy + h + 8);
      }
      if (sym === 'y' || sym === 'xy') {
        ctx.moveTo(ox - 8, oy + h / 2);
        ctx.lineTo(ox + w + 8, oy + h / 2);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}
