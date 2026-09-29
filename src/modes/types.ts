import type { ModeGlsl } from '@/engine/shaders/common';

export type ModeId = 'pixel' | 'diamond' | 'crossstitch' | 'mosaic';

/** Type de retour haptique (mappé sur les primitives Android quand disponibles). */
export type HapticKind = 'tick-light' | 'tick' | 'click' | 'double-tick';

export interface ModeDefinition {
  readonly id: ModeId;
  readonly glsl: ModeGlsl;
  /** Durée de l'animation de pose (ms). */
  readonly placeDuration: number;
  /** Fraction de la pose où a lieu l'impact (retours son/haptique/particules). */
  readonly impactAt: number;
  /** Couleurs de fond (papier/toile et arrière-plan autour de la grille). */
  readonly paper: readonly [number, number, number];
  readonly backdrop: readonly [number, number, number];
  /** Couleur vue de loin d'une case vide : mélange papier → couleur cible. */
  readonly emptyTint: number;
  readonly sound: string;
  readonly haptic: HapticKind;
  /** Réagit à l'inclinaison du téléphone (reflets). */
  readonly usesLight: boolean;
}
