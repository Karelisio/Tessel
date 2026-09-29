/**
 * Chronologie de la cinématique de fin d'œuvre (secondes depuis le début).
 * Partagée entre le GLSL (effets par uniforms) et le TS (caméra, sons, particules, haptique).
 * Chaque segment reste dans la charte (≤ 450 ms de montée), l'ensemble s'enchaîne sans blocage.
 */
export const FINALE = {
  /** Vol de caméra vers la vue encadrée. */
  cameraStart: 0,
  /** Balayage de lumière diagonal. */
  sweepStart: 0.55,
  sweepDuration: 1.1,
  /** Effet propre au mode (cascade, toile tendue, joints) : onde depuis le centre. */
  effectStart: 0.7,
  effectSpread: 1.2,
  effectCell: 0.45,
  /** Construction du cadre autour de l'œuvre. */
  matStart: 1.7,
  frameStart: 1.9,
  frameDuration: 1.2,
  /** Fin : la main est rendue au joueur. */
  done: 3.4,
} as const;

/** Place prise par le passe-partout et le cadre, en fraction de la plus grande dimension de la grille. */
export const FRAME_RATIO = { mat: 0.035, frame: 0.075 } as const;

export const FrameStyle = { White: 0, Gold: 1, Oak: 2, Slate: 3 } as const;
export type FrameStyle = (typeof FrameStyle)[keyof typeof FrameStyle];

export function finaleGlslConstants(): string {
  const f = (n: number) => n.toFixed(3);
  return `
const float F_SWEEP_START = ${f(FINALE.sweepStart)};
const float F_SWEEP_DUR = ${f(FINALE.sweepDuration)};
const float F_EFFECT_START = ${f(FINALE.effectStart)};
const float F_EFFECT_SPREAD = ${f(FINALE.effectSpread)};
const float F_EFFECT_CELL = ${f(FINALE.effectCell)};
const float F_MAT_START = ${f(FINALE.matStart)};
const float F_FRAME_START = ${f(FINALE.frameStart)};
const float F_FRAME_DUR = ${f(FINALE.frameDuration)};
const float F_MAT_RATIO = ${f(FRAME_RATIO.mat)};
const float F_FRAME_RATIO = ${f(FRAME_RATIO.frame)};
`;
}
