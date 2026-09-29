import type { Grid, Rgb } from '../grid';
import { HARMONIES, harmonyColors } from '../palettes';
import { hash2, mulberry32 } from '../random';
import { rasterize } from '../scene';

function setup(seed: number, salt: number) {
  const rnd = mulberry32(seed * 104729 + salt);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)] as T;
  const harmony = pick(HARMONIES);
  const all = harmonyColors(harmony, (rnd() - 0.5) * 20);
  const inks = all.slice(2).sort(() => rnd() - 0.5);
  const colors: Rgb[] = [all[0] ?? [250, 245, 240], all[1] ?? [235, 225, 220], ...inks];
  const ink = (k: number) => 2 + (((k % inks.length) + inks.length) % inks.length);
  return { rnd, pick, colors, ink };
}

const frac = (v: number) => v - Math.floor(v);

/** Patchwork : blocs (triangles, moulinets, carré dans le carré, oies sauvages) en symétrie miroir. */
export function quilt(width: number, height: number, seed: number): Grid {
  const { rnd, colors, ink } = setup(seed, 1);
  const blocks = [4, 5, 6][Math.floor(rnd() * 3)] ?? 4;
  const kinds = Array.from({ length: 4 }, () => Math.floor(rnd() * 5));
  const tone = Array.from({ length: 4 }, (_, i) => [ink(i * 2), ink(i * 2 + 1), ink(i * 2 + 3)] as const);
  const scene = (x: number, y: number) => {
    const margin = 0.035;
    if (x < margin || y < margin || x > 1 - margin || y > 1 - margin) return ink(7);
    const u = ((x - margin) / (1 - 2 * margin)) * blocks;
    const v = ((y - margin) / (1 - 2 * margin)) * blocks;
    let bx = Math.floor(u);
    let by = Math.floor(v);
    let fx = u - bx;
    let fy = v - by;
    // symétrie miroir autour du centre du quilt
    if (bx >= blocks / 2) {
      bx = blocks - 1 - bx;
      fx = 1 - fx;
    }
    if (by >= blocks / 2) {
      by = blocks - 1 - by;
      fy = 1 - fy;
    }
    const sashing = 0.06;
    if (fx < sashing || fy < sashing) return 1;
    fx = (fx - sashing) / (1 - sashing);
    fy = (fy - sashing) / (1 - sashing);
    const k = (bx + by * 7) % 4;
    const [a, b, c] = tone[k] ?? [2, 3, 4];
    switch (kinds[k]) {
      case 0: // demi-carrés triangles
        return fx > fy ? a : b;
      case 1: {
        // moulinet
        const q = (fx < 0.5 ? 0 : 1) + (fy < 0.5 ? 0 : 2);
        const gx = frac(fx * 2);
        const gy = frac(fy * 2);
        const tri = q === 0 ? gx > gy : q === 1 ? gy < 1 - gx : q === 2 ? gy > 1 - gx : gx < gy;
        return tri ? a : c;
      }
      case 2: {
        // carré dans le carré
        const d = Math.abs(fx - 0.5) + Math.abs(fy - 0.5);
        return d < 0.25 ? c : d < 0.5 ? a : b;
      }
      case 3: {
        // oies sauvages
        const gy = frac(fy * 2);
        return Math.abs(fx - 0.5) < gy * 0.5 ? a : b;
      }
      default: {
        // neuf carrés
        const cx = Math.floor(fx * 3);
        const cy = Math.floor(fy * 3);
        return (cx + cy) % 2 === 0 ? a : cx === 1 && cy === 1 ? c : 0;
      }
    }
  };
  return rasterize(scene, width, height, colors);
}

/** Seigaiha : vagues japonaises en écailles d'arcs concentriques. */
export function seigaiha(width: number, height: number, seed: number): Grid {
  const { rnd, colors, ink } = setup(seed, 2);
  const n = 4 + Math.floor(rnd() * 2);
  const bands = [ink(0), 0, ink(1), 1];
  const scene = (x: number, y: number) => {
    const u = x * n;
    const v = y * n * 2;
    // pour chaque case, le cercle « au-dessus » le plus bas l'emporte
    let best = -1;
    let bestD = 0;
    for (let row = Math.floor(v) - 2; row <= Math.floor(v) + 1; row++) {
      const offset = row % 2 === 0 ? 0 : 0.5;
      for (let col = Math.floor(u - offset) - 1; col <= Math.floor(u - offset) + 1; col++) {
        const cx = col + offset + 0.5;
        const cy = row / 2 + 0.5;
        const d = Math.hypot(u - cx, (v / 2 - cy) * 1);
        if (d < 0.5 && row > best) {
          best = row;
          bestD = d;
        }
      }
    }
    if (best < 0) return 0;
    return bands[Math.floor(bestD * 2 * bands.length) % bands.length] ?? 0;
  };
  return rasterize(scene, width, height, colors);
}

