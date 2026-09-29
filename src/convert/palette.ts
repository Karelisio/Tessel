import { TRANSPARENT, type Rgb } from '@/content/grid';
import { chroma, hue, oklabToSrgb8 } from './color';

const NEUTRAL_CHROMA = 0.03;

/**
 * Palette finale : couleurs inutilisées retirées, doublons sRGB fusionnés, ordre agréable
 * (couleurs par teinte comme un nuancier, puis les neutres du clair au foncé). Remappe les cases.
 */
export function finalizePalette(
  cells: Uint8Array,
  paletteLab: Float32Array,
): { palette: Rgb[]; cells: Uint8Array } {
  const k = paletteLab.length / 3;
  const used = new Uint32Array(k);
  for (const c of cells) if (c !== TRANSPARENT) used[c] = (used[c] ?? 0) + 1;

  interface Entry {
    old: number;
    rgb: Rgb;
    L: number;
    C: number;
    h: number;
  }
  const entries: Entry[] = [];
  for (let j = 0; j < k; j++) {
    if (!used[j]) continue;
    const L = paletteLab[j * 3] ?? 0;
    const a = paletteLab[j * 3 + 1] ?? 0;
    const b = paletteLab[j * 3 + 2] ?? 0;
    entries.push({ old: j, rgb: oklabToSrgb8(L, a, b), L, C: chroma(a, b), h: hue(a, b) });
  }
  // teintes en 12 familles en partant du rouge ; dans une famille, du clair au foncé
  const family = (e: Entry) =>
    e.C < NEUTRAL_CHROMA ? 99 : Math.floor(((e.h + Math.PI / 12) % (Math.PI * 2)) / (Math.PI / 6));
  entries.sort((x, y) => family(x) - family(y) || y.L - x.L);

  const remap = new Uint8Array(k).fill(TRANSPARENT);
  const palette: Rgb[] = [];
  const seen = new Map<number, number>();
  for (const e of entries) {
    const key = (e.rgb[0] << 16) | (e.rgb[1] << 8) | e.rgb[2];
    const existing = seen.get(key);
    if (existing !== undefined) {
      remap[e.old] = existing;
      continue;
    }
    seen.set(key, palette.length);
    remap[e.old] = palette.length;
    palette.push(e.rgb);
  }
  const out = new Uint8Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i] ?? TRANSPARENT;
    out[i] = c === TRANSPARENT ? TRANSPARENT : (remap[c] ?? TRANSPARENT);
  }
  return { palette, cells: out };
}
