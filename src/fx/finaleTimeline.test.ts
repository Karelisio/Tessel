import { describe, expect, it } from 'vitest';
import { FINALE, finaleGlslConstants } from './finaleTimeline';

describe('chronologie de fin', () => {
  it('enchaîne les étapes dans l’ordre et se termine après le cadre', () => {
    expect(FINALE.sweepStart).toBeLessThan(FINALE.effectStart);
    expect(FINALE.matStart).toBeLessThan(FINALE.frameStart);
    expect(FINALE.frameStart + FINALE.frameDuration).toBeLessThanOrEqual(FINALE.done);
    expect(FINALE.effectStart + FINALE.effectSpread + FINALE.effectCell).toBeLessThanOrEqual(FINALE.done);
  });

  it('expose des constantes GLSL valides', () => {
    const glsl = finaleGlslConstants();
    expect(glsl).toMatch(/const float F_FRAME_DUR = 1\.200;/);
    expect(glsl).not.toMatch(/NaN|undefined/);
  });
});
