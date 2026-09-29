import type { Rgb } from '@/content/grid';

const hex = (h: string): Rgb => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** Palette écrite en une chaîne de couleurs hexadécimales séparées par des espaces. */
const pal = (colors: string): readonly Rgb[] => colors.split(' ').map(hex);

/** Palettes de l'éditeur (clés `palette:…` du catalogue), 16 couleurs chacune. */
export const PALETTES: Readonly<Record<string, readonly Rgb[]>> = {
  'palette:classique': pal(
    '#1f1d24 #5b5a63 #a9a7ae #f7f5f2 #d8433b #f08a3a #f5c945 #7ab648 ' +
      '#2f8f5b #3fb6c8 #2e6fd0 #26367a #8a4fc7 #e57aa8 #8a5a3b #e9c29a',
  ),
  'palette:pastel': pal(
    '#fbf7f2 #f6d7d9 #f2b8c6 #e59bb0 #fbd8b5 #f7c38f #fbecae #dcecb4 ' +
      '#b9dfb9 #a9dcd0 #b7dcef #9fbde8 #c9c2ec #b1a1dc #d7c6b6 #8c8497',
  ),
  'palette:nature': pal(
    '#2b2a22 #4d4a36 #6f6a4a #a79c78 #e9e2c9 #3e5e2c #5a8a3a #8cb65a ' +
      '#c7d98b #6a4b2e #9a6b3f #c99a62 #6fa4c4 #a7cde0 #d9803e #b9453a',
  ),
  'palette:sepia': pal(
    '#1e150e #35261a #4e3826 #684b33 #825f41 #9c7451 #b48b63 #c9a37b ' +
      '#dbbd97 #e9d5b6 #f5ead6 #fbf6ec #6b3d27 #8e5433 #b07a4a #d3a86f',
  ),
  'palette:ocean': pal(
    '#071a2c #0d2f4d #12476e #1a6292 #2780b3 #3fa0cf #6bbfe0 #a5daed ' +
      '#dbf1f7 #0f5a5a #1f8a82 #4fb8a5 #96dcc6 #f4e3bd #f2a07b #fbf8f1',
  ),
  'palette:automne': pal(
    '#2a1a14 #4a2a1d #6e3a22 #9a4a24 #c35a26 #e07a33 #eea04c #f5c46e ' +
      '#f7e0a8 #7d7a2f #a39a44 #5e3b4a #8e4a57 #b86a5b #d9b99a #f8f0e3',
  ),
  'palette:neon': pal(
    '#0b0b14 #1c1c33 #ff2e88 #ff6ec7 #ff9f1c #ffe700 #b8ff28 #29ff8f ' +
      '#00f5d4 #00c2ff #2d7bff #7b2dff #c77dff #ff4d4d #e9e9ff #ffffff',
  ),
  'palette:bonbon': pal(
    '#fff6fb #ffd6e8 #ffadd2 #ff85b8 #ff5c9d #ffd8a8 #ffb86b #fff1a8 ' +
      '#c8f7c5 #8fe3b0 #b8ecff #80d0ff #d9c7ff #b69cff #8a5cf6 #5b3a8c',
  ),
  'palette:terre': pal(
    '#1f1611 #3a2a1f #56402e #735a41 #917557 #b29470 #cfb58f #e8d6b5 ' +
      '#8b3a26 #b04f2f #cf7545 #e59a63 #5b6b3a #83925a #a7a7a0 #f3ece0',
  ),
  'palette:nordique': pal(
    '#2e3440 #3b4252 #434c5e #4c566a #d8dee9 #e5e9f0 #eceff4 #8fbcbb ' +
      '#88c0d0 #81a1c1 #5e81ac #bf616a #d08770 #ebcb8b #a3be8c #b48ead',
  ),
  'palette:vintage': pal(
    '#2b2b33 #4b4a54 #7d7b83 #c9c3b5 #efe7d4 #9c3d3d #c8664e #e39e62 ' +
      '#e8c77b #8a9a5b #5d7a64 #4a6b7c #7a9bb3 #a57c9a #6d4c5b #b89a7a',
  ),
  'palette:aurore': pal(
    '#1b1440 #2c2366 #46348f #6a47b3 #9b62c8 #cf7ec9 #f29bc0 #ffbfae ' +
      '#ffdca8 #fff2c7 #3a2b58 #5e4a8a #8a7bc4 #b7b0e6 #e2def7 #fbf9ff',
  ),
  'palette:crepuscule': pal(
    '#120f24 #1f1a3d #2f2658 #44316f #613b82 #86448c #ad4d8a #d15e7f ' +
      '#ec7a70 #f6a066 #fbc66b #fde5a0 #27385e #3e5a86 #6b87b0 #f2eee8',
  ),
  'palette:pop': pal(
    '#111111 #ffffff #ff3b30 #ff9500 #ffcc00 #34c759 #00c7be #30b0ff ' +
      '#007aff #5856d6 #af52de #ff2d55 #a2845e #8e8e93 #ffd6e0 #c7f0ff',
  ),
  'palette:givre': pal(
    '#0f1b2d #1b2d47 #2b4466 #44628a #6886ad #93aecb #bdd1e3 #e1ebf4 ' +
      '#f7fbff #9fd3dd #6fb5c7 #c7c1e6 #a59ad1 #e8d5e9 #d3e8e2 #ffffff',
  ),
};

/** Palette de départ d'une nouvelle création. */
export const DEFAULT_PALETTE = 'palette:classique';

export function paletteColors(key: string): readonly Rgb[] {
  return PALETTES[key] ?? PALETTES[DEFAULT_PALETTE] ?? [];
}
