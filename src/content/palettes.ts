import { oklabToSrgb8 } from '@/convert/color';
import type { Rgb } from './grid';

/** Couleur OKLCh (L 0–1, C ~0–0,37, h en degrés) → sRGB, ramenée dans le gamut. */
export function oklch(L: number, C: number, h: number): Rgb {
  const r = (h * Math.PI) / 180;
  return oklabToSrgb8(L, C * Math.cos(r), C * Math.sin(r));
}

/** Rampe de `n` teintes régulières entre deux couleurs OKLCh (interpolation en OKLCh, teinte au plus court). */
export function ramp(
  n: number,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
): Rgb[] {
  let dh = to[2] - from[2];
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    return oklch(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + dh * t);
  });
}

/** Palettes harmonieuses tirées d'une teinte de base : pour les mandalas, motifs et œuvres du jour. */
export type Scheme = 'analogous' | 'complementary' | 'triadic' | 'pastel' | 'sunset' | 'ocean';

export function schemeColors(scheme: Scheme, baseHue: number, count: number): Rgb[] {
  const out: Rgb[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    // luminosité en zigzag : deux couleurs voisines dans la liste restent contrastées
    const L = 0.45 + 0.45 * ((i * 0.618) % 1);
    let h = baseHue;
    let C = 0.13;
    switch (scheme) {
      case 'analogous':
        h = baseHue + (t - 0.5) * 90;
        break;
      case 'complementary':
        h = baseHue + (i % 2) * 180 + (t - 0.5) * 30;
        break;
      case 'triadic':
        h = baseHue + (i % 3) * 120 + (t - 0.5) * 20;
        break;
      case 'pastel':
        h = baseHue + t * 300;
        C = 0.08;
        break;
      case 'sunset':
        h = baseHue + t * 100;
        C = 0.15;
        break;
      case 'ocean':
        h = baseHue + (t - 0.5) * 60;
        C = 0.1;
        break;
    }
    out.push(oklch(Math.min(0.95, L), C, ((h % 360) + 360) % 360));
  }
  return out;
}

/**
 * Harmonies choisies à la main (OKLCh) : fond clair, fond secondaire, puis encres de luminosités variées.
 * Les générateurs y piochent plutôt que de tirer des teintes au hasard (évite les tons boueux).
 */
export interface Harmony {
  readonly name: string;
  readonly background: readonly [number, number, number];
  readonly background2: readonly [number, number, number];
  readonly inks: readonly (readonly [number, number, number])[];
}

export const HARMONIES: readonly Harmony[] = [
  {
    name: 'rose',
    background: [0.96, 0.02, 60],
    background2: [0.9, 0.04, 20],
    inks: [
      [0.72, 0.12, 0],
      [0.5, 0.12, 350],
      [0.82, 0.1, 80],
      [0.6, 0.08, 190],
      [0.38, 0.09, 330],
      [0.86, 0.06, 20],
      [0.66, 0.1, 40],
      [0.45, 0.07, 220],
    ],
  },
  {
    name: 'océan',
    background: [0.96, 0.02, 210],
    background2: [0.9, 0.04, 200],
    inks: [
      [0.45, 0.1, 240],
      [0.65, 0.11, 200],
      [0.8, 0.08, 185],
      [0.7, 0.13, 30],
      [0.33, 0.07, 250],
      [0.88, 0.05, 90],
      [0.55, 0.08, 170],
      [0.75, 0.09, 220],
    ],
  },
  {
    name: 'couchant',
    background: [0.95, 0.03, 70],
    background2: [0.89, 0.06, 50],
    inks: [
      [0.68, 0.15, 35],
      [0.8, 0.13, 70],
      [0.55, 0.14, 15],
      [0.42, 0.12, 320],
      [0.72, 0.1, 350],
      [0.35, 0.08, 290],
      [0.87, 0.09, 90],
      [0.6, 0.12, 50],
    ],
  },
  {
    name: 'forêt',
    background: [0.95, 0.02, 110],
    background2: [0.88, 0.04, 130],
    inks: [
      [0.45, 0.09, 150],
      [0.62, 0.1, 140],
      [0.78, 0.08, 120],
      [0.6, 0.12, 45],
      [0.32, 0.06, 160],
      [0.85, 0.08, 90],
      [0.52, 0.07, 190],
      [0.7, 0.09, 70],
    ],
  },
  {
    name: 'lavande',
    background: [0.96, 0.02, 300],
    background2: [0.9, 0.04, 290],
    inks: [
      [0.55, 0.12, 300],
      [0.72, 0.1, 290],
      [0.4, 0.1, 280],
      [0.8, 0.08, 170],
      [0.65, 0.12, 330],
      [0.85, 0.06, 270],
      [0.48, 0.08, 250],
      [0.9, 0.07, 100],
    ],
  },
  {
    name: 'terre cuite',
    background: [0.95, 0.02, 75],
    background2: [0.88, 0.04, 65],
    inks: [
      [0.58, 0.12, 40],
      [0.74, 0.11, 70],
      [0.45, 0.09, 30],
      [0.55, 0.07, 200],
      [0.84, 0.07, 85],
      [0.35, 0.06, 40],
      [0.68, 0.09, 180],
      [0.63, 0.13, 55],
    ],
  },
  {
    name: 'bonbon',
    background: [0.97, 0.02, 330],
    background2: [0.92, 0.05, 200],
    inks: [
      [0.78, 0.11, 350],
      [0.85, 0.1, 160],
      [0.9, 0.1, 100],
      [0.78, 0.09, 240],
      [0.72, 0.1, 300],
      [0.62, 0.12, 10],
      [0.66, 0.1, 190],
      [0.55, 0.1, 280],
    ],
  },
  {
    name: 'royal',
    background: [0.95, 0.02, 85],
    background2: [0.87, 0.05, 80],
    inks: [
      [0.35, 0.12, 270],
      [0.78, 0.13, 85],
      [0.5, 0.16, 20],
      [0.55, 0.11, 260],
      [0.68, 0.1, 75],
      [0.28, 0.07, 280],
      [0.65, 0.12, 25],
      [0.85, 0.07, 90],
    ],
  },
  {
    name: 'automne',
    background: [0.95, 0.03, 80],
    background2: [0.88, 0.05, 70],
    inks: [
      [0.5, 0.12, 25],
      [0.68, 0.14, 50],
      [0.8, 0.13, 85],
      [0.42, 0.1, 10],
      [0.6, 0.08, 120],
      [0.33, 0.06, 30],
      [0.74, 0.1, 65],
      [0.55, 0.09, 150],
    ],
  },
  {
    name: 'givre',
    background: [0.97, 0.01, 230],
    background2: [0.91, 0.03, 240],
    inks: [
      [0.5, 0.09, 250],
      [0.7, 0.08, 230],
      [0.83, 0.06, 210],
      [0.62, 0.07, 290],
      [0.38, 0.07, 260],
      [0.9, 0.04, 190],
      [0.58, 0.05, 220],
      [0.76, 0.07, 320],
    ],
  },
];

export function harmonyColors(h: Harmony, hueShift = 0): Rgb[] {
  const c = ([L, C, H]: readonly [number, number, number]) => oklch(L, C, (H + hueShift + 360) % 360);
  return [c(h.background), c(h.background2), ...h.inks.map(c)];
}
