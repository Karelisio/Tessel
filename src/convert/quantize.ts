import { dist2, gamutMap } from './color';

/** Nuage de couleurs OKLab pondérées (issu d'un histogramme). */
export interface WeightedPoints {
  count: number;
  lab: Float32Array;
  /** Poids utilisé par la quantification (sous-linéaire en nombre de cases). */
  weight: Float32Array;
  /** Nombre réel de cases par point. */
  cells: Uint32Array;
}

const BINS = 64;
const AB_RANGE = 0.32;

/**
 * Histogramme OKLab (64³ classes, bien sous le seuil de perception) des cases retenues.
 * Chaque classe devient un point à la position moyenne de ses cases.
 * `importance` < 1 atténue la domination des grands aplats : les petites couleurs d'accent survivent.
 */
export function histogram(lab: Float32Array, include: Uint8Array, importance = 0.7): WeightedPoints {
  const n = include.length;
  const size = BINS * BINS * BINS;
  const counts = new Uint32Array(size);
  const sums = new Float64Array(size * 3);
  const key = (o: number) => {
    const li = Math.min(BINS - 1, Math.max(0, Math.floor((lab[o] ?? 0) * BINS)));
    const ai = Math.min(
      BINS - 1,
      Math.max(0, Math.floor((((lab[o + 1] ?? 0) + AB_RANGE) / (2 * AB_RANGE)) * BINS)),
    );
    const bi = Math.min(
      BINS - 1,
      Math.max(0, Math.floor((((lab[o + 2] ?? 0) + AB_RANGE) / (2 * AB_RANGE)) * BINS)),
    );
    return (li * BINS + ai) * BINS + bi;
  };
  let used = 0;
  for (let i = 0; i < n; i++) {
    if (!include[i]) continue;
    const o = i * 3;
    const k = key(o);
    if (counts[k] === 0) used++;
    counts[k] = (counts[k] ?? 0) + 1;
    sums[k * 3] = (sums[k * 3] ?? 0) + (lab[o] ?? 0);
    sums[k * 3 + 1] = (sums[k * 3 + 1] ?? 0) + (lab[o + 1] ?? 0);
    sums[k * 3 + 2] = (sums[k * 3 + 2] ?? 0) + (lab[o + 2] ?? 0);
  }
  const out: WeightedPoints = {
    count: used,
    lab: new Float32Array(used * 3),
    weight: new Float32Array(used),
    cells: new Uint32Array(used),
  };
  let p = 0;
  for (let k = 0; k < size; k++) {
    const c = counts[k] ?? 0;
    if (c === 0) continue;
    out.lab[p * 3] = (sums[k * 3] ?? 0) / c;
    out.lab[p * 3 + 1] = (sums[k * 3 + 1] ?? 0) / c;
    out.lab[p * 3 + 2] = (sums[k * 3 + 2] ?? 0) / c;
    out.weight[p] = c ** importance;
    out.cells[p] = c;
    p++;
  }
  return out;
}

interface Box {
  start: number;
  end: number;
  sse: number;
}

function boxSse(pts: WeightedPoints, order: Int32Array, start: number, end: number): number {
  let w = 0;
  let sl = 0;
  let sa = 0;
  let sb = 0;
  let q = 0;
  for (let k = start; k < end; k++) {
    const i = order[k] ?? 0;
    const wi = pts.weight[i] ?? 0;
    const l = pts.lab[i * 3] ?? 0;
    const a = pts.lab[i * 3 + 1] ?? 0;
    const b = pts.lab[i * 3 + 2] ?? 0;
    w += wi;
    sl += wi * l;
    sa += wi * a;
    sb += wi * b;
    q += wi * (l * l + a * a + b * b);
  }
  return w > 0 ? q - (sl * sl + sa * sa + sb * sb) / w : 0;
}

