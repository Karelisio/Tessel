import { createGrid, MAX_COLORS, TRANSPARENT, type Grid, type Rgb } from '@/content/grid';

export { MAX_COLORS };
import { fromBase64, toBase64 } from '@/db/codecs';

/** Tailles de toile proposées (côté, en cases). */
export const CANVAS_SIZES = [16, 24, 32, 48, 64, 96, 128] as const;
export const MIN_SIDE = 8;
export const MAX_SIDE = 128;
export const MAX_LAYERS = 4;

/** Un calque : 0 = vide, k = couleur `palette[k - 1]`. */
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  cells: Uint8Array;
}

export interface CreationDoc {
  width: number;
  height: number;
  palette: Rgb[];
  /** Du bas vers le haut. */
  layers: Layer[];
}

let layerSeq = 0;
export const newLayerId = (): string => `l${Date.now().toString(36)}${String(layerSeq++)}`;

export function createDoc(
  width: number,
  height: number,
  palette: readonly Rgb[],
  layerName = 'Calque 1',
): CreationDoc {
  const w = clampSide(width);
  const h = clampSide(height);
  return {
    width: w,
    height: h,
    palette: palette.slice(0, MAX_COLORS),
    layers: [{ id: newLayerId(), name: layerName, visible: true, cells: new Uint8Array(w * h) }],
  };
}

export function clampSide(n: number): number {
  return Math.min(MAX_SIDE, Math.max(MIN_SIDE, Math.round(n)));
}

/** Copie profonde (historique, brouillons). */
export function cloneDoc(doc: CreationDoc): CreationDoc {
  return {
    width: doc.width,
    height: doc.height,
    palette: doc.palette.slice(),
    layers: doc.layers.map((l) => ({ ...l, cells: l.cells.slice() })),
  };
}

/** Image aplatie : pour chaque case, la couleur du calque visible le plus haut (0 = vide). */
export function flatten(doc: CreationDoc): Uint8Array {
  const out = new Uint8Array(doc.width * doc.height);
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    const c = layer.cells;
    for (let i = 0; i < out.length; i++) {
      const v = c[i] ?? 0;
      if (v !== 0) out[i] = v;
    }
  }
  return out;
}

/** Nombre de cases peintes (image aplatie). */
export function paintedCount(doc: CreationDoc): number {
  let n = 0;
  for (const v of flatten(doc)) if (v !== 0) n++;
  return n;
}

/**
 * Œuvre jouable : image aplatie, palette réduite aux couleurs utilisées (dans l'ordre de la palette),
 * cases vides transparentes. Lève une erreur si rien n'est peint.
 */
export function toGrid(doc: CreationDoc): Grid {
  const flat = flatten(doc);
  const used = new Map<number, number>();
  for (let k = 1; k <= doc.palette.length; k++) {
    if (flat.includes(k)) used.set(k, used.size);
  }
  if (used.size === 0) throw new Error('La création est vide');
  const palette: Rgb[] = [];
  for (const k of used.keys()) palette.push(doc.palette[k - 1] ?? [0, 0, 0]);
  const cells = new Uint8Array(flat.length);
  for (let i = 0; i < flat.length; i++) {
    const v = flat[i] ?? 0;
    cells[i] = v === 0 ? TRANSPARENT : (used.get(v) ?? 0);
  }
  return createGrid(doc.width, doc.height, palette, cells);
}

/** Reprend une œuvre (partagée, photo…) dans l'éditeur, sur un seul calque. */
export function fromGrid(grid: Grid, layerName = 'Calque 1'): CreationDoc {
  const cells = new Uint8Array(grid.cells.length);
  for (let i = 0; i < cells.length; i++) {
    const c = grid.cells[i] ?? TRANSPARENT;
    cells[i] = c === TRANSPARENT ? 0 : c + 1;
  }
  return {
    width: grid.width,
    height: grid.height,
    palette: grid.palette.slice(0, MAX_COLORS),
    layers: [{ id: newLayerId(), name: layerName, visible: true, cells }],
  };
}

interface SerializedDoc {
  v: 1;
  w: number;
  h: number;
  palette: string[];
  layers: { id: string; name: string; visible: boolean; cells: string }[];
}

const hex = ([r, g, b]: Rgb) => `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
const rgb = (h: string): Rgb => {
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function serializeDoc(doc: CreationDoc): string {
  const s: SerializedDoc = {
    v: 1,
    w: doc.width,
    h: doc.height,
    palette: doc.palette.map(hex),
    layers: doc.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, cells: toBase64(l.cells) })),
  };
  return JSON.stringify(s);
}

export function parseDoc(text: string): CreationDoc {
  const s = JSON.parse(text) as SerializedDoc;
  if ((s.v as number) !== 1) throw new Error('Création illisible');
  const size = s.w * s.h;
  return {
    width: s.w,
    height: s.h,
    palette: s.palette.map(rgb),
    layers: s.layers.map((l) => {
      const cells = fromBase64(l.cells);
      if (cells.length !== size) throw new Error('Calque corrompu');
      return { id: l.id, name: l.name, visible: l.visible, cells };
    }),
  };
}
