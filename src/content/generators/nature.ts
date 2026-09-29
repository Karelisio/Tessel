import { oklabToSrgb8, srgb8ToOklab } from '@/convert/color';
import type { Grid, Rgb } from '../grid';
import { oklch } from '../palettes';
import { fbm, hash2, mulberry32 } from '../random';
import { rasterize, segDist } from '../scene';

/** Mélange OKLab de deux couleurs. */
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const la = srgb8ToOklab(a[0], a[1], a[2]);
  const lb = srgb8ToOklab(b[0], b[1], b[2]);
  return oklabToSrgb8(la[0] + (lb[0] - la[0]) * t, la[1] + (lb[1] - la[1]) * t, la[2] + (lb[2] - la[2]) * t);
}

class Pal {
  readonly colors: Rgb[] = [];
  add(c: Rgb): number {
    this.colors.push(c);
    return this.colors.length - 1;
  }
  /** Dégradé de `n` couleurs discrètes. */
  ramp(a: Rgb, b: Rgb, n: number): number[] {
    return Array.from({ length: n }, (_, i) => this.add(mix(a, b, n === 1 ? 0 : i / (n - 1))));
  }
}

type Mood = 'dawn' | 'day' | 'dusk' | 'night';

interface Sky {
  top: Rgb;
  horizon: Rgb;
  sun: Rgb;
  glow: Rgb;
  cloud: Rgb;
  shadow: Rgb;
}

const SKIES: Record<Mood, Sky> = {
  dawn: {
    top: oklch(0.72, 0.07, 280),
    horizon: oklch(0.9, 0.08, 60),
    sun: oklch(0.96, 0.07, 90),
    glow: oklch(0.85, 0.1, 40),
    cloud: oklch(0.88, 0.06, 20),
    shadow: oklch(0.42, 0.07, 290),
  },
  day: {
    top: oklch(0.72, 0.1, 235),
    horizon: oklch(0.93, 0.04, 210),
    sun: oklch(0.97, 0.08, 95),
    glow: oklch(0.93, 0.06, 95),
    cloud: oklch(0.98, 0.01, 230),
    shadow: oklch(0.45, 0.07, 200),
  },
  dusk: {
    top: oklch(0.45, 0.1, 300),
    horizon: oklch(0.8, 0.13, 55),
    sun: oklch(0.93, 0.1, 85),
    glow: oklch(0.72, 0.15, 30),
    cloud: oklch(0.72, 0.1, 10),
    shadow: oklch(0.3, 0.07, 300),
  },
  night: {
    top: oklch(0.22, 0.06, 275),
    horizon: oklch(0.45, 0.08, 255),
    sun: oklch(0.95, 0.04, 95),
    glow: oklch(0.6, 0.06, 250),
    cloud: oklch(0.5, 0.05, 260),
    shadow: oklch(0.17, 0.04, 270),
  },
};

const MOODS: readonly Mood[] = ['dawn', 'day', 'dusk', 'night'];

/** Ciel en bandes, disque solaire (ou lunaire) avec halo, nuages. */
function skyLayer(pal: Pal, sky: Sky, seed: number, bands = 5, clouds = true) {
  const steps = pal.ramp(sky.top, sky.horizon, bands);
  const sun = pal.add(sky.sun);
  const glow = pal.add(sky.glow);
  const cloud = pal.add(sky.cloud);
  return (x: number, y: number, horizon: number, sx: number, sy: number, sr: number): number => {
    const d = Math.hypot(x - sx, y - sy);
    if (d < sr) return sun;
    if (d < sr * 1.45) return glow;
    if (clouds) {
      const c = fbm(x * 5, y * 14, seed + 5, 4);
      if (c > 0.66 && y < horizon - 0.05) return cloud;
    }
    const t = Math.max(0, Math.min(0.999, y / horizon));
    return steps[Math.floor(t * bands)] ?? steps[bands - 1] ?? 0;
  };
}

