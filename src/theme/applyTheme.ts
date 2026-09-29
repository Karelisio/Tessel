import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { oklch } from '@/content/palettes';
import { TesselNative, type TonalPalettes } from '@/native/TesselNative';
import type { ThemeId } from '@/store/settings';

/** Indices des tons fournis par Android : 0, 10, 50, 100, 200 … 900, 1000. */
const TONES = [0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] as const;
type Tone = (typeof TONES)[number];

const hex = (argb: number) => `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`;

/** Palettes tonales de repli (web, Android < 12) : lavande douce, calculées en OKLCh. */
export function fallbackPalettes(seedHue = 310): TonalPalettes {
  const make = (hue: number, chroma: number) =>
    TONES.map((tone) => {
      const L = 1 - tone / 1000;
      const [r, g, b] = oklch(
        Math.min(0.995, Math.max(0, L * 0.98 + 0.01)),
        chroma * Math.sin(Math.PI * L),
        hue,
      );
      return (0xff << 24) | (r << 16) | (g << 8) | b;
    });
  return {
    accent1: make(seedHue, 0.16),
    accent2: make(seedHue + 20, 0.07),
    accent3: make(seedHue + 90, 0.12),
    neutral1: make(seedHue, 0.012),
    neutral2: make(seedHue, 0.03),
  };
}

/** Jetons Material 3 (schéma clair ou sombre) à partir des palettes tonales. */
export function materialTokens(p: TonalPalettes, dark: boolean): Record<string, string> {
  const t = (pal: number[], tone: Tone) => hex(pal[TONES.indexOf(tone)] ?? 0);
  if (dark)
    return {
      '--bg': t(p.neutral1, 900),
      '--surface': t(p.neutral1, 900),
      '--surface-2': t(p.neutral2, 800),
      '--surface-3': t(p.neutral2, 700),
      '--on-surface': t(p.neutral1, 100),
      '--on-surface-muted': t(p.neutral2, 200),
      '--primary': t(p.accent1, 200),
      '--on-primary': t(p.accent1, 800),
      '--primary-container': t(p.accent1, 700),
      '--on-primary-container': t(p.accent1, 100),
      '--secondary-container': t(p.accent2, 700),
      '--on-secondary-container': t(p.accent2, 100),
      '--tertiary': t(p.accent3, 200),
      '--canvas-bg': t(p.neutral1, 900),
      '--glow-a': t(p.accent1, 800),
      '--glow-b': t(p.accent2, 800),
      '--glow-c': t(p.accent3, 800),
    };
  return {
    '--bg': t(p.neutral1, 50),
    '--surface': t(p.neutral1, 10),
    '--surface-2': t(p.neutral1, 0),
    '--surface-3': t(p.neutral2, 100),
    '--on-surface': t(p.neutral1, 900),
    '--on-surface-muted': t(p.neutral2, 600),
    '--primary': t(p.accent1, 600),
    '--on-primary': t(p.accent1, 0),
    '--primary-container': t(p.accent1, 100),
    '--on-primary-container': t(p.accent1, 900),
    '--secondary-container': t(p.accent2, 100),
    '--on-secondary-container': t(p.accent2, 900),
    '--tertiary': t(p.accent3, 600),
    '--canvas-bg': t(p.neutral2, 50),
    '--glow-a': t(p.accent1, 100),
    '--glow-b': t(p.accent2, 100),
    '--glow-c': t(p.accent3, 100),
  };
}

let materialPalettes: TonalPalettes | null = null;
const applied = new Set<string>();

async function palettes(): Promise<TonalPalettes> {
  if (materialPalettes) return materialPalettes;
  try {
    const r = await TesselNative.getDynamicColors();
    materialPalettes = r.available && r.palettes ? r.palettes : fallbackPalettes();
  } catch {
    materialPalettes = fallbackPalettes();
  }
  return materialPalettes;
}

export const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

/**
 * Applique le thème à tout le document (jetons CSS, barre d'état). Le thème Material You suit
 * les couleurs et le mode sombre du téléphone ; les œuvres gardent toujours leurs vraies couleurs.
 */
export async function applyTheme(theme: ThemeId, highContrast: boolean): Promise<void> {
  const root = document.documentElement;
  for (const k of applied) root.style.removeProperty(k);
  applied.clear();
  root.dataset.contrast = highContrast ? 'high' : 'normal';
  let dark = theme === 'sombre';
  if (theme === 'material') {
    dark = systemDark();
    const tokens = materialTokens(await palettes(), dark);
    root.dataset.theme = dark ? 'sombre' : 'doux';
    for (const [k, v] of Object.entries(tokens)) {
      root.style.setProperty(k, v);
      applied.add(k);
    }
  } else root.dataset.theme = theme;
  window.dispatchEvent(new Event('tessel-theme'));
  if (!Capacitor.isNativePlatform()) return;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
  await StatusBar.setBackgroundColor({ color: bg }).catch(() => undefined);
}

/** Couleur d'un jeton CSS du thème courant (moteur de rendu, canvas). */
export function themeColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
