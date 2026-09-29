import { TRANSPARENT } from '@/content/grid';
import { nearest } from './quantize';

/** Attribue à chaque case la couleur de palette la plus proche (OKLab). */
export function assignNearest(lab: Float32Array, include: Uint8Array, palette: Float32Array): Uint8Array {
  const k = palette.length / 3;
  const out = new Uint8Array(include.length);
  for (let i = 0; i < include.length; i++) {
    out[i] = include[i]
      ? nearest(palette, k, lab[i * 3] ?? 0, lab[i * 3 + 1] ?? 0, lab[i * 3 + 2] ?? 0)
      : TRANSPARENT;
  }
  return out;
}

/**
 * Tramage Floyd–Steinberg en OKLab, parcours en serpentin (pas de traînées diagonales),
 * erreur atténuée et bornée pour éviter le bruit. Les cases transparentes ne reçoivent ni ne diffusent d'erreur.
 */
export function assignDithered(
  lab: Float32Array,
  include: Uint8Array,
  width: number,
  height: number,
  palette: Float32Array,
  strength = 0.75,
): Uint8Array {
  const k = palette.length / 3;
  const work = lab.slice();
  const out = new Uint8Array(include.length);
  const clampErr = 0.25;
  const push = (x: number, y: number, e: readonly number[], f: number) => {
    if (x < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (!include[i]) return;
    for (let c = 0; c < 3; c++) work[i * 3 + c] = (work[i * 3 + c] ?? 0) + (e[c] ?? 0) * f;
  };
  const err = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    const ltr = y % 2 === 0;
    for (let s = 0; s < width; s++) {
      const x = ltr ? s : width - 1 - s;
      const i = y * width + x;
      if (!include[i]) {
        out[i] = TRANSPARENT;
        continue;
      }
      const l = work[i * 3] ?? 0;
      const a = work[i * 3 + 1] ?? 0;
      const b = work[i * 3 + 2] ?? 0;
      const j = nearest(palette, k, l, a, b);
      out[i] = j;
      err[0] = Math.max(-clampErr, Math.min(clampErr, (l - (palette[j * 3] ?? 0)) * strength));
      err[1] = Math.max(-clampErr, Math.min(clampErr, (a - (palette[j * 3 + 1] ?? 0)) * strength));
      err[2] = Math.max(-clampErr, Math.min(clampErr, (b - (palette[j * 3 + 2] ?? 0)) * strength));
      const dir = ltr ? 1 : -1;
      push(x + dir, y, err, 7 / 16);
      push(x - dir, y + 1, err, 3 / 16);
      push(x, y + 1, err, 5 / 16);
      push(x + dir, y + 1, err, 1 / 16);
    }
  }
  return out;
}