/** Montagnes en couches, perspective atmosphérique, lac ou prairie au premier plan (format 4:3). */
export function mountains(width: number, height: number, seed: number): Grid {
  const rnd = mulberry32(seed * 3301);
  const mood = MOODS[seed % 4] ?? 'day';
  const sky = SKIES[mood];
  const pal = new Pal();
  const skyAt = skyLayer(pal, sky, seed);
  const layers = 4;
  const far = mix(sky.horizon, sky.shadow, 0.3);
  const near = mood === 'night' ? oklch(0.2, 0.04, 260) : mix(sky.shadow, oklch(0.36, 0.08, 150), 0.5);
  const ridge = pal.ramp(far, near, layers);
  const snow = pal.add(mood === 'night' ? oklch(0.78, 0.03, 240) : oklch(0.97, 0.01, 240));
  const lake = rnd() < 0.5;
  const water = pal.ramp(mix(sky.horizon, sky.top, 0.3), mix(sky.top, near, 0.5), 3);
  const glint = pal.add(mix(sky.sun, sky.horizon, 0.3));
  const grass = pal.ramp(oklch(0.62, 0.1, 135), oklch(0.47, 0.09, 150), 2);
  const horizon = 0.52;
  const sx = 0.25 + rnd() * 0.5;
  // chaque couche : quelques sommets triangulaires adoucis par du bruit
  const peaks = Array.from({ length: layers }, (_, k) =>
    Array.from({ length: 3 + k }, () => ({
      c: rnd() * 1.2 - 0.1,
      h: 0.1 + rnd() * (0.12 + (layers - 1 - k) * 0.03) + k * 0.03,
      s: 0.9 + rnd() * 0.8,
    })),
  );
  const heightAt = (k: number, x: number) => {
    let best = 0.02;
    for (const p of peaks[k] ?? []) best = Math.max(best, p.h - Math.abs(x - p.c) * p.s * 0.5);
    return best + 0.025 * fbm(x * 12 + k * 5, k, seed, 3);
  };
  const scene = (x: number, y: number): number => {
    for (let k = 0; k < layers; k++) {
      const base = horizon - k * 0.03;
      const h = heightAt(k, x);
      const top = base - h;
      if (y >= top && y < horizon) {
        // neige sur les sommets les plus hauts seulement
        if (k >= 1 && h > 0.2 && y < top + 0.04 * (h - 0.17) * 10) return snow;
        return ridge[layers - 1 - k] ?? 0;
      }
    }
    if (y >= horizon) {
      if (lake) {
        const wave = fbm(x * 30, y * 90, seed + 9, 2);
        if (Math.abs(x - sx) < 0.05 && wave > 0.5) return glint;
        return water[Math.min(2, Math.floor(((y - horizon) / (0.75 - horizon)) * 3))] ?? 0;
      }
      return grass[fbm(x * 8, y * 12, seed + 4, 3) > 0.5 ? 0 : 1] ?? 0;
    }
    return skyAt(x, y, horizon, sx, 0.14, 0.06);
  };
  return rasterize(scene, width, height, pal.colors);
}

