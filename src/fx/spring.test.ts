import { describe, expect, it } from 'vitest';
import { spring, type SpringConfig } from '@/theme/motion/tokens';
import { springAtRest, stepSpring, type SpringState } from './spring';

function simulate(cfg: SpringConfig, dt: number, seconds: number): SpringState {
  const s: SpringState = { x: 0, v: 0 };
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepSpring(s, 1, cfg, dt);
  return s;
}

describe('stepSpring', () => {
  it('converge vers la cible pour chaque ressort de la charte', () => {
    for (const cfg of Object.values(spring)) {
      const s = simulate(cfg, 1 / 60, 3);
      expect(springAtRest(s, 1)).toBe(true);
    }
  });

  it('est indépendant du pas de temps (solution analytique)', () => {
    const a = simulate(spring.bouncy, 1 / 30, 0.4);
    const b = simulate(spring.bouncy, 1 / 240, 0.4);
    expect(a.x).toBeCloseTo(b.x, 2);
  });

  it('dépasse la cible avec le ressort rebond, pas avec le doux', () => {
    const peak = (cfg: SpringConfig) => {
      const s: SpringState = { x: 0, v: 0 };
      let max = 0;
      for (let i = 0; i < 200; i++) {
        stepSpring(s, 1, cfg, 1 / 120);
        max = Math.max(max, s.x);
      }
      return max;
    };
    expect(peak(spring.bouncy)).toBeGreaterThan(1.05);
    expect(peak(spring.gentle)).toBeLessThan(1.06);
  });

  it('gère les régimes critique et sur-amorti', () => {
    const critical = { stiffness: 100, damping: 20, mass: 1 };
    const over = { stiffness: 100, damping: 60, mass: 1 };
    for (const cfg of [critical, over]) {
      const s: SpringState = { x: 0, v: 5 };
      for (let i = 0; i < 600; i++) stepSpring(s, 1, cfg, 1 / 60);
      expect(s.x).toBeCloseTo(1, 3);
    }
  });
});
