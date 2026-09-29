import { Motion } from '@capacitor/motion';
import type { PluginListenerHandle } from '@capacitor/core';
import { stepSpring, type SpringState } from '@/fx/spring';

const BASE: readonly [number, number, number] = [-0.32, -0.42, 0.85];
const SMOOTH = { stiffness: 60, damping: 14, mass: 1 };
const BASELINE_TAU = 2.5; // s : la position de repos suit lentement la façon de tenir le téléphone

/**
 * Direction de lumière dérivée de l'inclinaison du téléphone (gyroscope / orientation).
 * Réagit aux variations autour de la position de tenue ; dérive lentement sans capteur.
 */
export class Tilt {
  readonly light: [number, number, number] = [...BASE];
  private beta = 0;
  private gamma = 0;
  private baseBeta = 0;
  private baseGamma = 0;
  private hasSensor = false;
  private initialized = false;
  private readonly sx: SpringState = { x: 0, v: 0 };
  private readonly sy: SpringState = { x: 0, v: 0 };
  private handle: PluginListenerHandle | null = null;
  private idleT = 0;

  async start(): Promise<void> {
    try {
      this.handle = await Motion.addListener('orientation', (e) => {
        this.beta = e.beta;
        this.gamma = e.gamma;
        if (!this.initialized) {
          this.baseBeta = e.beta;
          this.baseGamma = e.gamma;
          this.initialized = true;
        }
        this.hasSensor = true;
      });
    } catch {
      this.hasSensor = false;
    }
  }

  stop(): void {
    void this.handle?.remove();
    this.handle = null;
  }

  /** Avance le lissage ; renvoie true si la lumière a changé de façon visible. */
  update(dt: number, animateIdle: boolean): boolean {
    let tx: number;
    let ty: number;
    if (this.hasSensor) {
      const k = 1 - Math.exp(-dt / BASELINE_TAU);
      this.baseBeta += (this.beta - this.baseBeta) * k;
      this.baseGamma += (this.gamma - this.baseGamma) * k;
      tx = Math.max(-1, Math.min(1, (this.gamma - this.baseGamma) / 30));
      ty = Math.max(-1, Math.min(1, (this.beta - this.baseBeta) / 30));
    } else if (animateIdle) {
      this.idleT += dt;
      tx = 0.35 * Math.sin(this.idleT * 0.45);
      ty = 0.25 * Math.cos(this.idleT * 0.31);
    } else {
      tx = 0;
      ty = 0;
    }
    stepSpring(this.sx, tx, SMOOTH, dt);
    stepSpring(this.sy, ty, SMOOTH, dt);
    const x = BASE[0] + this.sx.x * 0.75;
    const y = BASE[1] + this.sy.x * 0.75;
    const len = Math.hypot(x, y, BASE[2]);
    const nx = x / len;
    const ny = y / len;
    const nz = BASE[2] / len;
    const changed = Math.abs(nx - this.light[0]) + Math.abs(ny - this.light[1]) > 0.0015;
    this.light[0] = nx;
    this.light[1] = ny;
    this.light[2] = nz;
    return changed;
  }
}