/** Coupe une boîte là où la somme des erreurs quadratiques des deux moitiés est minimale. */
function splitBox(pts: WeightedPoints, order: Int32Array, box: Box): [Box, Box] | null {
  const { start, end } = box;
  if (end - start < 2) return null;
  // axe de plus grande variance pondérée
  const mean = [0, 0, 0];
  const sq = [0, 0, 0];
  let w = 0;
  for (let k = start; k < end; k++) {
    const i = order[k] ?? 0;
    const wi = pts.weight[i] ?? 0;
    w += wi;
    for (let c = 0; c < 3; c++) {
      const v = pts.lab[i * 3 + c] ?? 0;
      mean[c] = (mean[c] ?? 0) + wi * v;
      sq[c] = (sq[c] ?? 0) + wi * v * v;
    }
  }
  let axis = 0;
  let best = -1;
  for (let c = 0; c < 3; c++) {
    const v = (sq[c] ?? 0) / w - ((mean[c] ?? 0) / w) ** 2;
    if (v > best) {
      best = v;
      axis = c;
    }
  }
  const seg = order.subarray(start, end);
  seg.sort((i, j) => (pts.lab[i * 3 + axis] ?? 0) - (pts.lab[j * 3 + axis] ?? 0));

  // sommes préfixes (poids, somme, somme des carrés) pour évaluer chaque coupure en O(1)
  let tw = 0;
  let tl = 0;
  let ta = 0;
  let tb = 0;
  let tq = 0;
  for (let k = start; k < end; k++) {
    const i = order[k] ?? 0;
    const wi = pts.weight[i] ?? 0;
    const l = pts.lab[i * 3] ?? 0;
    const a = pts.lab[i * 3 + 1] ?? 0;
    const b = pts.lab[i * 3 + 2] ?? 0;
    tw += wi;
    tl += wi * l;
    ta += wi * a;
    tb += wi * b;
    tq += wi * (l * l + a * a + b * b);
  }
  let lw = 0;
  let ll = 0;
  let la = 0;
  let lb = 0;
  let lq = 0;
  let bestCut = -1;
  let bestSse = Infinity;
  for (let k = start; k < end - 1; k++) {
    const i = order[k] ?? 0;
    const wi = pts.weight[i] ?? 0;
    const l = pts.lab[i * 3] ?? 0;
    const a = pts.lab[i * 3 + 1] ?? 0;
    const b = pts.lab[i * 3 + 2] ?? 0;
    lw += wi;
    ll += wi * l;
    la += wi * a;
    lb += wi * b;
    lq += wi * (l * l + a * a + b * b);
    const rw = tw - lw;
    if (lw <= 0 || rw <= 0) continue;
    const sseL = lq - (ll * ll + la * la + lb * lb) / lw;
    const rl = tl - ll;
    const ra = ta - la;
    const rb = tb - lb;
    const sseR = tq - lq - (rl * rl + ra * ra + rb * rb) / rw;
    if (sseL + sseR < bestSse) {
      bestSse = sseL + sseR;
      bestCut = k + 1;
    }
  }
  if (bestCut <= start || bestCut >= end) return null;
  return [
    { start, end: bestCut, sse: boxSse(pts, order, start, bestCut) },
    { start: bestCut, end, sse: boxSse(pts, order, bestCut, end) },
  ];
}

/** Coupe médiane optimisée (variance) : initialisation déterministe de k couleurs. */
export function medianCut(pts: WeightedPoints, k: number): Float32Array {
  const order = new Int32Array(pts.count);
  for (let i = 0; i < pts.count; i++) order[i] = i;
  const boxes: Box[] = [{ start: 0, end: pts.count, sse: boxSse(pts, order, 0, pts.count) }];
  while (boxes.length < k) {
    let pick = -1;
    let worst = 0;
    boxes.forEach((b, i) => {
      if (b.end - b.start > 1 && b.sse > worst) {
        worst = b.sse;
        pick = i;
      }
    });
    if (pick < 0) break;
    const box = boxes[pick];
    const parts = box ? splitBox(pts, order, box) : null;
    if (!parts) {
      if (box) box.sse = 0;
      continue;
    }
    boxes.splice(pick, 1, parts[0], parts[1]);
  }
  const out = new Float32Array(boxes.length * 3);
  boxes.forEach((b, j) => {
    let w = 0;
    const m = [0, 0, 0];
    for (let q = b.start; q < b.end; q++) {
      const i = order[q] ?? 0;
      const wi = pts.weight[i] ?? 0;
      w += wi;
      for (let c = 0; c < 3; c++) m[c] = (m[c] ?? 0) + wi * (pts.lab[i * 3 + c] ?? 0);
    }
    for (let c = 0; c < 3; c++) out[j * 3 + c] = w > 0 ? (m[c] ?? 0) / w : 0;
  });
  return out;
}

export function nearest(palette: Float32Array, k: number, l: number, a: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let j = 0; j < k; j++) {
    const d = dist2(l, a, b, palette[j * 3] ?? 0, palette[j * 3 + 1] ?? 0, palette[j * 3 + 2] ?? 0);
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  }
  return best;
}