/** Dunes du désert : faces éclairées et ombrées, grand soleil, cactus. */
export function dunes(width: number, height: number, seed: number): Grid {
  const rnd = mulberry32(seed * 7717);
  const mood = (['day', 'dusk', 'dawn'] as const)[seed % 3] ?? 'day';
  const sky = SKIES[mood];
  const pal = new Pal();
  const skyAt = skyLayer(pal, sky, seed, 5, false);
  const lit = pal.ramp(oklch(0.85, 0.09, 75), oklch(0.72, 0.12, 55), 3);
  const shade = pal.ramp(oklch(0.68, 0.1, 45), oklch(0.52, 0.11, 35), 3);
  const cactus = pal.add(oklch(0.5, 0.1, 150));
  const horizon = 0.55;
  const sx = 0.3 + rnd() * 0.4;
  const cacti = Array.from(
    { length: 2 + Math.floor(rnd() * 2) },
    () => [0.1 + rnd() * 0.8, 0.12 + rnd() * 0.08] as const,
  );
  const scene = (x: number, y: number): number => {
    for (const [cx, h] of cacti) {
      const ground = 0.9;
      if (y < ground && y > ground - h) {
        if (Math.abs(x - cx) < 0.018) return cactus;
        const armY = ground - h * 0.55;
        if (y < armY && y > armY - h * 0.3 && Math.abs(x - cx - 0.04) < 0.013) return cactus;
        if (Math.abs(y - armY) < 0.013 && x > cx && x < cx + 0.05) return cactus;
      }
    }
    for (let k = 2; k >= 0; k--) {
      const base = horizon + k * 0.14;
      const f = (xx: number) =>
        base - 0.09 * Math.sin(xx * (5 + k * 2) + seed + k * 2) - 0.05 * fbm(xx * 3, k, seed, 3);
      const top = f(x);
      if (y >= top) {
        const slope = f(x + 0.01) - top;
        return (slope > 0 ? shade : lit)[2 - k] ?? 0;
      }
    }
    return skyAt(x, y, horizon, sx, horizon - 0.18, 0.1);
  };
  return rasterize(scene, width, height, pal.colors);
}

/** Champs de fleurs en rangées qui filent vers l'horizon, arbre isolé. */
export function fields(width: number, height: number, seed: number): Grid {
  const rnd = mulberry32(seed * 5519);
  const sky = SKIES[(['day', 'dawn', 'dusk'] as const)[seed % 3] ?? 'day'];
  const pal = new Pal();
  const skyAt = skyLayer(pal, sky, seed, 4);
  const hues = [350, 30, 60, 290, 10].sort(() => rnd() - 0.5);
  const rows = hues.slice(0, 4).map((h) => pal.add(oklch(0.66, 0.16, h)));
  const leaf = pal.ramp(oklch(0.62, 0.11, 140), oklch(0.42, 0.09, 150), 2);
  const hill = pal.add(oklch(0.7, 0.09, 130));
  const trunk = pal.add(oklch(0.4, 0.05, 50));
  const crown = pal.ramp(oklch(0.55, 0.12, 140), oklch(0.42, 0.1, 150), 2);
  const horizon = 0.46;
  const tx = 0.2 + rnd() * 0.6;
  const scene = (x: number, y: number): number => {
    // arbre sur la colline
    const ty = horizon - 0.02;
    const cd = Math.hypot((x - tx) * 1.1, y - (ty - 0.12));
    if (cd < 0.08) return crown[fbm(x * 30, y * 30, seed, 2) > 0.5 ? 0 : 1] ?? 0;
    if (Math.abs(x - tx) < 0.012 && y > ty - 0.08 && y < ty + 0.02) return trunk;
    const hillTop = horizon - 0.03 * Math.sin(x * 4 + seed);
    if (y >= hillTop && y < horizon + 0.04) return hill;
    if (y >= horizon + 0.04) {
      const depth = (y - horizon) / (1 - horizon);
      const u = (x - 0.5) / (0.15 + depth * 1.2);
      const stripe = Math.floor(u * 6 + 100);
      const f = u * 6 - Math.floor(u * 6);
      if (f < 0.28) return leaf[depth > 0.5 ? 1 : 0] ?? 0;
      return rows[stripe % rows.length] ?? 0;
    }
    return skyAt(x, y, horizon, 0.75, 0.16, 0.06);
  };
  return rasterize(scene, width, height, pal.colors);
}

