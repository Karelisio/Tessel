import { describe, expect, it } from 'vitest';
import { duration, spring, staggerDelay } from './tokens';

describe('charte de motion', () => {
  it('garde toutes les durées dans la plage 120–450 ms', () => {
    for (const d of Object.values(duration)) {
      expect(d).toBeGreaterThanOrEqual(120);
      expect(d).toBeLessThanOrEqual(450);
    }
  });

  it('plafonne les décalages en cascade', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBe(90);
    expect(staggerDelay(1000)).toBe(300);
  });

  it('définit des ressorts amortis', () => {
    for (const s of Object.values(spring)) expect(s.damping).toBeGreaterThan(0);
  });
});
