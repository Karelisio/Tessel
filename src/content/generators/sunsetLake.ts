import { createGrid, hexToRgb, type Grid } from '../grid';
import { fbm, hash2, mulberry32 } from '../random';

const PALETTE = [
  '#3b2f63', // 0 ciel haut
  '#5a3f7a',
  '#82508f',
  '#b0648f',
  '#d9798a',
  '#f0987f',
  '#f7b98a',
  '#fbd9a0', // 7 lueur de l'horizon
  '#fff3cf', // 8 soleil
  '#a58fc0', // 9 montagnes lointaines
  '#7a64a0', // 10 montagnes moyennes
  '#4b3b6e', // 11 collines
  '#2a2340', // 12 silhouettes
  '#f2b6b3', // 13 nuages roses
  '#fbe3d6', // 14 nuages clairs
  '#4f4777', // 15 lac
  '#f4c3a1', // 16 reflets
  '#6b5d91', // 17 lac clair
  '#3a3160', // 18 rive
] as const;

/**
 * Paysage « lac au coucher du soleil » : ciel en bandes, soleil, nuages, montagnes,
 * reflets et sapins. Déterministe pour une graine donnée.
 */
export function sunsetLake(width = 150, height = 150, seed = 1): Grid {
  const rand = mulberry32(seed);
  const cells = new Uint8Array(width * height);
  const horizon = Math.round(height * 0.6);
  const sun = { x: width * (0.58 + rand() * 0.12), y: horizon - height * 0.13, r: width * 0.085 };

  const ridge = (x: number, base: number, amp: number, freq: number, s: number) =>
    base - amp * (0.35 + 0.65 * fbm(x * freq, s, seed + s, 4));

  const skyAt = (x: number, y: number): number => {
    const dx = x - sun.x;
    const dy = y - sun.y;
    const d = Math.hypot(dx, dy);
    if (d < sun.r) return 8;
    if (d < sun.r * 1.45 && y < horizon) return 7;
    // nuages allongés
    if (y > height * 0.12 && y < height * 0.42) {
      const n = fbm(x * 0.035, y * 0.11, seed + 5, 5);
      const band = 1 - Math.abs(y / height - 0.27) * 5;
      if (n * band > 0.5) return 14;
      if (n * band > 0.44) return 13;
    }
    const t = y / horizon + 0.018 * Math.sin(x * 0.09 + y * 0.05);
    return Math.max(0, Math.min(7, Math.floor(t * 8)));
  };

  const farH = (x: number) => ridge(x, horizon, height * 0.2, 0.025, 11);
  const midH = (x: number) => ridge(x, horizon + 1, height * 0.13, 0.04, 23);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let c: number;
      if (y < horizon) {
        c = skyAt(x, y);
        if (y >= farH(x)) c = 9;
        if (y >= midH(x)) c = 10;
      } else {
        // reflet vertical inversé, compressé, avec vaguelettes
        const depth = y - horizon;
        const ripple = Math.sin(y * 1.7 + x * 0.12) * (1 + depth * 0.05);
        const ry = horizon - depth * 1.35 + ripple;
        const rx = x + Math.sin(y * 0.9) * 0.8;
        let r = skyAt(rx, ry);
        if (ry >= farH(rx)) r = 9;
        if (ry >= midH(rx)) r = 10;
        const reflect: Record<number, number> = {
          0: 15,
          1: 15,
          2: 17,
          3: 17,
          4: 3,
          5: 4,
          6: 5,
          7: 6,
          8: 16,
          9: 17,
          10: 15,
          13: 4,
          14: 16,
        };
        c = reflect[r] ?? 15;
        // traînée scintillante du soleil
        // traits horizontaux de 2 à 4 cases (pas de case isolée)
        const glitter =
          Math.abs(x - sun.x) < sun.r * (0.6 + depth * 0.03) &&
          hash2(Math.floor(x / 3), y, seed) > 0.5 &&
          y % 2 === 0;
        if (glitter) c = 16;
        if (depth > height * 0.3 && c !== 16) c = fbm(x * 0.05, y * 0.5, seed + 3, 3) > 0.56 ? 17 : 15;
      }
      cells[y * width + x] = c;
    }
  }

  // collines latérales qui descendent sur le lac
  for (let x = 0; x < width; x++) {
    const side = Math.max(0, 1 - Math.min(x, width - 1 - x) / (width * 0.28));
    const top = horizon - height * 0.06 * side - 2 * fbm(x * 0.08, 3, seed + 31) + (1 - side) * height * 0.5;
    const bottom = horizon + height * 0.12 * side;
    for (let y = Math.max(0, Math.floor(top)); y < Math.min(height, bottom); y++) {
      if (side > 0.02) cells[y * width + x] = 11;
    }
  }

  // sapins en silhouette
  const trees = 14;
  for (let i = 0; i < trees; i++) {
    const left = i < trees / 2;
    const tx = left ? rand() * width * 0.24 : width - 1 - rand() * width * 0.24;
    const base = horizon + height * (0.1 + rand() * 0.28);
    const th = height * (0.12 + rand() * 0.14);
    const tw = th * 0.32;
    for (let y = Math.floor(base - th); y < Math.min(height, base); y++) {
      const k = (y - (base - th)) / th;
      // étages du sapin
      const tier = 0.55 + 0.45 * ((k * 4) % 1);
      const half = tw * k * tier + 0.6;
      for (let x = Math.floor(tx - half); x <= Math.ceil(tx + half); x++) {
        if (x >= 0 && x < width && y >= 0) cells[y * width + x] = 12;
      }
    }
  }

  // rive au premier plan
  for (let x = 0; x < width; x++) {
    const shore = height - 4 - 3 * fbm(x * 0.06, 9, seed + 41);
    for (let y = Math.floor(shore); y < height; y++) cells[y * width + x] = y > shore + 2 ? 12 : 18;
  }

  // quelques oiseaux
  for (let b = 0; b < 3; b++) {
    const bx = Math.floor(width * (0.2 + rand() * 0.35));
    const by = Math.floor(height * (0.1 + rand() * 0.15));
    for (const [dx, dy] of [
      [-2, -1],
      [-1, 0],
      [0, 1],
      [1, 0],
      [2, -1],
    ] as const) {
      const x = bx + dx;
      const y = by + dy;
      if (x >= 0 && x < width && y >= 0 && y < height) cells[y * width + x] = 12;
    }
  }

  return createGrid(width, height, PALETTE.map(hexToRgb), cells);
}
