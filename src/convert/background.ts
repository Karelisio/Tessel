import { dist2 } from './color';
import type { CellImage } from './resample';

export interface BackgroundResult {
  /** 1 = case de fond (deviendra transparente). */
  mask: Uint8Array;
  found: boolean;
  /** Part des cases retirées. */
  ratio: number;
  /** Diagnostics : part du bord couverte par le fond retenu, nombre de zones retenues. */
  borderCoverage: number;
  regions: number;
}

/** Rugosité maximale (ΔE OKLab moyen entre cases voisines) d'une zone de fond, à 70 cases de côté. */
const MAX_ROUGHNESS = 0.012;
/** Résolution de référence des seuils : l'écart entre voisines d'un dégradé varie comme 1/taille. */
const REFERENCE_SIDE = 70;

/**
 * Ouverture morphologique du fond : érosion (rayon r), on ne garde que ce qui reste relié au bord,
 * puis dilatation dans les limites du masque d'origine. Coupe les passages étroits par lesquels
 * le fond s'infiltrait dans le sujet (ex. porcelaine blanche sur fond blanc).
 */
function openFromBorder(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  let cur = mask;
  for (let k = 0; k < r; k++) {
    const next = new Uint8Array(cur.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        // hors de l'image compte comme du fond : le bord n'est pas érodé
        next[i] =
          cur[i] &&
          (x === 0 || cur[i - 1]) &&
          (x === w - 1 || cur[i + 1]) &&
          (y === 0 || cur[i - w]) &&
          (y === h - 1 || cur[i + w])
            ? 1
            : 0;
      }
    cur = next;
  }
  const kept = new Uint8Array(cur.length);
  const queue = new Int32Array(cur.length);
  let tail = 0;
  for (let x = 0; x < w; x++)
    for (const i of [x, (h - 1) * w + x])
      if (cur[i] && !kept[i]) {
        kept[i] = 1;
        queue[tail++] = i;
      }
  for (let y = 0; y < h; y++)
    for (const i of [y * w, y * w + w - 1])
      if (cur[i] && !kept[i]) {
        kept[i] = 1;
        queue[tail++] = i;
      }
  for (let head = 0; head < tail; head++) {
    const i = queue[head] ?? 0;
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j >= 0 && j < cur.length && cur[j] && !kept[j]) {
        kept[j] = 1;
        queue[tail++] = j;
      }
    }
  }
  let out = kept;
  for (let k = 0; k < r; k++) {
    const next = out.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (out[i] || !mask[i]) continue;
        if (
          (x > 0 && out[i - 1]) ||
          (x < w - 1 && out[i + 1]) ||
          (y > 0 && out[i - w]) ||
          (y < h - 1 && out[i + w])
        )
          next[i] = 1;
      }
    out = next;
  }
  return out;
}

/**
 * Suppression de fond simple, pensée pour un sujet photographié sur un fond uni, en dégradé,
 * ou posé sur une surface (mur + sol) :
 * 1. depuis chaque case du bord, on propage de proche en proche uniquement entre cases voisines
 *    très semblables : chaque zone lisse reliée au bord devient un fond candidat (un dégradé est suivi,
 *    une texture ou un contour arrête la propagation) ;
 * 2. on garde les candidats assez grands et vraiment lisses ;
 * 3. le résultat n'est retenu que s'il couvre l'essentiel du bord et laisse un sujet de taille
 *    raisonnable. Sinon rien n'est retiré : un tableau ou un paysage n'a pas de « fond ».
 * `tolerance` 0–1 élargit l'écart accepté entre deux cases voisines.
 */
export function detectBackground(img: CellImage, tolerance: number): BackgroundResult {
  const { width: w, height: h, lab } = img;
  const n = w * h;
  const t = Math.max(0, Math.min(1, tolerance));
  // seuils proportionnels à la taille des cases : même comportement de 30 à 300 cases
  const scale = Math.max(0.3, Math.min(1.4, REFERENCE_SIDE / Math.max(w, h)));
  const stepTol = (0.016 + t * 0.03) * scale;
  const maxRough = MAX_ROUGHNESS * scale;
  const step2 = stepTol * stepTol;
  const d = (i: number, j: number) =>
    Math.sqrt(
      dist2(
        lab[i * 3] ?? 0,
        lab[i * 3 + 1] ?? 0,
        lab[i * 3 + 2] ?? 0,
        lab[j * 3] ?? 0,
        lab[j * 3 + 1] ?? 0,
        lab[j * 3 + 2] ?? 0,
      ),
    );

  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);

  // 1. zones lisses reliées au bord
  const label = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  const sizes: number[] = [];
  for (const seed of border) {
    if (label[seed] !== -1) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    label[seed] = id;
    queue[tail++] = seed;
    while (head < tail) {
      const i = queue[head++] ?? 0;
      const x = i % w;
      const y = (i - x) / w;
      const visit = (j: number) => {
        if (label[j] === -1 && d(i, j) ** 2 < step2) {
          label[j] = id;
          queue[tail++] = j;
        }
      };
      if (x > 0) visit(i - 1);
      if (x < w - 1) visit(i + 1);
      if (y > 0) visit(i - w);
      if (y < h - 1) visit(i + w);
    }
    sizes.push(tail);
  }

  // 2. rugosité de chaque zone (écart moyen entre voisines de la même zone)
  const rough = new Float64Array(sizes.length);
  const pairs = new Uint32Array(sizes.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const id = label[i] ?? -1;
      if (id < 0) continue;
      if (x < w - 1 && label[i + 1] === id) {
        rough[id] = (rough[id] ?? 0) + d(i, i + 1);
        pairs[id] = (pairs[id] ?? 0) + 1;
      }
      if (y < h - 1 && label[i + w] === id) {
        rough[id] = (rough[id] ?? 0) + d(i, i + w);
        pairs[id] = (pairs[id] ?? 0) + 1;
      }
    }
  const minSize = Math.max(6, Math.round(n * 0.02));
  const keep = sizes.map(
    (size, id) => size >= minSize && (pairs[id] ?? 0) > 0 && (rough[id] ?? 1) / (pairs[id] ?? 1) < maxRough,
  );

  let mask: Uint8Array = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const id = label[i] ?? -1;
    if (id >= 0 && keep[id]) mask[i] = 1;
  }
  mask = openFromBorder(mask, w, h, Math.max(1, Math.round(Math.max(w, h) / 70)));
  let removed = 0;
  for (let i = 0; i < n; i++) removed += mask[i] ?? 0;
  let onBorder = 0;
  for (const i of border) if (mask[i]) onBorder++;
  const borderCoverage = onBorder / border.length;
  const ratio = removed / n;
  const regions = keep.filter(Boolean).length;

  // 3. est-ce vraiment un fond ?
  if (borderCoverage < 0.45 || ratio < 0.08 || ratio > 0.9) {
    return { mask: new Uint8Array(n), found: false, ratio: 0, borderCoverage, regions };
  }
  // bouche les petits trous du sujet isolés dans le fond (reflets, bruit)
  const cleaned = mask.slice();
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i] && mask[i - 1] && mask[i + 1] && mask[i - w] && mask[i + w]) cleaned[i] = 1;
    }
  return { mask: cleaned, found: true, ratio, borderCoverage, regions };
}
