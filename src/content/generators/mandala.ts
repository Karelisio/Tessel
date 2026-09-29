import type { Grid, Rgb } from '../grid';
import { HARMONIES, harmonyColors } from '../palettes';
import { mulberry32 } from '../random';
import { rasterize } from '../scene';

type Motif = 'petals' | 'round-petals' | 'scallops' | 'dots' | 'zigzag' | 'band' | 'checker' | 'rays';

interface Ring {
  inner: number;
  outer: number;
  motif: Motif;
  folds: number;
  fg: number;
  bg: number;
  accent: number;
}

const MOTIFS: readonly Motif[] = [
  'petals',
  'round-petals',
  'scallops',
  'dots',
  'zigzag',
  'band',
  'checker',
  'rays',
];

/**
 * Mandala : anneaux concentriques de motifs à symétrie radiale (pétales, festons, perles, rayons…),
 * palette harmonieuse tirée de la graine. Toujours carré.
 */
export function mandala(width: number, height: number, seed: number): Grid {
  const rnd = mulberry32(seed * 7919 + 13);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)] as T;

  // palette : une harmonie choisie, légèrement décalée en teinte, encres dans un ordre tiré
  const harmony = pick(HARMONIES);
  const all = harmonyColors(harmony, (rnd() - 0.5) * 24);
  const inkList = all.slice(2).sort(() => rnd() - 0.5);
  const colors: Rgb[] = [all[0] ?? [250, 245, 240], all[1] ?? [235, 225, 220], ...inkList];
  const inks = colors.length - 2;
  const ink = (k: number) => 2 + (((k % inks) + inks) % inks);

  const base = pick([6, 8, 8, 10, 12, 12, 16]);
  const rings: Ring[] = [];
  let r = 0.06 + rnd() * 0.03;
  let k = 0;
  while (r < 0.47) {
    const w = Math.min(0.47 - r, 0.045 + rnd() * 0.055);
    if (w < 0.03) break;
    const motif = rings.length === 0 ? 'petals' : pick(MOTIFS);
    const folds =
      base *
      (motif === 'dots' || motif === 'checker' || motif === 'rays' ? pick([1, 2, 2]) : pick([1, 1, 2]));
    rings.push({ inner: r, outer: r + w, motif, folds, fg: ink(k), bg: ink(k + 3), accent: ink(k + 5) });
    k += 1 + Math.floor(rnd() * 2);
    r += w;
  }
  const outerR = r;
  const center = ink(k + 2);
  const corner = pick(['quarter', 'dots', 'plain'] as const);

  const scene = (x: number, y: number): number => {
    const dx = x - 0.5;
    const dy = y - 0.5;
    const rad = Math.hypot(dx, dy);
    if (rad < (rings[0]?.inner ?? 0.06)) {
      return rad < (rings[0]?.inner ?? 0.06) * 0.5 ? ink(k + 4) : center;
    }
    if (rad >= outerR) {
      if (rad < outerR + 0.012) return ink(1); // liseré
      if (corner === 'quarter') {
        const c = Math.min(
          Math.hypot(x, y),
          Math.hypot(1 - x, y),
          Math.hypot(x, 1 - y),
          Math.hypot(1 - x, 1 - y),
        );
        if (c < 0.16) return c < 0.1 ? ink(3) : ink(6);
      } else if (corner === 'dots') {
        const gx = (x * 12) % 1;
        const gy = (y * 12) % 1;
        if (Math.hypot(gx - 0.5, gy - 0.5) < 0.18) return 1;
      }
      return 0;
    }
    const ring = rings.find((q) => rad < q.outer) ?? rings[rings.length - 1];
    if (!ring) return 0;
    const t = (rad - ring.inner) / (ring.outer - ring.inner);
    const theta = Math.atan2(dy, dx) + Math.PI;
    const s = (theta / (Math.PI * 2)) * ring.folds;
    const sector = Math.floor(s);
    const a = Math.abs((s % 1) - 0.5) * 2; // 0 au centre du secteur, 1 au bord
    switch (ring.motif) {
      case 'petals': {
        const wv = 1 - t ** 1.4;
        if (a < wv) return a < wv * 0.35 && t < 0.75 ? ring.accent : ring.fg;
        return ring.bg;
      }
      case 'round-petals': {
        const wv = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
        if (a < wv * 0.95) return t > 0.25 && t < 0.6 && a < 0.3 ? ring.accent : ring.fg;
        return ring.bg;
      }
      case 'scallops': {
        const d = Math.hypot(a * 0.9, t - 0.15);
        if (d < 0.72) return d < 0.38 ? ring.accent : ring.fg;
        return ring.bg;
      }
      case 'dots': {
        const d = Math.hypot(1 - a, (t - 0.5) * 1.6);
        return d < 0.55 ? (d < 0.25 ? ring.accent : ring.fg) : ring.bg;
      }
      case 'zigzag':
        return t < 0.2 + 0.6 * a ? ring.fg : t > 0.85 ? ring.accent : ring.bg;
      case 'band':
        return t < 0.3 ? ring.accent : t < 0.7 ? ring.fg : ring.accent;
      case 'checker':
        return (sector + (t < 0.5 ? 0 : 1)) % 2 === 0 ? ring.fg : ring.bg;
      case 'rays':
        return a > 0.7 ? ring.fg : t < 0.18 || t > 0.82 ? ring.accent : ring.bg;
    }
  };
  return rasterize(scene, width, height, colors);
}
