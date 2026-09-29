import { TRANSPARENT, type Grid, type Rgb } from '@/content/grid';
import { flatten, type CreationDoc, type Layer } from '@/create/document';

/** Pixels RGBA d'une création aplatie (cases vides transparentes). */
export function docRgba(doc: CreationDoc): Uint8ClampedArray<ArrayBuffer> {
  const flat = flatten(doc);
  const out = new Uint8ClampedArray(flat.length * 4);
  for (let i = 0; i < flat.length; i++) {
    const v = flat[i] ?? 0;
    if (v === 0) continue;
    const [r, g, b] = doc.palette[v - 1] ?? [0, 0, 0];
    out.set([r, g, b, 255], i * 4);
  }
  return out;
}

/** Pixels RGBA d'un seul calque. */
export function layerRgba(layer: Layer, palette: readonly Rgb[]): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(layer.cells.length * 4);
  layer.cells.forEach((v, i) => {
    if (v === 0) return;
    const [r, g, b] = palette[v - 1] ?? [0, 0, 0];
    out.set([r, g, b, 255], i * 4);
  });
  return out;
}

/** Pixels RGBA d'une grille jouable. */
export function gridRgba(grid: Grid): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(grid.cells.length * 4);
  for (let i = 0; i < grid.cells.length; i++) {
    const c = grid.cells[i] ?? TRANSPARENT;
    if (c === TRANSPARENT) continue;
    const [r, g, b] = grid.palette[c] ?? [0, 0, 0];
    out.set([r, g, b, 255], i * 4);
  }
  return out;
}

export interface Pixels {
  w: number;
  h: number;
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

/**
 * Dessine des pixels dans un canvas, agrandis par un facteur entier (cases nettes) pour une largeur cible
 * en pixels de l'appareil : la vignette reste nette quelle que soit la taille de la toile.
 */
export function paintPixels(canvas: HTMLCanvasElement, { w, h, rgba }: Pixels, targetPx: number): void {
  const k = Math.max(1, Math.round(targetPx / Math.max(w, h)));
  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  src.getContext('2d')?.putImageData(new ImageData(rgba, w, h), 0, 0);
  canvas.width = w * k;
  canvas.height = h * k;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
}

/** Taille d'affichage (CSS) d'une image w×h dans une boîte carrée. */
export function fitBox(w: number, h: number, box: number): { width: number; height: number } {
  const k = box / Math.max(w, h);
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

/** Image de la création agrandie (plus proche voisin), fond transparent : partage en PNG. */
export function renderPng(doc: CreationDoc, longSide = 1024): HTMLCanvasElement {
  const k = Math.max(4, Math.floor(longSide / Math.max(doc.width, doc.height)));
  const out = document.createElement('canvas');
  paintPixels(out, { w: doc.width, h: doc.height, rgba: docRgba(doc) }, Math.max(doc.width, doc.height) * k);
  return out;
}

/** Nombre de cases peintes et de couleurs utilisées d'une grille. */
export function gridStats(grid: Grid): { cells: number; colors: number } {
  let cells = 0;
  const used = new Set<number>();
  for (const c of grid.cells) {
    if (c === TRANSPARENT) continue;
    cells++;
    used.add(c);
  }
  return { cells, colors: used.size };
}