/** Tuiles de Truchet à quarts de cercle : un labyrinthe organique en deux tons. */
export function truchet(width: number, height: number, seed: number): Grid {
  const { rnd, colors, ink } = setup(seed, 3);
  const n = 6 + Math.floor(rnd() * 5);
  const a = ink(0);
  const b = ink(3);
  const line = ink(5);
  const scene = (x: number, y: number) => {
    const u = x * n;
    const v = y * n;
    const cx = Math.floor(u);
    const cy = Math.floor(v);
    let fx = u - cx;
    const fy = v - cy;
    const flip = hash2(cx, cy, seed) < 0.5;
    if (flip) fx = 1 - fx;
    const d1 = Math.hypot(fx, fy);
    const d2 = Math.hypot(1 - fx, 1 - fy);
    const r = Math.min(Math.abs(d1 - 0.5), Math.abs(d2 - 0.5));
    if (r < 0.1) return line;
    const inside = d1 < 0.5 || d2 < 0.5;
    const parity = ((cx + cy) % 2 === 0) !== flip;
    return inside === parity ? a : b;
  };
  return rasterize(scene, width, height, colors);
}

/** Étoiles à huit branches (zellige simplifié) : octogones et étoiles entrelacés. */
export function stars(width: number, height: number, seed: number): Grid {
  const { rnd, colors, ink } = setup(seed, 4);
  const n = 4 + Math.floor(rnd() * 3);
  const star = ink(0);
  const heart = ink(1);
  const cross = ink(2);
  const edge = ink(4);
  const scene = (x: number, y: number) => {
    const u = frac(x * n) - 0.5;
    const v = frac(y * n) - 0.5;
    const s1 = Math.max(Math.abs(u), Math.abs(v));
    const s2 = (Math.abs(u) + Math.abs(v)) / Math.SQRT2;
    const s = Math.max(s1, s2); // octogone
    const st = Math.min(s1, s2); // étoile à 8 branches
    if (st < 0.3) {
      if (st > 0.26) return edge;
      return s < 0.14 ? heart : star;
    }
    const cu = frac(x * n + 0.5) - 0.5;
    const cv = frac(y * n + 0.5) - 0.5;
    const c = Math.abs(cu) + Math.abs(cv);
    if (c < 0.2) return cross;
    return (Math.floor(x * n) + Math.floor(y * n)) % 2 === 0 ? 0 : 1;
  };
  return rasterize(scene, width, height, colors);
}

/** Nid d'abeille : anneaux hexagonaux concentriques, alvéoles cernées d'un joint clair. */
export function hexagons(width: number, height: number, seed: number): Grid {
  const { rnd, colors, ink } = setup(seed, 5);
  const n = 7 + Math.floor(rnd() * 4);
  const period = 3 + Math.floor(rnd() * 2);
  const sq3 = Math.sqrt(3);
  const scene = (x: number, y: number) => {
    const px = (x - 0.5) * n;
    const py = (y - 0.5) * n;
    // coordonnées axiales (hexagones pointe en haut, rayon 0,5)
    const q = (sq3 / 3) * px - py / 3;
    const r = (2 / 3) * py;
    let rx = Math.round(q / 0.5);
    let ry = Math.round(r / 0.5);
    const rz = Math.round((-q - r) / 0.5);
    const dx = Math.abs(rx - q / 0.5);
    const dy = Math.abs(ry - r / 0.5);
    const dz = Math.abs(rz + (q + r) / 0.5);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    const cx = 0.5 * (sq3 * rx + (sq3 / 2) * ry);
    const cy = 0.75 * ry;
    // distance hexagonale au centre de l'alvéole (0 au centre, 0,5 au bord)
    const ux = Math.abs(px - cx);
    const uy = Math.abs(py - cy);
    const hd = Math.max(ux * (sq3 / 2) + uy * 0.5, uy);
    if (hd > 0.39) return 1;
    const ring = Math.max(Math.abs(rx), Math.abs(ry), Math.abs(rx + ry));
    const k = ring % period;
    if (hd < 0.2 && ring % 2 === 0) return ink(k + 3);
    return ink(k);
  };
  return rasterize(scene, width, height, colors);
}

