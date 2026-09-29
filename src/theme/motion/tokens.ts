/**
 * Charte de mouvement centralisée. Toute animation (UI Framer Motion ou canvas Pixi)
 * puise ses durées, courbes, ressorts et décalages ici.
 */

/** Durées en millisecondes (plage 120–450 ms). */
export const duration = {
  xs: 120, // tap, press, fondus « réduire les animations »
  sm: 180, // chips, interrupteurs, icônes
  md: 240, // pose de case, cartes
  lg: 320, // bottom sheets, transitions d'écran
  xl: 450, // shared element, révélations
} as const;

export type CubicBezier = readonly [number, number, number, number];

/** Courbes (cubic-bezier). */
export const easing = {
  standard: [0.2, 0, 0, 1],
  decelerate: [0.05, 0.7, 0.1, 1],
  accelerate: [0.3, 0, 0.8, 0.15],
  /** Léger dépassement (~5 %) puis stabilisation. */
  settle: [0.34, 1.36, 0.64, 1],
} as const satisfies Record<string, CubicBezier>;

export interface SpringConfig {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
}

/** Ressorts partagés entre Framer Motion et le moteur Pixi. */
export const spring = {
  gentle: { stiffness: 170, damping: 26, mass: 1 },
  snappy: { stiffness: 420, damping: 32, mass: 1 },
  bouncy: { stiffness: 320, damping: 14, mass: 1 },
  sheet: { stiffness: 260, damping: 30, mass: 1 },
  camera: { stiffness: 200, damping: 28, mass: 1 },
} as const satisfies Record<string, SpringConfig>;

/** Décalages (stagger) en millisecondes. */
export const stagger = {
  card: 30,
  cardMaxTotal: 300,
  /** Délai par unité de distance (en cases) pour les vagues sur la grille. */
  gridWavePerCell: 6,
  gridWaveMax: 600,
  confetti: 8,
} as const;

/** Délai d'un élément d'une liste en cascade, plafonné. */
export function staggerDelay(
  index: number,
  step: number = stagger.card,
  maxTotal: number = stagger.cardMaxTotal,
): number {
  return Math.min(Math.max(0, index) * step, maxTotal);
}
