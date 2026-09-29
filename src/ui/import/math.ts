export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Ramène une valeur sur la grille `min + n × step`, bornée à [min, max], sans bruit de virgule flottante. */
export function snapValue(v: number, min: number, max: number, step: number): number {
  const n = Math.round((v - min) / step);
  return clamp(Math.round((min + n * step) * 1e6) / 1e6, min, max) + 0;
}