/** Losanges d'Argyle avec surpiqûres en diagonale. */
export function argyle(width: number, height: number, seed: number): Grid {
  const { rnd, colors, ink } = setup(seed, 6);
  const n = 3 + Math.floor(rnd() * 3);
  const a = ink(0);
  const b = ink(1);
  const c = ink(2);
  const stitch = ink(5);
  const scene = (x: number, y: number) => {
    const u = x * n;
    const v = y * n * 0.75;
    const cx = Math.floor(u);
    const cy = Math.floor(v);
    const fx = u - cx - 0.5;
    const fy = v - cy - 0.5;
    // surpiqûre : un point au sommet de chaque losange
    if (Math.hypot(fx, Math.abs(fy) - 0.5) < 0.09) return stitch;
    if (Math.abs(fx) + Math.abs(fy) < 0.5) return (cx + cy) % 2 === 0 ? a : b;
    return c;
  };
  return rasterize(scene, width, height, colors);
}

/** Tournesol en phyllotaxie : graines en spirales de Fibonacci, pétales autour. */
export function phyllotaxis(width: number, height: number, seed: number): Grid {
  const { rnd, colors, ink } = setup(seed, 7);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const seeds = 380 + Math.floor(rnd() * 120);
  const R = 0.26;
  const petals = 21 + Math.floor(rnd() * 3) * 5;
  const pts: [number, number][] = [];
  for (let i = 0; i < seeds; i++) {
    const r = R * Math.sqrt(i / seeds);
    pts.push([0.5 + r * Math.cos(i * golden), 0.5 + r * Math.sin(i * golden)]);
  }
  const dotR = (R / Math.sqrt(seeds)) * 0.85;
  const p1 = ink(0);
  const p2 = ink(1);
  const s1 = ink(3);
  const s2 = ink(4);
  const scene = (x: number, y: number) => {
    const dx = x - 0.5;
    const dy = y - 0.5;
    const d = Math.hypot(dx, dy);
    if (d < R + dotR) {
      for (const [i, [px, py]] of pts.entries()) {
        if (Math.abs(px - x) < dotR && Math.abs(py - y) < dotR && Math.hypot(px - x, py - y) < dotR)
          return i % 2 === 0 ? s1 : s2;
      }
      return ink(6);
    }
    const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
    const f = frac(a * petals);
    const w = Math.abs(f - 0.5) * 2;
    const t = (d - R) / 0.2;
    if (t < 1 && w < 1 - t ** 1.3) return t < 0.5 && w < 0.35 ? p2 : p1;
    const f2 = frac(a * petals + 0.5);
    const w2 = Math.abs(f2 - 0.5) * 2;
    const t2 = (d - R) / 0.14;
    if (t2 < 1 && w2 < 1 - t2 ** 1.3) return p2;
    return d > 0.47 ? 1 : 0;
  };
  return rasterize(scene, width, height, colors);
}

/** Ensemble de Julia en bandes de couleur, paramètre choisi parmi des formes réputées belles. */
export function julia(width: number, height: number, seed: number): Grid {
  const { rnd, colors } = setup(seed, 8);
  const params: readonly [number, number, number][] = [
    [-0.4, 0.6, 1.4],
    [0.285, 0.01, 1.3],
    [-0.70176, -0.3842, 1.5],
    [-0.835, -0.2321, 1.5],
    [0.355, 0.355, 1.4],
    [-0.54, 0.54, 1.4],
    [-0.1, 0.651, 1.4],
  ];
  const [cr, ci, zoom] = params[Math.floor(rnd() * params.length)] ?? [-0.8, 0.156, 1.5];
  const bands = colors.length - 2;
  const scene = (x: number, y: number) => {
    let zr = (x - 0.5) * 2 * zoom;
    let zi = (y - 0.5) * 2 * zoom;
    let i = 0;
    const max = 90;
    while (i < max && zr * zr + zi * zi < 4) {
      const t = zr * zr - zi * zi + cr;
      zi = 2 * zr * zi + ci;
      zr = t;
      i++;
    }
    if (i === max) return 2;
    if (i < 3) return 0;
    return 2 + (Math.floor(Math.sqrt(i) * 1.6) % bands);
  };
  return rasterize(scene, width, height, colors);
}
