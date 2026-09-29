import type { Grid, Rgb } from '../../src/content/grid';
import { DIFFICULTY_SPEC, type Difficulty } from '../../src/content/library/types';
import { convertPixels, DEFAULT_PARAMS } from '../../src/convert/pipeline';
import { gridSizeFor } from '../../src/convert/resample';
import type { Raster } from './svg';

/** Illustration à aplats → grille d'une difficulté (palette du SVG conservée si elle tient). */
export function svgToGrid(r: Raster, difficulty: Difficulty, palette: readonly Rgb[]): Grid {
  const spec = DIFFICULTY_SPEC[difficulty];
  const { width, height } = gridSizeFor(r.width / r.height, spec.long);
  return convertPixels(r.pixels, r.width, r.height, {
    ...DEFAULT_PARAMS,
    width,
    height,
    colors: spec.colors,
    palette,
    saturation: 0,
    sharpen: 0,
    dither: false,
    // seulement les cases isolées dues à l'antialiasing : les petits détails voulus (yeux) restent
    cleanup: 0.1,
    mergeDistance: 0.02,
    importance: 0.7,
  }).grid;
}

/** Peinture ou estampe → grille d'une difficulté. */
export function paintingToGrid(r: Raster, difficulty: Difficulty): Grid {
  const spec = DIFFICULTY_SPEC[difficulty];
  const { width, height } = gridSizeFor(r.width / r.height, spec.long);
  return convertPixels(r.pixels, r.width, r.height, {
    ...DEFAULT_PARAMS,
    width,
    height,
    colors: spec.colors,
    saturation: 0.12,
    sharpen: 0.3,
    cleanup: 0.5,
  }).grid;
}
