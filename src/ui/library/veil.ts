import { TRANSPARENT, type Grid } from '@/content/grid';

/**
 * Œuvre voilée (pas encore terminée) : moyenne des couleurs sur `blocks × blocks` zones du carré
 * qui contient la grille, un peu désaturée. Il ne reste que l'ambiance des couleurs, pas le dessin.
 * Renvoie des pixels RGBA (alpha = part de cases non transparentes de la zone).
 */
export function veilPixels(g: Grid, blocks = 4): Uint8ClampedArray<ArrayBuffer> {
  const side = Math.max(g.width, g.height);
  const ox = Math.floor((side - g.width) / 2);
  const oy = Math.floor((side - g.height) / 2);
  const acc = new Float64Array(blocks * blocks * 4);
  const area = new Float64Array(blocks * blocks);
  for (let y = 0; y < side; y++) {
    const by = Math.min(blocks - 1, Math.floor((y * blocks) / side));
    for (let x = 0; x < side; x++) {
      const b = by * blocks + Math.min(blocks - 1, Math.floor((x * blocks) / side));
      area[b] = (area[b] ?? 0) + 1;
      const gx = x - ox;
      const gy = y - oy;
      if (gx < 0 || gy < 0 || gx >= g.width || gy >= g.height) continue;
      const c = g.cells[gy * g.width + gx] ?? TRANSPARENT;
      if (c === TRANSPARENT) continue;
      const [r, gg, bb] = g.palette[c] ?? [0, 0, 0];
      acc[b * 4] = (acc[b * 4] ?? 0) + r;
      acc[b * 4 + 1] = (acc[b * 4 + 1] ?? 0) + gg;
      acc[b * 4 + 2] = (acc[b * 4 + 2] ?? 0) + bb;
      acc[b * 4 + 3] = (acc[b * 4 + 3] ?? 0) + 1;
    }
  }
  const out = new Uint8ClampedArray(blocks * blocks * 4);
  for (let b = 0; b < blocks * blocks; b++) {
    const n = acc[b * 4 + 3] ?? 0;
    if (n === 0) continue;
    const r = (acc[b * 4] ?? 0) / n;
    const gg = (acc[b * 4 + 1] ?? 0) / n;
    const bb = (acc[b * 4 + 2] ?? 0) / n;
    const grey = 0.3 * r + 0.59 * gg + 0.11 * bb;
    const k = 0.35;
    out.set(
      [r + (grey - r) * k, gg + (grey - gg) * k, bb + (grey - bb) * k, (255 * n) / (area[b] ?? 1)],
      b * 4,
    );
  }
  return out;
}

/** Dessine l'œuvre voilée : les zones moyennes étirées en douceur puis floutées. */
export function drawVeil(el: HTMLCanvasElement, g: Grid): void {
  const blocks = 4;
  const small = document.createElement('canvas');
  small.width = blocks;
  small.height = blocks;
  small.getContext('2d')?.putImageData(new ImageData(veilPixels(g, blocks), blocks, blocks), 0, 0);
  const size = 64;
  el.width = size;
  el.height = size;
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = 'blur(5px)';
  // débord : le flou ne s'estompe pas sur les bords
  ctx.drawImage(small, -size * 0.15, -size * 0.15, size * 1.3, size * 1.3);
  ctx.filter = 'none';
}
