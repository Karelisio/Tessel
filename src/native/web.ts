import { WebPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import type {
  BuildInfo,
  DownloadProgressEvent,
  DownloadUpdateOptions,
  HapticPrimitive,
  SaveToGalleryOptions,
  TesselNativePlugin,
  TonalPalettes,
  WallpaperTarget,
  Waveform,
} from './TesselNative';

/** Durées (ms) de vibration navigateur approchant chaque primitive. */
const VIBRATION_MS: Record<HapticPrimitive, number> = {
  tick: 8,
  lowTick: 12,
  click: 15,
  thud: 25,
  spin: 20,
  quickRise: 18,
};

/**
 * Forme d'onde → motif de l'API Vibration du navigateur (vibration, pause, vibration…) : segments
 * consécutifs de même état fusionnés, durées nulles ignorées. Vide s'il n'y a rien à faire vibrer.
 */
export function vibrationPattern({ timings, amplitudes }: Waveform): number[] {
  const pattern: number[] = [];
  timings.forEach((ms, i) => {
    if (!(ms > 0)) return;
    const on = (amplitudes[i] ?? 0) > 0;
    if (pattern.length === 0 && !on) pattern.push(0);
    // rangs pairs : vibration, rangs impairs : pause
    const lastOn = pattern.length % 2 === 1;
    if (pattern.length > 0 && lastOn === on) pattern[pattern.length - 1] = (pattern.at(-1) ?? 0) + ms;
    else pattern.push(ms);
  });
  if (pattern.length % 2 === 0) pattern.pop();
  return pattern.some((ms, i) => i % 2 === 0 && ms > 0) ? pattern : [];
}

/** Repli navigateur : valeurs neutres, fonctions purement natives indisponibles. */
export class TesselNativeWeb extends WebPlugin implements TesselNativePlugin {
  getBuildInfo(): Promise<BuildInfo> {
    return Promise.resolve({ versionName: '0.0.0-web', versionCode: 0, sdkInt: 0 });
  }

  getDynamicColors(): Promise<{ available: boolean; palettes?: TonalPalettes }> {
    return Promise.resolve({ available: false });
  }

  haptic(options: { primitive: HapticPrimitive; scale?: number }): Promise<{ usedPrimitives: boolean }> {
    if (typeof navigator.vibrate === 'function') {
      const scale = Math.min(1, Math.max(0.2, options.scale ?? 1));
      navigator.vibrate(Math.max(5, Math.round(VIBRATION_MS[options.primitive] * scale)));
    }
    return Promise.resolve({ usedPrimitives: false });
  }

  vibrate(options: Waveform): Promise<{ played: boolean }> {
    const pattern = vibrationPattern(options);
    const played =
      typeof navigator.vibrate === 'function' && pattern.length > 0 && navigator.vibrate(pattern);
    return Promise.resolve({ played });
  }

  canInstallPackages(): Promise<{ allowed: boolean }> {
    return Promise.resolve({ allowed: false });
  }

  openInstallSettings(): Promise<void> {
    return Promise.reject(this.unavailable("Réglages d'installation indisponibles dans le navigateur."));
  }

  downloadUpdate(_options: DownloadUpdateOptions): Promise<{ path: string }> {
    return Promise.reject(this.unavailable('Téléchargement de mise à jour indisponible dans le navigateur.'));
  }

  cancelDownload(): Promise<void> {
    return Promise.resolve();
  }

  installApk(_options: { path: string }): Promise<void> {
    return Promise.reject(this.unavailable("Installation d'APK indisponible dans le navigateur."));
  }

  setWallpaper(_options: { path: string; target: WallpaperTarget }): Promise<void> {
    return Promise.reject(this.unavailable("Fond d'écran indisponible dans le navigateur."));
  }

  saveToGallery(_options: SaveToGalleryOptions): Promise<{ uri: string }> {
    return Promise.reject(this.unavailable('Enregistrement en galerie indisponible dans le navigateur.'));
  }

  // Redéfinition explicite pour typer l'événement de progression.
  override addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: DownloadProgressEvent) => void,
  ): Promise<PluginListenerHandle> {
    return super.addListener(eventName, listenerFunc);
  }
}
