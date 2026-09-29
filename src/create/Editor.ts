import type { Rgb } from '@/content/grid';
import {
  cloneDoc,
  flatten,
  MAX_COLORS,
  MAX_LAYERS,
  newLayerId,
  type CreationDoc,
  type Layer,
} from './document';

export type Tool = 'pencil' | 'eraser' | 'bucket' | 'eyedropper';
export type Symmetry = 'none' | 'x' | 'y' | 'xy';

/** Ce qui a changé (l'interface ne redessine que ce qu'il faut). */
export type EditorChange = 'cells' | 'layers' | 'palette' | 'state';

type Step =
  | { kind: 'cells'; layer: string; index: Int32Array; before: Uint8Array; after: Uint8Array }
  | { kind: 'doc'; before: CreationDoc; after: CreationDoc; active: [number, number] };

const HISTORY = 120;

/** Trace de Bresenham entre deux cases (incluses). */
export function line(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

/**
 * Éditeur de pixel art : crayon, gomme, pot, pipette, symétrie, calques, palette, annuler/rétablir.
 * Modèle pur (sans DOM) : l'interface appelle `begin`/`move`/`end` avec des coordonnées de case.
 */
export class Editor {
  doc: CreationDoc;
  tool: Tool = 'pencil';
  symmetry: Symmetry = 'none';
  /** Taille du pinceau (côté du carré, 1–3). */
  brush = 1;
  /** Couleur courante (index de palette, 0-based). */
  color = 0;
  active = 0;

  private undoStack: Step[] = [];
  private redoStack: Step[] = [];
  private stroke: { layer: Layer; changed: Map<number, number>; last: [number, number] | null } | null = null;
  private previousTool: Tool = 'pencil';
  private readonly listeners = new Set<(c: EditorChange) => void>();

  constructor(doc: CreationDoc) {
    this.doc = doc;
    this.active = Math.max(0, doc.layers.length - 1);
  }

  on(listener: (c: EditorChange) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(c: EditorChange): void {
    for (const l of this.listeners) l(c);
  }

  get layer(): Layer | undefined {
    return this.doc.layers[this.active];
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  setTool(tool: Tool): void {
    if (tool === 'eyedropper' && this.tool !== 'eyedropper') this.previousTool = this.tool;
    this.tool = tool;
    this.emit('state');
  }

  setColor(i: number): void {
    this.color = Math.max(0, Math.min(this.doc.palette.length - 1, i));
    if (this.tool === 'eraser' || this.tool === 'eyedropper') this.tool = 'pencil';
    this.emit('state');
  }

  setSymmetry(s: Symmetry): void {
    this.symmetry = s;
    this.emit('state');
  }

  setBrush(n: number): void {
    this.brush = Math.max(1, Math.min(3, Math.round(n)));
    this.emit('state');
  }

  // ------------------------------------------------------------------ gestes

  /** Début d'un geste sur la case (x, y). */
  begin(x: number, y: number): void {
    const layer = this.layer;
    if (!layer || !this.inside(x, y)) return;
    if (this.tool === 'eyedropper') {
      const v = flatten(this.doc)[y * this.doc.width + x] ?? 0;
      if (v !== 0) this.color = v - 1;
      this.tool = this.previousTool === 'eraser' ? 'pencil' : this.previousTool;
      this.emit('state');
      return;
    }
    // un calque masqué n'est pas modifiable : on le réaffiche d'abord
    if (!layer.visible) {
      layer.visible = true;
      this.emit('layers');
    }
    this.stroke = { layer, changed: new Map(), last: null };
    if (this.tool === 'bucket') {
      for (const [mx, my] of this.mirrors(x, y)) this.fill(mx, my);
      this.end();
      return;
    }
    this.move(x, y);
  }

  /** Le doigt glisse : trait continu jusqu'à (x, y). */
  move(x: number, y: number): void {
    const s = this.stroke;
    if (!s) return;
    const cx = Math.max(0, Math.min(this.doc.width - 1, x));
    const cy = Math.max(0, Math.min(this.doc.height - 1, y));
    const from = s.last ?? [cx, cy];
    const value = this.tool === 'eraser' ? 0 : this.color + 1;
    const r0 = -Math.floor((this.brush - 1) / 2);
    for (const [px, py] of line(from[0], from[1], cx, cy)) {
      for (let oy = r0; oy < r0 + this.brush; oy++)
        for (let ox = r0; ox < r0 + this.brush; ox++)
          for (const [mx, my] of this.mirrors(px + ox, py + oy)) this.set(mx, my, value);
    }
    s.last = [cx, cy];
    this.emit('cells');
  }

  end(): void {
    const s = this.stroke;
    this.stroke = null;
    if (!s || s.changed.size === 0) return;
    const index = Int32Array.from(s.changed.keys());
    const before = Uint8Array.from(s.changed.values());
    const after = new Uint8Array(index.length);
    index.forEach((i, k) => {
      after[k] = s.layer.cells[i] ?? 0;
    });
    this.push({ kind: 'cells', layer: s.layer.id, index, before, after });
    this.emit('cells');
  }

  private inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.doc.width && y < this.doc.height;
  }

  /** La case et ses reflets selon la symétrie (sans doublons). */
  private mirrors(x: number, y: number): [number, number][] {
    const { width: w, height: h } = this.doc;
    const pts: [number, number][] = [[x, y]];
    if (this.symmetry === 'x' || this.symmetry === 'xy') pts.push([w - 1 - x, y]);
    if (this.symmetry === 'y' || this.symmetry === 'xy') pts.push([x, h - 1 - y]);
    if (this.symmetry === 'xy') pts.push([w - 1 - x, h - 1 - y]);
    return pts.filter(
      ([px, py], k) => this.inside(px, py) && pts.findIndex(([qx, qy]) => qx === px && qy === py) === k,
    );
  }

  private set(x: number, y: number, value: number): void {
    const s = this.stroke;
    if (!s || !this.inside(x, y)) return;
    const i = y * this.doc.width + x;
    const old = s.layer.cells[i] ?? 0;
    if (old === value) return;
    if (!s.changed.has(i)) s.changed.set(i, old);
    s.layer.cells[i] = value;
  }

  /** Pot de peinture : zone contiguë de même valeur sur le calque actif (4 voisins). */
  private fill(x: number, y: number): void {
    const s = this.stroke;
    if (!s) return;
    const { width: w, height: h } = this.doc;
    const cells = s.layer.cells;
    const target = cells[y * w + x] ?? 0;
    const value = this.color + 1;
    if (target === value) return;
    const stack = [y * w + x];
    const seen = new Uint8Array(w * h);
    while (stack.length > 0) {
      const i = stack.pop() ?? 0;
      if (seen[i] || cells[i] !== target) continue;
      seen[i] = 1;
      const px = i % w;
      const py = (i - px) / w;
      this.set(px, py, value);
      if (px > 0) stack.push(i - 1);
      if (px < w - 1) stack.push(i + 1);
      if (py > 0) stack.push(i - w);
      if (py < h - 1) stack.push(i + w);
    }
  }

  // ------------------------------------------------------------------ historique

  private push(step: Step): void {
    this.undoStack.push(step);
    if (this.undoStack.length > HISTORY) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): void {
    const step = this.undoStack.pop();
    if (!step) return;
    this.apply(step, true);
    this.redoStack.push(step);
  }

  redo(): void {
    const step = this.redoStack.pop();
    if (!step) return;
    this.apply(step, false);
    this.undoStack.push(step);
  }

  private apply(step: Step, back: boolean): void {
    if (step.kind === 'cells') {
      const layer = this.doc.layers.find((l) => l.id === step.layer);
      if (!layer) return;
      const values = back ? step.before : step.after;
      step.index.forEach((i, k) => {
        layer.cells[i] = values[k] ?? 0;
      });
      this.emit('cells');
      return;
    }
    this.doc = cloneDoc(back ? step.before : step.after);
    this.active = Math.min(back ? step.active[0] : step.active[1], this.doc.layers.length - 1);
    this.color = Math.min(this.color, this.doc.palette.length - 1);
    this.emit('layers');
    this.emit('palette');
    this.emit('cells');
  }

  /** Modification structurelle (calques, palette) enregistrée d'un bloc dans l'historique. */
  private structural(change: (doc: CreationDoc) => number | undefined, kinds: EditorChange[]): void {
    const before = cloneDoc(this.doc);
    const activeBefore = this.active;
    const next = change(this.doc);
    if (next !== undefined) this.active = next;
    this.push({ kind: 'doc', before, after: cloneDoc(this.doc), active: [activeBefore, this.active] });
    for (const k of kinds) this.emit(k);
  }

  // ------------------------------------------------------------------ calques

  addLayer(name: string): boolean {
    if (this.doc.layers.length >= MAX_LAYERS) return false;
    this.structural(
      (doc) => {
        doc.layers.splice(this.active + 1, 0, {
          id: newLayerId(),
          name,
          visible: true,
          cells: new Uint8Array(doc.width * doc.height),
        });
        return this.active + 1;
      },
      ['layers', 'cells'],
    );
    return true;
  }

  removeLayer(i: number): boolean {
    if (this.doc.layers.length <= 1 || !this.doc.layers[i]) return false;
    this.structural(
      (doc) => {
        doc.layers.splice(i, 1);
        return Math.min(this.active, doc.layers.length - 1);
      },
      ['layers', 'cells'],
    );
    return true;
  }

  moveLayer(from: number, to: number): void {
    const n = this.doc.layers.length;
    if (from === to || from < 0 || to < 0 || from >= n || to >= n) return;
    this.structural(
      (doc) => {
        const [l] = doc.layers.splice(from, 1);
        if (l) doc.layers.splice(to, 0, l);
        return this.active === from ? to : undefined;
      },
      ['layers', 'cells'],
    );
  }

  /** Fusionne le calque avec celui du dessous (ses cases peintes recouvrent). */
  mergeDown(i: number): void {
    const upper = this.doc.layers[i];
    const lower = this.doc.layers[i - 1];
    if (!upper || !lower) return;
    this.structural(
      (doc) => {
        const up = doc.layers[i];
        const low = doc.layers[i - 1];
        if (!up || !low) return undefined;
        up.cells.forEach((v, k) => {
          if (v !== 0) low.cells[k] = v;
        });
        doc.layers.splice(i, 1);
        return i - 1;
      },
      ['layers', 'cells'],
    );
  }

  toggleVisible(i: number): void {
    const l = this.doc.layers[i];
    if (!l) return;
    l.visible = !l.visible;
    this.emit('layers');
    this.emit('cells');
  }

  renameLayer(i: number, name: string): void {
    const l = this.doc.layers[i];
    if (!l) return;
    l.name = name.trim().slice(0, 24) || l.name;
    this.emit('layers');
  }

  setActive(i: number): void {
    if (!this.doc.layers[i]) return;
    this.active = i;
    this.emit('layers');
  }

  clearLayer(): void {
    const layer = this.layer;
    if (!layer || layer.cells.every((v) => v === 0)) return;
    this.stroke = { layer, changed: new Map(), last: null };
    layer.cells.forEach((v, i) => {
      if (v !== 0) this.stroke?.changed.set(i, v);
    });
    layer.cells.fill(0);
    this.end();
  }

  // ------------------------------------------------------------------ palette

  /** Remplace une couleur (tout ce qui l'utilise change avec elle). */
  setPaletteColor(i: number, c: Rgb): void {
    if (!this.doc.palette[i]) return;
    this.structural(
      (doc) => {
        doc.palette[i] = c;
        return undefined;
      },
      ['palette', 'cells'],
    );
  }

  addColor(c: Rgb): boolean {
    if (this.doc.palette.length >= MAX_COLORS) return false;
    this.structural(
      (doc) => {
        doc.palette.push(c);
        return undefined;
      },
      ['palette'],
    );
    this.color = this.doc.palette.length - 1;
    this.emit('state');
    return true;
  }

  /**
   * Change de palette : chaque couleur de la création prend la plus proche dans la nouvelle
   * (les cases gardent leur dessin).
   */
  applyPalette(colors: readonly Rgb[]): void {
    if (colors.length === 0) return;
    const next = colors.slice(0, MAX_COLORS);
    const map = this.doc.palette.map((c) => nearest(c, next));
    this.structural(
      (doc) => {
        for (const l of doc.layers)
          l.cells.forEach((v, k) => {
            if (v !== 0) l.cells[k] = (map[v - 1] ?? 0) + 1;
          });
        doc.palette = next;
        return undefined;
      },
      ['palette', 'cells'],
    );
    this.color = Math.min(this.color, next.length - 1);
    this.emit('state');
  }
}

/** Couleur la plus proche (distance perceptive approchée « redmean »). */
export function nearest(c: Rgb, palette: readonly Rgb[]): number {
  let best = 0;
  let bestD = Infinity;
  palette.forEach(([r, g, b], i) => {
    const rm = (c[0] + r) / 2;
    const dr = c[0] - r;
    const dg = c[1] - g;
    const db = c[2] - b;
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}
