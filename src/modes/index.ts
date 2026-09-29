import { diamondMode } from './diamond';
import { pixelMode } from './pixel';
import type { ModeDefinition, ModeId } from './types';

/** Modes disponibles (point de croix et mosaïque arrivent à l'étape suivante). */
export const MODES: Record<'pixel' | 'diamond', ModeDefinition> & Partial<Record<ModeId, ModeDefinition>> = {
  pixel: pixelMode,
  diamond: diamondMode,
};

/** Définition d'un mode (repli sur pixel si le mode n'est pas encore disponible). */
export function getMode(id: ModeId): ModeDefinition {
  return MODES[id] ?? pixelMode;
}
