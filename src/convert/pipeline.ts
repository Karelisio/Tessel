import { createGrid, TRANSPARENT, type Grid, type Rgb } from '@/content/grid';
import { applyAdjustments, type Adjustments } from './adjust';
import { assignDithered, assignNearest } from './assign';
import { detectBackground } from './background';
import { mergeSmallRegions, minRegionSize } from './cleanup';
import { finalizePalette } from './palette';
import { srgb8ToOklab } from './color';
import { histogram, quantize } from './quantize';
import { resampleToCells, type CropRect } from './resample';

export interface ConvertParams extends Adjustments {
  width: number;
  height: number;
  /** Nombre de couleurs visé (8–64) ; la fusion des couleurs trop proches peut en retenir moins. */
  colors: number;
  crop?: CropRect;
  dither: boolean;
  removeBackground: boolean;
  /** 0–1 */
  backgroundTolerance: number;
  /** 0–1 : suppression des cases isolées et des petits îlots (sans effet avec le tramage). */
  cleanup: number;
  /** Écart OKLab minimal entre deux couleurs (défaut 0,035). */
  mergeDistance?: number;
  /** Poids des petites plages de couleur (0,5 = favorise les accents, 1 = proportionnel à la surface). */
  importance?: number;
  /**
   * Palette imposée (illustrations à aplats, palettes du catalogue) : utilisée telle quelle si elle
   * tient dans `colors`, sinon réduite par quantification comme une photo.
   */
  palette?: readonly Rgb[];
}

export const DEFAULT_PARAMS: Omit<ConvertParams, 'width' | 'height'> = {
  colors: 24,
  brightness: 0,
  contrast: 0,
  saturation: 0.1,
  sharpen: 0.35,
  dither: false,
  removeBackground: false,
  backgroundTolerance: 0.25,
  cleanup: 0.5,
  mergeDistance: 0.035,
  importance: 0.55,
};

export interface ConvertStats {
  colors: number;
  transparent: number;
  backgroundFound: boolean;
  ms: number;
}

export interface ConvertResult {
  grid: Grid;
  stats: ConvertStats;
}

/** Photo (RGBA) → grille jouable. Pur et déterministe : mêmes entrées, même grille. */
export function convertPixels(
  pixels: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
  params: ConvertParams,
  now: () => number = () => performance.now(),
): ConvertResult {
  const t0 = now();
  const { width, height } = params;
  const img = resampleToCells(pixels, srcW, srcH, width, height, params.crop);
  applyAdjustments(img, params);

  const n = width * height;
  const include = new Uint8Array(n);
  for (let i = 0; i < n; i++) include[i] = (img.alpha[i] ?? 0) >= 0.5 ? 1 : 0;
  let backgroundFound = false;
  if (params.removeBackground) {
    const bg = detectBackground(img, params.backgroundTolerance);
    backgroundFound = bg.found;
    if (bg.found) for (let i = 0; i < n; i++) if (bg.mask[i]) include[i] = 0;
  }
  // image entièrement transparente : on garde tout plutôt qu'une grille vide
  if (!include.includes(1)) include.fill(1);

  const colors = Math.max(2, Math.min(64, Math.round(params.colors)));
  const fixed = params.palette;
  const paletteLab =
    fixed && fixed.length <= colors
      ? Float32Array.from(fixed.flatMap(([r, g, b]) => srgb8ToOklab(r, g, b)))
      : quantize(histogram(img.lab, include, params.importance ?? 0.55), {
          colors,
          mergeDistance: params.mergeDistance ?? 0.035,
        });
  let cells = params.dither
    ? assignDithered(img.lab, include, width, height, paletteLab, 0.75)
    : assignNearest(img.lab, include, paletteLab);
  if (!params.dither)
    mergeSmallRegions(cells, width, height, img.lab, paletteLab, minRegionSize(params.cleanup));

  const final = finalizePalette(cells, paletteLab);
  cells = final.cells;
  let transparent = 0;
  for (const c of cells) if (c === TRANSPARENT) transparent++;
  return {
    grid: createGrid(width, height, final.palette, cells),
    stats: { colors: final.palette.length, transparent, backgroundFound, ms: now() - t0 },
  };
}
