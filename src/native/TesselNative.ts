import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

/** Primitives haptiques fines (Android 30+, repli automatique sur les anciennes versions). */
export type HapticPrimitive = 'tick' | 'lowTick' | 'click' | 'thud' | 'spin' | 'quickRise';

/**
 * 13 tons par palette (0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000),
 * en entiers ARGB non signés (0xAARRGGBB).
 */
export interface TonalPalettes {
  accent1: number[];
  accent2: number[];
  accent3: number[];
  neutral1: number[];
  neutral2: number[];
}

export interface BuildInfo {
  versionName: string;
  versionCode: number;
  sdkInt: number;
}

export interface DownloadUpdateOptions {
  url: string;
  fileName: string;
  /** Somme SHA-256 attendue, en hexadécimal (casse indifférente). */
  sha256: string;
  size?: number;
}

export interface DownloadProgressEvent {
  downloaded: number;
  total: number;
}

export type WallpaperTarget = 'home' | 'lock' | 'both';

export interface SaveToGalleryOptions {
  path: string;
  mimeType: string;
  displayName: string;
  album?: string;
}

/**
 * Codes d'erreur possibles de `downloadUpdate` :
 * `network`, `cancelled`, `checksum_mismatch`, `io`.
 * Les chemins (`path`) sont des chemins de fichier absolus ; le préfixe `file://` est toléré.
 */
export interface TesselNativePlugin {
  getBuildInfo(): Promise<BuildInfo>;
  getDynamicColors(): Promise<{ available: boolean; palettes?: TonalPalettes }>;
  haptic(options: { primitive: HapticPrimitive; scale?: number }): Promise<{ usedPrimitives: boolean }>;
  canInstallPackages(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadUpdate(options: DownloadUpdateOptions): Promise<{ path: string }>;
  cancelDownload(): Promise<void>;
  installApk(options: { path: string }): Promise<void>;
  setWallpaper(options: { path: string; target: WallpaperTarget }): Promise<void>;
  saveToGallery(options: SaveToGalleryOptions): Promise<{ uri: string }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: DownloadProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
}

export const TesselNative = registerPlugin<TesselNativePlugin>('TesselNative', {
  web: () => import('./web').then((m) => new m.TesselNativeWeb()),
});