/** Forêt de sapins en rangées brumeuses : les plus proches, plus grands et plus sombres. */
export function forest(width: number, height: number, seed: number): Grid {
  const mood = (['dawn', 'day', 'dusk', 'night'] as const)[seed % 4] ?? 'day';
  const sky = SKIES[mood];
  const pal = new Pal();
  const skyAt = skyLayer(pal, sky, seed, 4, mood !== 'night');
  const rows = 4;
  const near = mood === 'night' ? oklch(0.18, 0.04, 200) : oklch(0.33, 0.07, 160);
  const tones = pal.ramp(mix(sky.horizon, near, 0.3), near, rows);
  const ground = pal.add(mood === 'night' ? oklch(0.14, 0.03, 200) : oklch(0.28, 0.06, 150));
  const pine = (x: number, y: number, cx: number, base: number, h: number, w: number) => {
    if (y > base || y < base - h) return false;
    const t = (y - (base - h)) / h; // 0 en haut, 1 au pied
    if (t > 0.9) return Math.abs(x - cx) < w * 0.08; // tronc
    const tier = (t * 4) % 1; // étages en dents de scie
    const half = w * (0.12 + 0.88 * t) * (0.62 + 0.38 * tier) * 0.5;
    return Math.abs(x - cx) < half;
  };
  const scene = (x: number, y: number): number => {
    if (y > 0.7) return ground;
    // du premier plan vers le fond : la première rangée qui couvre le point l'emporte
    for (let k = 0; k < rows; k++) {
      const spacing = 0.2 - k * 0.035;
      const base = 0.74 - k * 0.07;
      const h = 0.46 - k * 0.08;
      const col = Math.floor(x / spacing);
      for (let c = col - 1; c <= col + 1; c++) {
        const cx = (c + 0.5 + (hash2(c, k, seed) - 0.5) * 0.5) * spacing;
        const hh = h * (0.8 + hash2(c, k + 5, seed) * 0.3);
        if (pine(x, y, cx, base, hh, spacing * 1.25)) return tones[rows - 1 - k] ?? 0;
      }
    }
    return skyAt(x, y, 0.6, 0.72, 0.18, 0.06);
  };
  return rasterize(scene, width, height, pal.colors);
}

/** Mer : vagues en bandes, voilier, falaise et phare. */
export function seascape(width: number, height: number, seed: number): Grid {
  const rnd = mulberry32(seed * 911);
  const mood = (['day', 'dusk', 'dawn'] as const)[seed % 3] ?? 'day';
  const sky = SKIES[mood];
  const pal = new Pal();
  const skyAt = skyLayer(pal, sky, seed, 5);
  const sea = pal.ramp(mix(sky.horizon, oklch(0.55, 0.1, 225), 0.6), oklch(0.4, 0.09, 240), 4);
  const foam = pal.add(oklch(0.95, 0.02, 220));
  const sparkle = pal.add(mix(sky.sun, sky.glow, 0.3));
  const sail = pal.add(oklch(0.97, 0.01, 90));
  const hull = pal.add(oklch(0.45, 0.12, 25));
  const rock = pal.ramp(oklch(0.5, 0.03, 60), oklch(0.36, 0.03, 50), 2);
  const tower = pal.add(oklch(0.96, 0.01, 90));
  const stripe = pal.add(oklch(0.55, 0.16, 25));
  const horizon = 0.5;
  const sx = 0.35 + rnd() * 0.3;
  const bx = 0.25 + rnd() * 0.2;
  const cliffLeft = rnd() < 0.5;
  const scene = (x0: number, y: number): number => {
    const x = cliffLeft ? 1 - x0 : x0;
    // falaise et phare
    const cliff = 0.62 + 0.12 * (x - 0.72) * 4 - 0.05 * fbm(y * 8, 1, seed, 3);
    if (x > 0.72 && y > cliff) return rock[fbm(x * 12, y * 12, seed, 2) > 0.5 ? 0 : 1] ?? 0;
    if (Math.abs(x - 0.86) < 0.028 && y > 0.36 && y < 0.72)
      return Math.floor((y - 0.36) * 20) % 2 === 0 ? stripe : tower;
    if (Math.abs(x - 0.86) < 0.04 && y > 0.33 && y <= 0.36) return stripe;
    // voilier
    const by = horizon + 0.12;
    if (y > by && y < by + 0.03 && Math.abs(x - bx) < 0.07 - (y - by)) return hull;
    if (y < by && y > by - 0.16 && x > bx - 0.005 && x < bx + (y - (by - 0.16)) * 0.45) return sail;
    if (y < by && y > by - 0.12 && x < bx - 0.01 && x > bx - (y - (by - 0.12)) * 0.35) return sail;
    if (y >= horizon) {
      const t = (y - horizon) / (1 - horizon);
      const wave = Math.sin(x * 40 + y * 6 + fbm(x * 4, y * 9, seed, 2) * 6);
      if (Math.abs(x0 - sx) < 0.04 + t * 0.05 && wave > 0.3) return sparkle;
      if (wave > 0.86 && t > 0.2) return foam;
      return sea[Math.min(3, Math.floor(t * 4))] ?? 0;
    }
    return skyAt(x0, y, horizon, sx, horizon - 0.14, 0.07);
  };
  return rasterize(scene, width, height, pal.colors);
}

