import { FrameStyle } from '@/fx/finaleTimeline';

/** Matière d'un cadre (branche du shader `frameLayer`). */
export const FrameMaterial = {
  /** Bois peint, mat. */
  Paint: 0,
  /** Métal : reflets marqués ; `param` = poli (1) ou brossé (0). */
  Metal: 1,
  /** Bois veiné : `accent` = couleur des veines. */
  Wood: 2,
  /** Pierre : `accent` = veines ; `param` = brillance. */
  Stone: 3,
  /** Laque brillante. */
  Lacquer: 4,
  /** Nacre irisée. */
  Pearl: 5,
  /** Dégradé de teintes qui fait le tour du cadre (aurore, prisme). */
  Rainbow: 6,
  /** Métal orné de perles le long de la moulure ; `param` = densité des perles. */
  Ornate: 7,
  /** Cadre peint décoré d'un motif répété ; `param` = motif (voir `FrameMotif`). */
  Motif: 8,
} as const;
export type FrameMaterial = (typeof FrameMaterial)[keyof typeof FrameMaterial];

export const FrameMotif = { Dots: 0, Hearts: 1, Flowers: 2, Shells: 3, Stars: 4, Leaves: 5 } as const;

type Rgb01 = readonly [number, number, number];

export interface FrameSpec {
  readonly material: FrameMaterial;
  readonly base: Rgb01;
  readonly accent: Rgb01;
  readonly param: number;
}

const hex = (h: string): Rgb01 => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const spec = (material: FrameMaterial, base: string, accent = base, param = 0): FrameSpec => ({
  material,
  base: hex(base),
  accent: hex(accent),
  param,
});

const M = FrameMaterial;

/** Tous les cadres du catalogue (`frame:<id>`). */
export const FRAMES: Readonly<Record<string, FrameSpec>> = {
  'frame:blanc': spec(M.Paint, '#f3f1ed'),
  'frame:or': spec(M.Metal, '#dcae57', '#fff0c0', 1),
  'frame:chene': spec(M.Wood, '#c49a6c', '#a57c52'),
  'frame:ardoise': spec(M.Stone, '#474b52', '#5b6068', 0.2),
  'frame:noyer': spec(M.Wood, '#6b4a33', '#4f3423'),
  'frame:argent': spec(M.Metal, '#c9ccd2', '#ffffff', 1),
  'frame:rose-poudre': spec(M.Paint, '#e9c3c4'),
  'frame:bambou': spec(M.Wood, '#d7c08a', '#b89c5e', 1),
  'frame:cuivre': spec(M.Metal, '#c47a4e', '#ffd2b0', 0.6),
  'frame:laque-noire': spec(M.Lacquer, '#1d1b1f', '#ffffff'),
  'frame:menthe': spec(M.Paint, '#bfe0cf'),
  'frame:baroque': spec(M.Ornate, '#d4a64e', '#fff0c0', 14),
  'frame:chene-blanchi': spec(M.Wood, '#e2d6c4', '#cbbba4'),
  'frame:ivoire': spec(M.Paint, '#f4ecd8'),
  'frame:terracotta': spec(M.Paint, '#c8795a'),
  'frame:emeraude': spec(M.Lacquer, '#1f6b52', '#bfffe4'),
  'frame:nacre': spec(M.Pearl, '#eee9f1', '#cfe8ef'),
  'frame:ebene': spec(M.Wood, '#2b2320', '#3d322d'),
  'frame:lavande': spec(M.Paint, '#c9bde3'),
  'frame:bronze': spec(M.Metal, '#9c7443', '#e6c38e', 0.3),
  'frame:corail': spec(M.Lacquer, '#ef8a78', '#ffe2da'),
  'frame:or-rose': spec(M.Metal, '#e2a996', '#fff0ea', 1),
  'frame:marbre': spec(M.Stone, '#eeebe6', '#9d9a97', 0.7),
  'frame:saphir': spec(M.Lacquer, '#23407e', '#c6d8ff'),
  'frame:cerisier': spec(M.Wood, '#9c4f3a', '#7a3a29'),
  'frame:champagne': spec(M.Metal, '#e5d3a8', '#fffaf0', 0.5),
  'frame:obsidienne': spec(M.Stone, '#17161a', '#3b3445', 1),
  'frame:aurore': spec(M.Rainbow, '#7fe0c3', '#b38bf0', 0.6),
  'frame:flamme': spec(M.Rainbow, '#ffcf5a', '#e2553d', 0.25),
  'frame:constellation': spec(M.Motif, '#1d2445', '#ffe9a8', 4),
  'frame:jubile': spec(M.Ornate, '#e6c46c', '#fff6d0', 22),
  'frame:centenaire': spec(M.Ornate, '#c9ccd2', '#ffffff', 18),
  'frame:millier': spec(M.Pearl, '#f1e3c1', '#e9c6ee'),
  'frame:prisme': spec(M.Rainbow, '#ff9aa2', '#9ad0ff', 1),
  'frame:nouvel-an': spec(M.Motif, '#2a2440', '#f5c96b', 0),
  'frame:saint-valentin': spec(M.Motif, '#f4c7cf', '#d9475f', 1),
  'frame:printemps': spec(M.Motif, '#cfe6bf', '#f29bb2', 2),
  'frame:ete': spec(M.Motif, '#bfe3ea', '#f6e1c6', 3),
  'frame:halloween': spec(M.Motif, '#3a2b3e', '#f08a2c', 5),
  'frame:noel': spec(M.Motif, '#2f5a44', '#f4f1ea', 4),
};

/** Cadre par défaut de chaque style de mode (cinématique de fin sans choix du joueur). */
const DEFAULT_BY_STYLE: Readonly<Record<FrameStyle, string>> = {
  [FrameStyle.White]: 'frame:blanc',
  [FrameStyle.Gold]: 'frame:or',
  [FrameStyle.Oak]: 'frame:chene',
  [FrameStyle.Slate]: 'frame:ardoise',
};

export function defaultFrameKey(style: FrameStyle): string {
  return DEFAULT_BY_STYLE[style];
}

/** Cadre à utiliser : celui choisi s'il existe, sinon celui du mode. */
export function frameSpec(key: string | null | undefined, style: FrameStyle): FrameSpec {
  return (key ? FRAMES[key] : undefined) ?? FRAMES[defaultFrameKey(style)] ?? spec(M.Paint, '#f3f1ed');
}
