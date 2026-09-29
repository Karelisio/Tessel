import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '@/convert/pipeline';
import { snapValue } from './math';
import {
  buildParams,
  DEFAULT_SETTINGS,
  difficultyOf,
  formatPercent,
  isDefaultSettings,
  type Settings,
} from './settings';

describe('difficultyOf', () => {
  it('suit les seuils de l’énoncé', () => {
    expect(difficultyOf(30)).toBe('Facile');
    expect(difficultyOf(60)).toBe('Facile');
    expect(difficultyOf(61)).toBe('Moyen');
    expect(difficultyOf(110)).toBe('Moyen');
    expect(difficultyOf(111)).toBe('Difficile');
    expect(difficultyOf(180)).toBe('Difficile');
    expect(difficultyOf(181)).toBe('Expert');
    expect(difficultyOf(300)).toBe('Expert');
  });
});

describe('formatPercent', () => {
  it('met une espace insécable avant le signe %', () => {
    expect(formatPercent(0.35)).toBe('35 %');
    expect(formatPercent(0)).toBe('0 %');
    expect(formatPercent(1)).toBe('100 %');
  });

  it('affiche le signe des valeurs centrées sur zéro', () => {
    expect(formatPercent(0.1, true)).toBe('+10 %');
    expect(formatPercent(-0.05, true)).toBe('−5 %');
    expect(formatPercent(0, true)).toBe('0 %');
    // un arrondi à zéro n’affiche pas de signe
    expect(formatPercent(-0.004, true)).toBe('0 %');
  });
});

describe('réglages', () => {
  it('démarrent sur les valeurs par défaut de la conversion', () => {
    expect(DEFAULT_SETTINGS.colors).toBe(DEFAULT_PARAMS.colors);
    expect(DEFAULT_SETTINGS.saturation).toBe(DEFAULT_PARAMS.saturation);
    expect(DEFAULT_SETTINGS.sharpen).toBe(DEFAULT_PARAMS.sharpen);
    expect(DEFAULT_SETTINGS.cleanup).toBe(DEFAULT_PARAMS.cleanup);
    expect(DEFAULT_SETTINGS.tolerance).toBe(DEFAULT_PARAMS.backgroundTolerance);
    expect(DEFAULT_SETTINGS.dither).toBe(false);
    expect(DEFAULT_SETTINGS.removeBackground).toBe(false);
    expect(isDefaultSettings(DEFAULT_SETTINGS)).toBe(true);
  });

  it('détectent un écart avec les valeurs par défaut', () => {
    const changed: Settings = { ...DEFAULT_SETTINGS, contrast: 0.2 };
    expect(isDefaultSettings(changed)).toBe(false);
  });

  it('se traduisent en paramètres de conversion', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      colors: 40,
      brightness: 0.25,
      dither: true,
      removeBackground: true,
      tolerance: 0.6,
    };
    const crop = { x: 10, y: 20, w: 300, h: 200 };
    const p = buildParams(settings, { width: 120, height: 80 }, crop);
    expect(p).toMatchObject({
      width: 120,
      height: 80,
      crop,
      colors: 40,
      brightness: 0.25,
      dither: true,
      removeBackground: true,
      backgroundTolerance: 0.6,
      mergeDistance: DEFAULT_PARAMS.mergeDistance,
      importance: DEFAULT_PARAMS.importance,
    });
  });
});

describe('snapValue', () => {
  it('ramène sur la grille du pas, sans bruit de virgule flottante', () => {
    expect(snapValue(0.07, -1, 1, 0.05)).toBe(0.05);
    expect(snapValue(0.024, -1, 1, 0.05)).toBe(0);
    expect(snapValue(-0.31, -1, 1, 0.05)).toBe(-0.3);
    expect(snapValue(137, 30, 300, 5)).toBe(135);
    expect(snapValue(23.6, 8, 64, 1)).toBe(24);
  });

  it('borne à [min, max]', () => {
    expect(snapValue(-9, -1, 1, 0.05)).toBe(-1);
    expect(snapValue(9, 0, 1, 0.05)).toBe(1);
    expect(snapValue(1000, 30, 300, 5)).toBe(300);
  });

  it('ne produit pas de zéro négatif', () => {
    expect(Object.is(snapValue(-0.001, -1, 1, 0.05), 0)).toBe(true);
  });
});