// --- Espace et nuit ---------------------------------------------------------------------------------

/** Étoiles clairsemées : `density` = part des cellules d'un réseau 24×24 qui portent une étoile. */
function starAt(x: number, y: number, seed: number, density: number): boolean {
  const n = 24;
  const cx = Math.floor(x * n);
  const cy = Math.floor(y * n);
  if (hash2(cx, cy, seed) > density) return false;
  const px = (cx + 0.2 + hash2(cx, cy, seed + 1) * 0.6) / n;
  const py = (cy + 0.2 + hash2(cx, cy, seed + 2) * 0.6) / n;
  const r = 0.006 + hash2(cx, cy, seed + 3) ** 3 * 0.012;
  return Math.hypot(x - px, y - py) < r;
}

/** Planète à anneaux, lune et étoiles. */
export function planet(width: number, height: number, seed: number): Grid {
  const rnd = mulberry32(seed * 131);
  const pal = new Pal();
  const space = pal.ramp(oklch(0.2, 0.05, 280), oklch(0.28, 0.07, 300), 2);
  const star = pal.add(oklch(0.95, 0.03, 90));
  const hue = rnd() * 360;
  const bands = pal.ramp(oklch(0.78, 0.1, hue), oklch(0.55, 0.13, hue + 40), 4);
  const ring = pal.ramp(oklch(0.85, 0.07, hue + 180), oklch(0.68, 0.08, hue + 200), 2);
  const shadow = pal.add(oklch(0.38, 0.09, hue + 30));
  const moon = pal.ramp(oklch(0.88, 0.02, 250), oklch(0.7, 0.03, 250), 2);
  const px = 0.45 + rnd() * 0.1;
  const py = 0.5;
  const R = 0.24;
  const tilt = (rnd() - 0.5) * 0.6;
  const mx = rnd() < 0.5 ? 0.18 : 0.82;
  const scene = (x: number, y: number): number => {
    const dx = x - px;
    const dy = y - py;
    // anneau : ellipse inclinée
    const rx = dx * Math.cos(tilt) + dy * Math.sin(tilt);
    const ry = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
    const e = Math.hypot(rx, ry * 3.4);
    const inRing = e > R * 1.25 && e < R * 1.75;
    const d = Math.hypot(dx, dy);
    const front = ry > 0;
    if (inRing && (front || d > R)) return ring[e < R * 1.5 ? 0 : 1] ?? 0;
    if (d < R) {
      if (dx * 0.7 + dy * 0.7 > R * 0.55) return shadow;
      const lat = ry / R + 0.15 * fbm(rx * 10, ry * 3, seed, 3);
      return bands[Math.abs(Math.floor(lat * 5)) % 4] ?? 0;
    }
    const md = Math.hypot(x - mx, y - 0.18);
    if (md < 0.06) return moon[fbm(x * 40, y * 40, seed + 3, 2) > 0.55 ? 1 : 0] ?? 0;
    if (starAt(x, y, seed, 0.35)) return star;
    return space[fbm(x * 3, y * 3, seed + 1, 3) > 0.55 ? 1 : 0] ?? 0;
  };
  return rasterize(scene, width, height, pal.colors);
}

