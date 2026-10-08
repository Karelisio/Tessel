import type { HapticKind } from '@/modes/types';
import { TesselNative, type Waveform } from '@/native/TesselNative';

/** Formes d'onde (ms, amplitude 0 à 255) : celles de @capacitor/haptics, gardées telles quelles. */
const LIGHT: Waveform = { timings: [0, 50], amplitudes: [0, 110] };
const MEDIUM: Waveform = { timings: [0, 43], amplitudes: [0, 180] };
const SUCCESS: Waveform = { timings: [0, 35, 65, 21], amplitudes: [0, 250, 0, 180] };

/**
 * Haptique légère, limitée en fréquence pour rester agréable pendant un glissé.
 * Les vibrations passent par TesselNative, classées « média » comme celles d'un jeu : sans ce
 * classement, Android les range dans le retour tactile et les coupe sur les téléphones où la
 * vibration au toucher est désactivée.
 */
export class HapticsEngine {
  enabled = true;
  private last = -Infinity;

  constructor(private readonly minInterval = 45) {}

  pulse(kind: HapticKind, nowMs: number): void {
    if (!this.enabled || nowMs - this.last < this.minInterval) return;
    this.last = nowMs;
    play(kind === 'click' ? MEDIUM : LIGHT);
    // point de croix : une impulsion par fil (le second passe à ~240 ms)
    if (kind === 'double-tick') {
      setTimeout(() => {
        if (this.enabled) play(LIGHT);
      }, 240);
    }
  }

  success(): void {
    if (this.enabled) play(SUCCESS);
  }

  /** Accusé d'un geste ponctuel : couleur choisie, annuler, rétablir, outil armé… */
  soft(): void {
    if (this.enabled) play(LIGHT);
  }
}

function play(waveform: Waveform): void {
  void TesselNative.vibrate(waveform).catch(() => undefined);
}
