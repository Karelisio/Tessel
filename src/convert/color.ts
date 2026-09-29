/**
 * Espaces colorimétriques : sRGB 8 bits ↔ RGB linéaire ↔ OKLab (Björn Ottosson, 2020).
 * OKLab est perceptuellement uniforme : une distance euclidienne y correspond à un écart visible
 * (≈ 0,02 = à peine perceptible). Toute la conversion d'image travaille dans cet espace.
 */

/** sRGB 8 bits → RGB linéaire (table précalculée). */
export const SRGB_TO_LINEAR = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    t[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return t;
})();

/** RGB linéaire (0–1) → sRGB 8 bits, arrondi et borné. */
export function linearToSrgb8(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

export type Lab = [number, number, number];

/** RGB linéaire → OKLab ; écrit dans `out` à la position `o` (évite les allocations dans les boucles). */
export function linearToOklab(r: number, g: number, b: number, out: Float32Array | number[], o = 0): void {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  out[o] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[o + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}

/** OKLab → RGB linéaire (non borné : peut sortir du gamut sRGB). */
export function oklabToLinear(L: number, a: number, b: number, out: Float32Array | number[], o = 0): void {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  out[o] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[o + 1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[o + 2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}

export function srgb8ToOklab(r: number, g: number, b: number): Lab {
  const out: Lab = [0, 0, 0];
  linearToOklab(SRGB_TO_LINEAR[r] ?? 0, SRGB_TO_LINEAR[g] ?? 0, SRGB_TO_LINEAR[b] ?? 0, out);
  return out;
}

const tmp = [0, 0, 0];

function inGamut(L: number, a: number, b: number): boolean {
  oklabToLinear(L, a, b, tmp);
  const e = 1e-4;
  return (
    (tmp[0] ?? 0) >= -e &&
    (tmp[0] ?? 0) <= 1 + e &&
    (tmp[1] ?? 0) >= -e &&
    (tmp[1] ?? 0) <= 1 + e &&
    (tmp[2] ?? 0) >= -e &&
    (tmp[2] ?? 0) <= 1 + e
  );
}

/**
 * Ramène une couleur OKLab dans le gamut sRGB en réduisant sa chroma (teinte et luminosité conservées),
 * plutôt que d'écrêter chaque canal (qui décalerait la teinte).
 */
export function gamutMap(lab: Float32Array | number[], o = 0): void {
  const L = Math.max(0, Math.min(1, lab[o] ?? 0));
  const a = lab[o + 1] ?? 0;
  const b = lab[o + 2] ?? 0;
  lab[o] = L;
  if (inGamut(L, a, b)) return;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(L, a * mid, b * mid)) lo = mid;
    else hi = mid;
  }
  lab[o + 1] = a * lo;
  lab[o + 2] = b * lo;
}

/** OKLab → sRGB 8 bits (avec projection dans le gamut). */
export function oklabToSrgb8(L: number, a: number, b: number): [number, number, number] {
  const lab = [L, a, b];
  gamutMap(lab);
  oklabToLinear(lab[0] ?? 0, lab[1] ?? 0, lab[2] ?? 0, tmp);
  return [linearToSrgb8(tmp[0] ?? 0), linearToSrgb8(tmp[1] ?? 0), linearToSrgb8(tmp[2] ?? 0)];
}

/** Distance OKLab au carré. */
export function dist2(la: number, aa: number, ba: number, lb: number, ab: number, bb: number): number {
  const dl = la - lb;
  const da = aa - ab;
  const db = ba - bb;
  return dl * dl + da * da + db * db;
}

/** Chroma et teinte (OKLCh). */
export function chroma(a: number, b: number): number {
  return Math.hypot(a, b);
}

export function hue(a: number, b: number): number {
  const h = Math.atan2(b, a);
  return h < 0 ? h + Math.PI * 2 : h;
}