/** Nébuleuse : nuages de gaz en bandes de couleur, étoiles brillantes. */
export function nebula(width: number, height: number, seed: number): Grid {
  const rnd = mulberry32(seed * 977);
  const pal = new Pal();
  const hue = rnd() * 360;
  const levels = pal.ramp(oklch(0.18, 0.05, hue + 260), oklch(0.85, 0.12, hue), 7);
  const star = pal.add(oklch(0.98, 0.02, 90));
  const scene = (x: number, y: number): number => {
    if (starAt(x, y, seed, 0.3)) return star;
    const warp = fbm(x * 2 + 5, y * 2, seed + 3, 3);
    const v = fbm(x * 2.5 + warp * 1.5, y * 2.5 - warp, seed, 5);
    const t = Math.max(0, Math.min(0.999, (v - 0.3) / 0.45));
    return levels[Math.floor(t * t * levels.length)] ?? 0;
  };
  return rasterize(scene, width, height, pal.colors);
}

/** Galaxie spirale. */
export function galaxy(width: number, height: number, seed: number): Grid {
  const rnd = mulberry32(seed * 523);
  const pal = new Pal();
  const hue = 200 + rnd() * 120;
  const levels = pal.ramp(oklch(0.16, 0.04, hue + 40), oklch(0.93, 0.07, hue - 140), 6);
  const star = pal.add(oklch(0.98, 0.02, 90));
  const arms = 2 + Math.floor(rnd() * 2);
  const scene = (x: number, y: number): number => {
    const dx = x - 0.5;
    const dy = (y - 0.5) * 1.25;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const spiral = Math.cos(arms * (a - Math.log(r + 0.02) * 2.2)) * 0.5 + 0.5;
    const core = Math.exp(-r * 9);
    const dens = spiral * Math.exp(-r * 3.5) + core + 0.12 * fbm(x * 8, y * 8, seed, 3);
    if (starAt(x, y, seed, 0.3) && dens < 0.35) return star;
    const t = Math.max(0, Math.min(0.999, dens * 1.1));
    return levels[Math.floor(t * levels.length)] ?? 0;
  };
  return rasterize(scene, width, height, pal.colors);
}

/** Nuit étoilée : voie lactée, lune, collines et maisons aux fenêtres allumées. */
export function starryNight(width: number, height: number, seed: number): Grid {
  const rnd = mulberry32(seed * 419);
  const pal = new Pal();
  const sky = pal.ramp(oklch(0.2, 0.06, 270), oklch(0.38, 0.08, 255), 4);
  const milky = pal.ramp(oklch(0.45, 0.07, 280), oklch(0.62, 0.06, 250), 2);
  const star = pal.add(oklch(0.96, 0.04, 95));
  const moon = pal.add(oklch(0.94, 0.06, 95));
  const hills = pal.ramp(oklch(0.3, 0.05, 230), oklch(0.18, 0.04, 220), 2);
  const house = pal.add(oklch(0.25, 0.04, 30));
  const windowC = pal.add(oklch(0.86, 0.13, 85));
  const mx = 0.2 + rnd() * 0.6;
  const houses = Array.from({ length: 3 + Math.floor(rnd() * 2) }, (_, i) => 0.14 + i * 0.22 + rnd() * 0.05);
  const scene = (x: number, y: number): number => {
    const h1 = 0.56 - 0.04 * Math.sin(x * 5 + seed);
    const h2 = 0.66 - 0.03 * Math.sin(x * 7 + seed * 2);
    for (const hx of houses) {
      const base = 0.56 - 0.04 * Math.sin(hx * 5 + seed) + 0.02;
      const w = 0.07;
      const wall = 0.09;
      if (x > hx - w && x < hx + w && y < base && y > base - wall) {
        if (Math.abs(x - hx) < 0.026 && y > base - wall + 0.02 && y < base - 0.03) return windowC;
        return house;
      }
      if (y <= base - wall && y > base - wall - (w + 0.01 - Math.abs(x - hx)) * 0.8) return house;
    }
    if (y > h2) return hills[1] ?? 0;
    if (y > h1) return hills[0] ?? 0;
    if (Math.hypot(x - mx, y - 0.2) < 0.075) return moon;
    if (starAt(x, y, seed, 0.3)) return star;
    const band = Math.abs(y - (0.15 + x * 0.35) + 0.08 * fbm(x * 4, y * 4, seed, 3));
    if (band < 0.1) return milky[band < 0.05 ? 1 : 0] ?? 0;
    return sky[Math.min(3, Math.floor((y / h1) * 4))] ?? 0;
  };
  return rasterize(scene, width, height, pal.colors);
}

