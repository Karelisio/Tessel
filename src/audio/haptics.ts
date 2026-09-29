import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import type { HapticKind } from '@/modes/types';

/**
 * Haptique légère, limitée en fréquence pour rester agréable pendant un glissé.
 * (Les primitives Android fines arriveront avec le plugin natif TesselNative.)
 */
export class HapticsEngine {
  enabled = true;
  private last = -Infinity;

  constructor(private readonly minInterval = 45) {}

  pulse(kind: HapticKind, nowMs: number): void {
    if (!this.enabled || nowMs - this.last < this.minInterval) return;
    this.last = nowMs;
    const style = kind === 'click' ? ImpactStyle.Medium : ImpactStyle.Light;
    void Haptics.impact({ style }).catch(() => undefined);
    // point de croix : une impulsion par fil (le second passe à ~240 ms)
    if (kind === 'double-tick') {
      setTimeout(() => {
        void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
      }, 240);
    }
  }

  success(): void {
    if (!this.enabled) return;
    void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
  }

  soft(): void {
    if (!this.enabled) return;
    void Haptics.selectionChanged().catch(() => undefined);
  }
}
