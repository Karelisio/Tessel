import { createGrid, TRANSPARENT, type Grid, type Rgb } from './grid';

/**
 * Scène procédurale : index de palette (ou TRANSPARENT) au point (x, y), x ∈ [0, 1] de gauche à droite,
 * y ∈ [0, aspect] de haut en bas (aspect = hauteur / largeur). Indépendante de la résolution.
 */
export type Scene = (x: number, y: number) => number;

/**
 * Échantillonne une scène sur une grille : sur-échantillonnage `ss×ss` par case et vote majoritaire
 * (bords nets, pas de couleur intermédiaire), puis suppression des cases isolées.
 */
export function rasterize(
  scene: Scene,
  width: number,
  height: number,
  palette: readonly Rgb[],
  ss = 3,
): Grid {
  const cells = new Uint8Array(width * height);
  const votes = new Map<number, number>();
  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      votes.clear();
      let best = TRANSPARENT;
      let bestN = 0;
      for (let j = 0; j < ss; j++)
        for (let i = 0; i < ss; i++) {
          const c = scene((cx + (i + 0.5) / ss) / width, (cy + (j + 0.5) / ss) / width);
          const n = (votes.get(c) ?? 0) + 1;
          votes.set(c, n);
          if (n > bestN) {
            bestN = n;
            best = c;
          }
        }
      cells[cy * width + cx] = best;
    }
  }
  despeckle(cells, width, height);
  // la scène peut ne pas utiliser toutes les couleurs : on compacte la palette
  const used = new Map<number, number>();
  const compact: Rgb[] = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i] ?? TRANSPARENT;
    if (c === TRANSPARENT) continue;
    let k = used.get(c);
    if (k === undefined) {
      k = compact.length;
      used.set(c, k);
      compact.push(palette[c] ?? [255, 0, 255]);
    }
    cells[i] = k;
  }
  // ordre stable : la palette suit l'ordre de la palette d'origine
  const order = [...used.entries()].sort((a, b) => a[0] - b[0]);
  const remap = new Uint8Array(256).fill(TRANSPARENT);
  order.forEach(([, k], idx) => (remap[k] = idx));
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i] ?? TRANSPARENT;
    if (c !== TRANSPARENT) cells[i] = remap[c] ?? TRANSPARENT;
  }
  return createGrid(
    width,
    height,
    order.map(([orig]) => palette[orig] ?? [255, 0, 255]),
    cells,
  );
}

/** Une case entourée de 4 voisines d'une autre couleur prend la couleur majoritaire des voisines. */
function despeckle(cells: Uint8Array, w: number, h: number): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = cells[i];
      const n = [
        x > 0 ? cells[i - 1] : undefined,
        x < w - 1 ? cells[i + 1] : undefined,
        y > 0 ? cells[i - w] : undefined,
        y < h - 1 ? cells[i + w] : undefined,
      ].filter((v): v is number => v !== undefined);
      if (n.length < 3 || n.includes(c ?? -1)) continue;
      const count = new Map<number, number>();
      for (const v of n) count.set(v, (count.get(v) ?? 0) + 1);
      let best = n[0] ?? 0;
      for (const [v, k] of count) if (k > (count.get(best) ?? 0)) best = v;
      cells[i] = best;
    }
}

// --- Petits outils géométriques pour écrire les scènes -------------------------------------------

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const len = (x: number, y: number) => Math.hypot(x, y);
/** Angle polaire dans [0, 2π). */
export const angle = (x: number, y: number) => {
  const a = Math.atan2(y, x);
  return a < 0 ? a + Math.PI * 2 : a;
};
/** Distance signée à un segment (épaisseur incluse ailleurs). */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const t = clamp01(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1));
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}
