import type { ConvertClient } from '@/convert/client';
import { DEFAULT_PARAMS, type ConvertParams, type ConvertResult } from '@/convert/pipeline';
import type { CropRect } from '@/convert/resample';

/** Réglages de l'écran d'import (le recadrage et le mode de jeu sont gérés à part). */
export interface Settings {
  /** Côté le plus long de la grille, en cases. */
  size: number;
  /** Nombre de couleurs visé. */
  colors: number;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpen: number;
  cleanup: number;
  dither: boolean;
  removeBackground: boolean;
  /** Tolérance de la détection du fond (0–1). */
  tolerance: number;
}

export const SIZE_RANGE = { min: 30, max: 300, step: 5 } as const;
export const COLOR_RANGE = { min: 8, max: 64, step: 1 } as const;

export const DEFAULT_SETTINGS: Settings = {
  size: 100,
  colors: DEFAULT_PARAMS.colors,
  brightness: DEFAULT_PARAMS.brightness,
  contrast: DEFAULT_PARAMS.contrast,
  saturation: DEFAULT_PARAMS.saturation,
  sharpen: DEFAULT_PARAMS.sharpen,
  cleanup: DEFAULT_PARAMS.cleanup,
  dither: DEFAULT_PARAMS.dither,
  removeBackground: DEFAULT_PARAMS.removeBackground,
  tolerance: DEFAULT_PARAMS.backgroundTolerance,
};

export function isDefaultSettings(s: Settings): boolean {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).every((k) => s[k] === DEFAULT_SETTINGS[k]);
}

export type Difficulty = 'Facile' | 'Moyen' | 'Difficile' | 'Expert';

/** Difficulté d'après le côté le plus long de la grille. */
export function difficultyOf(size: number): Difficulty {
  if (size <= 60) return 'Facile';
  if (size <= 110) return 'Moyen';
  if (size <= 180) return 'Difficile';
  return 'Expert';
}

/** « 35 % » ; avec `signed`, « +10 % » / « −5 % » (vrai signe moins, espace insécable avant %). */
export function formatPercent(value: number, signed = false): string {
  const p = Math.round(value * 100);
  const sign = p < 0 ? '−' : signed && p > 0 ? '+' : '';
  return `${sign}${String(Math.abs(p))}\u00a0%`;
}

/** Réglages + dimensions de grille + recadrage (pixels source) → paramètres de conversion. */
export function buildParams(
  s: Settings,
  dims: { width: number; height: number },
  crop: CropRect,
): ConvertParams {
  return {
    ...DEFAULT_PARAMS,
    width: dims.width,
    height: dims.height,
    crop,
    colors: s.colors,
    brightness: s.brightness,
    contrast: s.contrast,
    saturation: s.saturation,
    sharpen: s.sharpen,
    cleanup: s.cleanup,
    dither: s.dither,
    removeBackground: s.removeBackground,
    backgroundTolerance: s.tolerance,
  };
}

/** Dernier résultat de conversion, avec les paramètres qui l'ont produit. */
export interface Output {
  client: ConvertClient;
  params: ConvertParams;
  result: ConvertResult;
}