/** K-moyennes pondérées (Lloyd). Un groupe vidé est réensemencé sur le point le plus mal représenté. */
export function kmeans(pts: WeightedPoints, init: Float32Array, iterations = 16): Float32Array {
  const k = init.length / 3;
  const c = init.slice();
  const assign = new Int32Array(pts.count);
  const sums = new Float64Array(k * 3);
  const ws = new Float64Array(k);
  for (let it = 0; it < iterations; it++) {
    sums.fill(0);
    ws.fill(0);
    let worstPoint = -1;
    let worstErr = -1;
    for (let i = 0; i < pts.count; i++) {
      const l = pts.lab[i * 3] ?? 0;
      const a = pts.lab[i * 3 + 1] ?? 0;
      const b = pts.lab[i * 3 + 2] ?? 0;
      const j = nearest(c, k, l, a, b);
      assign[i] = j;
      const w = pts.weight[i] ?? 0;
      sums[j * 3] = (sums[j * 3] ?? 0) + w * l;
      sums[j * 3 + 1] = (sums[j * 3 + 1] ?? 0) + w * a;
      sums[j * 3 + 2] = (sums[j * 3 + 2] ?? 0) + w * b;
      ws[j] = (ws[j] ?? 0) + w;
      const err = w * dist2(l, a, b, c[j * 3] ?? 0, c[j * 3 + 1] ?? 0, c[j * 3 + 2] ?? 0);
      if (err > worstErr) {
        worstErr = err;
        worstPoint = i;
      }
    }
    let shift = 0;
    for (let j = 0; j < k; j++) {
      const w = ws[j] ?? 0;
      const o = j * 3;
      let nl: number;
      let na: number;
      let nb: number;
      if (w > 0) {
        nl = (sums[o] ?? 0) / w;
        na = (sums[o + 1] ?? 0) / w;
        nb = (sums[o + 2] ?? 0) / w;
      } else if (worstPoint >= 0) {
        nl = pts.lab[worstPoint * 3] ?? 0;
        na = pts.lab[worstPoint * 3 + 1] ?? 0;
        nb = pts.lab[worstPoint * 3 + 2] ?? 0;
        worstPoint = -1;
      } else continue;
      shift = Math.max(shift, dist2(nl, na, nb, c[o] ?? 0, c[o + 1] ?? 0, c[o + 2] ?? 0));
      c[o] = nl;
      c[o + 1] = na;
      c[o + 2] = nb;
    }
    if (shift < 1e-10) break;
  }
  return c;
}

/** Poids (pondérés) de chaque couleur de palette sur le nuage de points. */
function paletteWeights(pts: WeightedPoints, palette: Float32Array): Float64Array {
  const k = palette.length / 3;
  const ws = new Float64Array(k);
  for (let i = 0; i < pts.count; i++) {
    const j = nearest(palette, k, pts.lab[i * 3] ?? 0, pts.lab[i * 3 + 1] ?? 0, pts.lab[i * 3 + 2] ?? 0);
    ws[j] = (ws[j] ?? 0) + (pts.weight[i] ?? 0);
  }
  return ws;
}

/**
 * Fusionne les couleurs plus proches que `distance` (ΔE OKLab) : chaque couleur de la palette
 * reste distinguable à l'œil, indispensable pour colorier par numéros.
 */
export function mergeClose(pts: WeightedPoints, palette: Float32Array, distance: number): Float32Array {
  const c = Array.from(palette);
  const w = Array.from(paletteWeights(pts, palette));
  const thr2 = distance * distance;
  for (;;) {
    const k = w.length;
    let bi = -1;
    let bj = -1;
    let best = thr2;
    for (let i = 0; i < k; i++)
      for (let j = i + 1; j < k; j++) {
        const d = dist2(
          c[i * 3] ?? 0,
          c[i * 3 + 1] ?? 0,
          c[i * 3 + 2] ?? 0,
          c[j * 3] ?? 0,
          c[j * 3 + 1] ?? 0,
          c[j * 3 + 2] ?? 0,
        );
        if (d < best) {
          best = d;
          bi = i;
          bj = j;
        }
      }
    if (bi < 0) break;
    const wi = w[bi] ?? 0;
    const wj = w[bj] ?? 0;
    const tw = wi + wj || 1;
    for (let q = 0; q < 3; q++) c[bi * 3 + q] = ((c[bi * 3 + q] ?? 0) * wi + (c[bj * 3 + q] ?? 0) * wj) / tw;
    w[bi] = wi + wj;
    c.splice(bj * 3, 3);
    w.splice(bj, 1);
  }
  return Float32Array.from(c);
}

export interface QuantizeOptions {
  colors: number;
  /** Distance OKLab minimale entre deux couleurs de la palette. */
  mergeDistance?: number;
  iterations?: number;
}

/** Palette OKLab (dans le gamut sRGB) d'au plus `colors` couleurs, toutes distinguables. */
export function quantize(pts: WeightedPoints, opts: QuantizeOptions): Float32Array {
  if (pts.count === 0) return new Float32Array([1, 0, 0]);
  const k = Math.max(1, Math.min(opts.colors, pts.count));
  let palette = kmeans(pts, medianCut(pts, k), opts.iterations ?? 16);
  const merge = opts.mergeDistance ?? 0;
  if (merge > 0) {
    const merged = mergeClose(pts, palette, merge);
    if (merged.length < palette.length) palette = kmeans(pts, merged, 6);
    // les k-moyennes peuvent rapprocher deux couleurs : dernière fusion sans nouvel ajustement
    palette = mergeClose(pts, palette, merge);
  }
  for (let j = 0; j < palette.length / 3; j++) gamutMap(palette, j * 3);
  return palette;
}
