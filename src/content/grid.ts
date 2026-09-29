/** Modèle d'une grille jouable : dimensions, palette et index de couleur par case. */

export type Rgb = readonly [number, number, number];

/** Index réservé : case transparente (rien à colorier). */
export const TRANSPARENT = 255;
export const MAX_COLORS = 64;

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly palette: readonly Rgb[];
  /** Index de palette par case (ligne par ligne), `TRANSPARENT` pour une case vide. */
  readonly cells: Uint8Array;
}

export function createGrid(width: number, height: number, palette: readonly Rgb[], cells: Uint8Array): Grid {
  if (width < 1 || height < 1) throw new Error('Grille vide');
  if (cells.length !== width * height) throw new Error('Taille des cases incohérente');
  if (palette.length === 0 || palette.length > MAX_COLORS) throw new Error('Palette invalide');
  for (const c of cells) {
    if (c !== TRANSPARENT && c >= palette.length) throw new Error(`Index de couleur hors palette : ${c}`);
  }
  return { width, height, palette, cells };
}

/** Nombre de cases par couleur. */
export function countByColor(grid: Grid): Uint32Array {
  const counts = new Uint32Array(grid.palette.length);
  for (const c of grid.cells) if (c !== TRANSPARENT) counts[c] = (counts[c] ?? 0) + 1;
  return counts;
}

export function hexToRgb(hex: string): Rgb {
  const v = Number.parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Luminance relative sRGB (WCAG), 0–1. */
export function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
