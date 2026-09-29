import type { SpringConfig } from '@/theme/motion/tokens';

/** État d'un ressort 1D. */
export interface SpringState {
  x: number;
  v: number;
}

const EPS = 1e-4;

/**
 * Avance un ressort amorti de `dt` secondes vers `target`, par la solution analytique
 * de l'oscillateur harmonique amorti : indépendant du pas de temps, donc stable à tout fps.
 */
export function stepSpring(s: SpringState, target: number, cfg: SpringConfig, dt: number): void {
  if (dt <= 0) return;
  const { stiffness: k, damping: c, mass: m } = cfg;
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  const x0 = s.x - target;
  const v0 = s.v;
  let x: number;
  let v: number;
  if (zeta < 1 - EPS) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zeta * w0 * dt);
    const cos = Math.cos(wd * dt);
    const sin = Math.sin(wd * dt);
    const b = (v0 + zeta * w0 * x0) / wd;
    x = e * (x0 * cos + b * sin);
    v = e * ((b * wd - zeta * w0 * x0) * cos - (x0 * wd + zeta * w0 * b) * sin);
  } else if (zeta > 1 + EPS) {
    const r = Math.sqrt(zeta * zeta - 1);
    const r1 = -w0 * (zeta - r);
    const r2 = -w0 * (zeta + r);
    const c1 = (v0 - r2 * x0) / (r1 - r2);
    const c2 = x0 - c1;
    const e1 = Math.exp(r1 * dt);
    const e2 = Math.exp(r2 * dt);
    x = c1 * e1 + c2 * e2;
    v = c1 * r1 * e1 + c2 * r2 * e2;
  } else {
    const e = Math.exp(-w0 * dt);
    const b = v0 + w0 * x0;
    x = (x0 + b * dt) * e;
    v = (b - w0 * (x0 + b * dt)) * e;
  }
  s.x = x + target;
  s.v = v;
}

/** Vrai si le ressort est pratiquement au repos sur sa cible. */
export function springAtRest(s: SpringState, target: number, precision = 1e-3): boolean {
  return Math.abs(s.x - target) < precision && Math.abs(s.v) < precision * 10;
}
