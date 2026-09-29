import { crossStitchMode } from './crossstitch';
import { diamondMode } from './diamond';
import { mosaicMode } from './mosaic';
import { pixelMode } from './pixel';
import type { ModeDefinition, ModeId } from './types';

export const MODES: Record<ModeId, ModeDefinition> = {
  pixel: pixelMode,
  diamond: diamondMode,
  crossstitch: crossStitchMode,
  mosaic: mosaicMode,
};

export function getMode(id: ModeId): ModeDefinition {
  return MODES[id];
}