/** Aurore boréale au-dessus de montagnes enneigées et d'un lac. */
export function aurora(width: number, height: number, seed: number): Grid {
  const rnd = mulberry32(seed * 887);
  const pal = new Pal();
  const sky = pal.ramp(oklch(0.18, 0.05, 260), oklch(0.32, 0.06, 230), 3);
  const hueA = 150 + rnd() * 40;
  const glow = pal.ramp(oklch(0.55, 0.12, hueA), oklch(0.85, 0.14, hueA - 10), 3);
  const violet = pal.add(oklch(0.5, 0.12, 310));
  const star = pal.add(oklch(0.96, 0.03, 90));
  const snow = pal.ramp(oklch(0.85, 0.03, 230), oklch(0.6, 0.05, 240), 2);
  const rock = pal.add(oklch(0.3, 0.04, 250));
  const lake = pal.ramp(oklch(0.28, 0.05, 230), oklch(0.2, 0.05, 240), 2);
  const horizon = 0.7;
  const scene = (x: number, y: number): number => {
    const mountTop = horizon - 0.22 * (0.3 + 0.7 * fbm(x * 3, 1, seed, 4));
    if (y >= mountTop && y < horizon) {
      const ridge = fbm(x * 10, y * 10, seed + 7, 3);
      if (y < mountTop + 0.05) return snow[0] ?? 0;
      return ridge > 0.55 ? (snow[1] ?? 0) : rock;
    }
    if (y >= horizon) {
      // reflet des lueurs dans le lac
      const ry = horizon - (y - horizon) * 1.4;
      const curtain = Math.sin(x * 9 + Math.sin(x * 3 + seed) * 2) * 0.07 + 0.3;
      if (Math.abs(ry - curtain) < 0.05 && fbm(x * 14, 0.5, seed + 2, 3) > 0.4) return glow[0] ?? 0;
      return lake[y > horizon + 0.15 ? 1 : 0] ?? 0;
    }
    const curtain = Math.sin(x * 9 + Math.sin(x * 3 + seed) * 2) * 0.07 + 0.3;
    const dy = curtain - y;
    if (dy > -0.03 && dy < 0.22) {
      const streak = fbm(x * 14, 0.5, seed + 2, 3);
      const t = 1 - (dy + 0.03) / 0.25;
      if (streak > 0.35) {
        if (t > 0.85) return glow[2] ?? 0;
        if (t > 0.55) return glow[1] ?? 0;
        if (t > 0.25) return glow[0] ?? 0;
        return violet;
      }
    }
    if (starAt(x, y, seed, 0.3)) return star;
    return sky[Math.min(2, Math.floor((y / horizon) * 3))] ?? 0;
  };
  return rasterize(scene, width, height, pal.colors);
}

