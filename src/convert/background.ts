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

/** Rugosité maximale (ΔE OKLab moyen entre cases voisines) d'une zone de fond. */
const MAX_ROUGHNESS = 0.012;

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
  const stepTol = 0.016 + t * 0.03;
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
    (size, id) =>
      size >= minSize && (pairs[id] ?? 0) > 0 && (rough[id] ?? 1) / (pairs[id] ?? 1) < MAX_ROUGHNESS,
  );

  const mask = new Uint8Array(n);
  let removed = 0;
  for (let i = 0; i < n; i++) {
    const id = label[i] ?? -1;
    if (id >= 0 && keep[id]) {
      mask[i] = 1;
      removed++;
    }
  }
  let onBorder = 0;
  for (const i of border) if (mask[i]) onBorder++;
  const borderCoverage = onBorder / border.length;
  const ratio = removed / n;
  const regions = keep.filter(Boolean).length;

  // 3. est-ce vraiment un fond ?
  if (borderCoverage < 0.5 || ratio < 0.08 || ratio > 0.9) {
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
