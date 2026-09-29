import type { ModeId } from './types';

type Rgb01 = readonly [number, number, number];

/** Matière d'un mode (clé `texture:…` du catalogue) : variante du shader et couleur du support. */
export interface TextureSpec {
  readonly key: `texture:${string}`;
  readonly mode: ModeId;
  /** Branche du shader du mode (0 = matière de base). */
  readonly variant: number;
  /** Support (papier, toile) propre à la matière ; celui du mode sinon. */
  readonly paper?: Rgb01;
}

const T = (key: `texture:${string}`, mode: ModeId, variant: number, paper?: Rgb01): TextureSpec =>
  paper ? { key, mode, variant, paper } : { key, mode, variant };

export const TEXTURES: readonly TextureSpec[] = [
  T('texture:pixel-lisse', 'pixel', 0),
  T('texture:pixel-aquarelle', 'pixel', 1, [0.975, 0.966, 0.945]),
  T('texture:pixel-kraft', 'pixel', 2, [0.83, 0.73, 0.58]),
  T('texture:pixel-carnet', 'pixel', 3, [0.99, 0.988, 0.982]),
  T('texture:pixel-toile', 'pixel', 4, [0.95, 0.935, 0.895]),
  T('texture:diamond-rond', 'diamond', 0),
  T('texture:diamond-carre', 'diamond', 1),
  T('texture:diamond-aurore', 'diamond', 2),
  T('texture:crossstitch-blanc', 'crossstitch', 0, [0.968, 0.958, 0.938]),
  T('texture:crossstitch-ecru', 'crossstitch', 1, [0.935, 0.9, 0.83]),
  T('texture:crossstitch-lin', 'crossstitch', 2, [0.85, 0.79, 0.69]),
  T('texture:crossstitch-noir', 'crossstitch', 3, [0.14, 0.13, 0.14]),
  T('texture:crossstitch-bleu-nuit', 'crossstitch', 4, [0.13, 0.17, 0.3]),
  T('texture:crossstitch-rose', 'crossstitch', 5, [0.96, 0.87, 0.88]),
  T('texture:mosaic-pierre', 'mosaic', 0),
  T('texture:mosaic-verre', 'mosaic', 1),
  T('texture:mosaic-ceramique', 'mosaic', 2),
  T('texture:mosaic-marbre', 'mosaic', 3),
  T('texture:mosaic-smalt', 'mosaic', 4),
];

export function texturesOf(mode: ModeId): TextureSpec[] {
  return TEXTURES.filter((t) => t.mode === mode);
}

/** Matière utilisée : celle choisie si elle appartient bien au mode, sinon la première (de base). */
export function textureSpec(mode: ModeId, key: string | null | undefined): TextureSpec {
  const all = texturesOf(mode);
  return all.find((t) => t.key === key) ?? all[0] ?? T('texture:none', mode, 0);
}
