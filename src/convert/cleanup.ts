import { TRANSPARENT } from '@/content/grid';
import { dist2 } from './color';

const N8 = [-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1] as const;

/**
 * Fusionne les petits îlots (moins de `minSize` cases, connexité 8 : les lignes diagonales sont préservées)
 * dans la région voisine la plus pertinente : longue frontière commune et couleur proche de l'original.
 * Évite les cases isolées fastidieuses à trouver et à colorier. Renvoie le nombre de cases modifiées.
 */
export function mergeSmallRegions(
  cells: Uint8Array,
  width: number,
  height: number,
  lab: Float32Array,
  palette: Float32Array,
  minSize: number,
  maxPasses = 3,
): number {
  if (minSize <= 1) return 0;
  const n = cells.length;
  const label = new Int32Array(n);
  const stack = new Int32Array(n);
  let changed = 0;
  for (let pass = 0; pass < maxPasses; pass++) {
    label.fill(-1);
    let passChanged = 0;
    let next = 0;
    for (let seed = 0; seed < n; seed++) {
      if (label[seed] !== -1 || cells[seed] === TRANSPARENT) continue;
      const color = cells[seed] ?? 0;
      const id = next++;
      // remplissage : collecte de la composante
      let top = 0;
      let size = 0;
      stack[top++] = seed;
      label[seed] = id;
      const members: number[] = [];
      while (top > 0) {
        const i = stack[--top] ?? 0;
        members.push(i);
        size++;
        const x = i % width;
        const y = (i - x) / width;
        for (let d = 0; d < 16; d += 2) {
          const nx = x + (N8[d] ?? 0);
          const ny = y + (N8[d + 1] ?? 0);
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (label[j] === -1 && cells[j] === color) {
            label[j] = id;
            stack[top++] = j;
          }
        }
      }
      if (size >= minSize) continue;
      // couleurs voisines (frontière en connexité 4) et couleur moyenne d'origine de l'îlot
      const border = new Map<number, number>();
      let ml = 0;
      let ma = 0;
      let mb = 0;
      for (const i of members) {
        ml += lab[i * 3] ?? 0;
        ma += lab[i * 3 + 1] ?? 0;
        mb += lab[i * 3 + 2] ?? 0;
        const x = i % width;
        const y = (i - x) / width;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const c = cells[ny * width + nx] ?? TRANSPARENT;
          if (c === TRANSPARENT || c === color) continue;
          border.set(c, (border.get(c) ?? 0) + 1);
        }
      }
      if (border.size === 0) continue;
      ml /= size;
      ma /= size;
      mb /= size;
      let best = color;
      let bestScore = Infinity;
      let total = 0;
      for (const v of border.values()) total += v;
      for (const [c, count] of border) {
        const d = Math.sqrt(
          dist2(ml, ma, mb, palette[c * 3] ?? 0, palette[c * 3 + 1] ?? 0, palette[c * 3 + 2] ?? 0),
        );
        const score = d / (0.35 + count / total);
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
      for (const i of members) cells[i] = best;
      passChanged += size;
    }
    changed += passChanged;
    if (passChanged === 0) break;
  }
  return changed;
}

/** Nettoyage 0–1 → taille minimale d'un îlot conservé (0 : aucun nettoyage). */
export function minRegionSize(cleanup: number): number {
  if (cleanup <= 0) return 1;
  return 2 + Math.round(Math.min(1, cleanup) * 3);
}
