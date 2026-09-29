/** Gamme pentatonique majeure (demi-tons). */
const PENTATONIC = [0, 2, 4, 7, 9] as const;
/** Pas maximal avant de redescendre (deux octaves). */
const MAX_STEP = 10;

/** Demi-tons du n-ième pas d'une série montante, en aller-retour sur deux octaves. */
export function pentatonicStep(n: number): number {
  const period = MAX_STEP * 2;
  const k = ((n % period) + period) % period;
  const step = k <= MAX_STEP ? k : period - k;
  return 12 * Math.floor(step / PENTATONIC.length) + (PENTATONIC[step % PENTATONIC.length] ?? 0);
}

/**
 * Suit les poses rapprochées : chaque pose dans la fenêtre monte d'un degré,
 * une pause remet la série à zéro.
 */
export class Melody {
  private step = -1;
  private last = -Infinity;

  constructor(private readonly resetAfter = 0.45) {}

  next(time: number): number {
    this.step = time - this.last > this.resetAfter ? 0 : this.step + 1;
    this.last = time;
    return pentatonicStep(this.step);
  }
}
