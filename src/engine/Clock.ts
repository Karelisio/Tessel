/** Horloge injectable : temps réel en jeu, pas fixe pour les tests et la capture vidéo. */
export interface Clock {
  /** Millisecondes. */
  now(): number;
}

export const realClock: Clock = { now: () => performance.now() };

export class ManualClock implements Clock {
  constructor(private t = 0) {}

  now(): number {
    return this.t;
  }

  advance(ms: number): void {
    this.t += ms;
  }
}