// --- Saisons -----------------------------------------------------------------------------------------

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** Le même arbre au fil des saisons (graine % 4 : printemps, été, automne, hiver). */
export function seasonTree(width: number, height: number, seed: number): Grid {
  const season = SEASONS[(seed - 1) % 4] ?? 'spring';
  const rnd = mulberry32(Math.floor((seed - 1) / 4) * 61 + 7);
  const pal = new Pal();
  const skyC: Record<Season, [Rgb, Rgb]> = {
    spring: [oklch(0.85, 0.06, 230), oklch(0.95, 0.03, 200)],
    summer: [oklch(0.75, 0.1, 235), oklch(0.93, 0.05, 210)],
    autumn: [oklch(0.82, 0.06, 70), oklch(0.93, 0.05, 85)],
    winter: [oklch(0.72, 0.07, 245), oklch(0.9, 0.03, 230)],
  };
  const sky = pal.ramp(skyC[season][0], skyC[season][1], 3);
  const groundC: Record<Season, Rgb> = {
    spring: oklch(0.72, 0.12, 135),
    summer: oklch(0.65, 0.12, 125),
    autumn: oklch(0.62, 0.1, 75),
    winter: oklch(0.96, 0.01, 240),
  };
  const ground = pal.add(groundC[season]);
  const ground2 = pal.add(mix(groundC[season], oklch(0.4, 0.05, 140), 0.25));
  const bark = pal.add(oklch(0.4, 0.05, 45));
  const leafSets: Record<Season, Rgb[]> = {
    spring: [oklch(0.86, 0.07, 350), oklch(0.76, 0.1, 355), oklch(0.95, 0.03, 20)],
    summer: [oklch(0.6, 0.13, 140), oklch(0.5, 0.12, 150), oklch(0.7, 0.13, 130)],
    autumn: [oklch(0.66, 0.16, 45), oklch(0.58, 0.16, 30), oklch(0.78, 0.14, 75)],
    winter: [oklch(0.97, 0.01, 240), oklch(0.88, 0.03, 245)],
  };
  const leaves = leafSets[season].map((c) => pal.add(c));
  // branches : segments récursifs
  const segs: [number, number, number, number, number][] = [];
  const tipsAt: number[] = [];
  const grow = (x: number, y: number, a: number, l: number, w: number, depth: number) => {
    const x2 = x + Math.cos(a) * l;
    const y2 = y + Math.sin(a) * l;
    if (depth <= 1) tipsAt.push(segs.length);
    segs.push([x, y, x2, y2, w]);
    if (depth === 0) return;
    const spread = 0.35 + rnd() * 0.25;
    grow(x2, y2, a - spread, l * (0.7 + rnd() * 0.1), w * 0.68, depth - 1);
    grow(x2, y2, a + spread, l * (0.7 + rnd() * 0.1), w * 0.68, depth - 1);
  };
  grow(0.5, 1.12, -Math.PI / 2, 0.25, 0.045, 5);
  const blobs = segs.filter((_, i) => i >= 15).map(([, , x, y]) => [x, y, 0.05 + rnd() * 0.035] as const);
  const falling = Array.from({ length: 18 }, () => [rnd(), 0.1 + rnd() * 1.0] as const);
  const scene = (x: number, y: number): number => {
    if (season !== 'winter') {
      for (const [bx, by, r] of blobs) {
        const d = Math.hypot(x - bx, y - by);
        if (d < r)
          return leaves[Math.floor(fbm(x * 25, y * 25, seed, 2) * leaves.length * 1.2) % leaves.length] ?? 0;
      }
    }
    for (const [x1, y1, x2, y2, w] of segs) {
      if (segDist(x, y, x1, y1, x2, y2) < w / 2) {
        // neige posée sur le dessus des branches
        if (season === 'winter' && segDist(x, y + w * 0.4, x1, y1, x2, y2) >= w / 2) return leaves[0] ?? 0;
        return bark;
      }
    }
    if (season === 'autumn' || season === 'spring' || season === 'winter') {
      for (const [fx, fy] of falling) {
        if (Math.hypot(x - fx, y - fy) < (season === 'winter' ? 0.009 : 0.012))
          return leaves[season === 'winter' ? 0 : 1] ?? 0;
      }
    }
    const gy = 1.1 + 0.02 * Math.sin(x * 6);
    if (y > gy) return y > 1.18 ? ground2 : ground;
    return sky[Math.min(2, Math.floor((y / gy) * 3))] ?? 0;
  };
  return rasterize(scene, width, height, pal.colors);
}
