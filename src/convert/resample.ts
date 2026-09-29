import { SRGB_TO_LINEAR, linearToOklab } from './color';

/** Rectangle de recadrage en pixels source (valeurs fractionnaires acceptées). */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Image au format de la grille : une couleur OKLab et une couverture alpha par case. */
export interface CellImage {
  width: number;
  height: number;
  /** L, a, b par case. */
  lab: Float32Array;
  /** Couverture 0–1 (transparence des PNG). */
  alpha: Float32Array;
}

interface Tap {
  start: number;
  weights: Float32Array;
}

/** Poids de recouvrement exact des pixels source pour chaque case (filtre boîte, bords fractionnaires). */
function taps(origin: number, span: number, cells: number, limit: number): Tap[] {
  const step = span / cells;
  const out: Tap[] = [];
  for (let i = 0; i < cells; i++) {
    const a = origin + i * step;
    const b = a + step;
    const start = Math.max(0, Math.floor(a));
    const end = Math.min(limit, Math.ceil(b));
    const weights = new Float32Array(Math.max(1, end - start));
    let total = 0;
    for (let p = start; p < end; p++) {
      const w = Math.max(0, Math.min(b, p + 1) - Math.max(a, p));
      weights[p - start] = w;
      total += w;
    }
    if (total <= 0) weights[0] = total = 1;
    for (let k = 0; k < weights.length; k++) weights[k] = (weights[k] ?? 0) / total;
    out.push({ start: Math.min(start, limit - 1), weights });
  }
  return out;
}

/**
 * Réduit une image RGBA en `width × height` cases par moyenne des surfaces, en lumière linéaire
 * et alpha prémultiplié (pas d'assombrissement des bords ni de franges). Filtre séparable :
 * coût proportionnel au nombre de pixels source.
 */
export function resampleToCells(
  pixels: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
  width: number,
  height: number,
  crop: CropRect = { x: 0, y: 0, w: srcW, h: srcH },
): CellImage {
  const cols = taps(crop.x, crop.w, width, srcW);
  const rows = taps(crop.y, crop.h, height, srcH);
  const y0 = rows[0]?.start ?? 0;
  const lastRow = rows[rows.length - 1];
  const y1 = lastRow ? lastRow.start + lastRow.weights.length : 1;
  const rowCount = y1 - y0;

  // passe horizontale : chaque ligne source utile → `width` colonnes (r, g, b prémultipliés, a)
  const tmp = new Float32Array(rowCount * width * 4);
  for (let y = y0; y < y1; y++) {
    const rowBase = y * srcW * 4;
    const out = (y - y0) * width * 4;
    for (let j = 0; j < width; j++) {
      const tap = cols[j];
      if (!tap) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < tap.weights.length; k++) {
        const w = tap.weights[k] ?? 0;
        const p = rowBase + (tap.start + k) * 4;
        const al = ((pixels[p + 3] ?? 255) / 255) * w;
        r += (SRGB_TO_LINEAR[pixels[p] ?? 0] ?? 0) * al;
        g += (SRGB_TO_LINEAR[pixels[p + 1] ?? 0] ?? 0) * al;
        b += (SRGB_TO_LINEAR[pixels[p + 2] ?? 0] ?? 0) * al;
        a += al;
      }
      const o = out + j * 4;
      tmp[o] = r;
      tmp[o + 1] = g;
      tmp[o + 2] = b;
      tmp[o + 3] = a;
    }
  }

  // passe verticale puis conversion en OKLab
  const lab = new Float32Array(width * height * 3);
  const alpha = new Float32Array(width * height);
  for (let i = 0; i < height; i++) {
    const tap = rows[i];
    if (!tap) continue;
    for (let j = 0; j < width; j++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < tap.weights.length; k++) {
        const w = tap.weights[k] ?? 0;
        const o = ((tap.start - y0 + k) * width + j) * 4;
        r += (tmp[o] ?? 0) * w;
        g += (tmp[o + 1] ?? 0) * w;
        b += (tmp[o + 2] ?? 0) * w;
        a += (tmp[o + 3] ?? 0) * w;
      }
      const c = i * width + j;
      alpha[c] = a;
      if (a > 1e-5) linearToOklab(r / a, g / a, b / a, lab, c * 3);
      else linearToOklab(1, 1, 1, lab, c * 3);
    }
  }
  return { width, height, lab, alpha };
}

/** Dimensions de grille pour un format donné, côté le plus long = `longSide` (max 300). */
export function gridSizeFor(aspect: number, longSide: number): { width: number; height: number } {
  const n = Math.max(8, Math.min(300, Math.round(longSide)));
  if (aspect >= 1) return { width: n, height: Math.max(8, Math.round(n / aspect)) };
  return { width: Math.max(8, Math.round(n * aspect)), height: n };
}
