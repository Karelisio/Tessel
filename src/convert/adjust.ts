import { gamutMap } from './color';
import type { CellImage } from './resample';

export interface Adjustments {
  /** -1 (plus sombre) … +1 (plus clair) : courbe gamma sur la luminosité, sans écrêter noirs et blancs. */
  brightness: number;
  /** -1 … +1 : étirement de la luminosité autour du gris moyen. */
  contrast: number;
  /** -1 (noir et blanc) … +1 (couleurs deux fois plus saturées). */
  saturation: number;
  /** 0 … 1 : netteté (masque flou sur la luminosité) pour compenser la réduction. */
  sharpen: number;
}

export const NEUTRAL: Adjustments = { brightness: 0, contrast: 0, saturation: 0, sharpen: 0 };

/** Applique les réglages sur place, en OKLab (teintes préservées), puis ramène dans le gamut sRGB. */
export function applyAdjustments(img: CellImage, adj: Adjustments): void {
  const { width: w, height: h, lab } = img;
  const n = w * h;

  if (adj.sharpen > 0) {
    // flou 3×3 (1-2-1) de la luminosité, puis L += k (L − flou)
    const L = new Float32Array(n);
    for (let i = 0; i < n; i++) L[i] = lab[i * 3] ?? 0;
    const k = adj.sharpen * 1.2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let wt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.min(w - 1, Math.max(0, x + dx));
            const kw = (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
            sum += (L[yy * w + xx] ?? 0) * kw;
            wt += kw;
          }
        }
        const i = y * w + x;
        const l = L[i] ?? 0;
        lab[i * 3] = Math.max(0, Math.min(1, l + k * (l - sum / wt)));
      }
    }
  }

  const gamma = 2 ** -adj.brightness;
  const contrast = 1 + adj.contrast;
  const sat = Math.max(0, 1 + adj.saturation);
  const identity = adj.brightness === 0 && adj.contrast === 0 && adj.saturation === 0;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    if (!identity) {
      let l = lab[o] ?? 0;
      l = Math.max(0, Math.min(1, l)) ** gamma;
      l = 0.5 + (l - 0.5) * contrast;
      lab[o] = Math.max(0, Math.min(1, l));
      lab[o + 1] = (lab[o + 1] ?? 0) * sat;
      lab[o + 2] = (lab[o + 2] ?? 0) * sat;
    }
    gamutMap(lab, o);
  }
}
