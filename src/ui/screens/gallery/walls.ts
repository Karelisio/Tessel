import { useCallback, useState, type CSSProperties } from 'react';
import { t, type I18nText } from '@/i18n/text';
import type { UnlockKey } from '@/meta/catalog';
import { cloudTexture, fibreTexture, grainTexture, marbleTexture } from './textures';

/**
 * Murs de la galerie. Ce sont des illustrations (matières dessinées en CSS / SVG) : leurs couleurs
 * sont propres à chaque mur et ne suivent pas le thème de l'interface.
 */

interface Layer {
  image: string;
  size?: string;
  pos?: string;
  blend?: string;
}

export interface WallDef {
  id: string;
  key: UnlockKey;
  name: I18nText;
  /** Mur sombre : encre claire et lumière additive. */
  dark: boolean;
  color: string;
  /** Calques de la matière, fabriqués à la demande (les textures se calculent une seule fois). */
  layers: () => readonly Layer[];
}

// ---------------------------------------------------------------------------- petits outils SVG

function svg(w: number, h: number, body: string, stretch = false): string {
  const par = stretch ? ' preserveAspectRatio="none"' : '';
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(w)}" height="${String(h)}" viewBox="0 0 ${String(w)} ${String(h)}"${par}>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(doc)}")`;
}

/** Taille d'une tuile, mise à l'échelle par `--ws` (1 sur le mur, moins sur les aperçus). */
const rowH = (h: number): string => `100% calc(var(--ws, 1) * ${String(h)}px)`;
const colW = (w: number): string => `calc(var(--ws, 1) * ${String(w)}px) 100%`;
const px = (w: number, h: number): string =>
  `calc(var(--ws, 1) * ${String(w)}px) calc(var(--ws, 1) * ${String(h)}px)`;

/** Suite pseudo-aléatoire reproductible (les murs sont identiques d'un lancement à l'autre). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function stars(size: number, count: number, seed: number, big: number): string {
  const rand = rng(seed);
  let body = '';
  for (let i = 0; i < count; i++) {
    const x = (rand() * size).toFixed(1);
    const y = (rand() * size).toFixed(1);
    const r = (0.35 + rand() * big).toFixed(2);
    const a = (0.35 + rand() * 0.65).toFixed(2);
    body += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" fill-opacity="${a}"/>`;
    if (rand() > 0.86)
      body += `<path d="M${x} ${(Number(y) - 4).toFixed(1)}v8M${(Number(x) - 4).toFixed(1)} ${y}h8" stroke="#fff" stroke-opacity="0.45" stroke-width="0.6"/>`;
  }
  return svg(size, size, body);
}
function bricks(o: {
  w: number;
  h: number;
  fills: readonly string[];
  mortar: string;
  seed: number;
  gap?: number;
}): string {
  const rand = rng(o.seed);
  const gap = o.gap ?? 4;
  const bw = o.w / 2;
  const bh = o.h / 2;
  let body = `<rect width="${String(o.w)}" height="${String(o.h)}" fill="${o.mortar}"/>`;
  for (let row = 0; row < 2; row++) {
    const shift = row === 0 ? 0 : -bw / 2;
    for (let i = 0; i < 3; i++) {
      const fill = o.fills[Math.floor(rand() * o.fills.length)] ?? '#a55';
      const x = shift + i * bw + gap / 2;
      body += `<rect x="${x.toFixed(1)}" y="${String(row * bh + gap / 2)}" width="${String(bw - gap)}" height="${String(bh - gap)}" rx="2.5" fill="${fill}"/>`;
      body += `<rect x="${x.toFixed(1)}" y="${String(row * bh + gap / 2)}" width="${String(bw - gap)}" height="3" rx="1.5" fill="#fff" fill-opacity="0.13"/>`;
    }
  }
  return svg(o.w, o.h, body);
}

function flowers(): string {
  const petal = (cx: number, cy: number, r: number, rot: number) => {
    let s = '';
    for (let i = 0; i < 5; i++)
      s += `<ellipse cx="${String(cx)}" cy="${String(cy - r)}" rx="${String(r * 0.62)}" ry="${String(r * 0.9)}" transform="rotate(${String(rot + i * 72)} ${String(cx)} ${String(cy)})" fill="#e5a0ae" fill-opacity="0.92"/>`;
    return `${s}<circle cx="${String(cx)}" cy="${String(cy)}" r="${String(r * 0.42)}" fill="#f4cd78"/>`;
  };
  const leaf = (x: number, y: number, rot: number) =>
    `<path d="M0 0c7-9 17-9 22 0c-7 9-17 9-22 0z" transform="translate(${String(x)} ${String(y)}) rotate(${String(rot)})" fill="#a5c39d" fill-opacity="0.9"/>`;
  const body =
    `<rect width="140" height="140" fill="#f4e6d4"/>` +
    leaf(52, 46, 30) +
    leaf(24, 58, 150) +
    leaf(122, 116, 30) +
    leaf(92, 128, 150) +
    petal(35, 35, 13, 0) +
    petal(105, 105, 13, 36) +
    `<circle cx="105" cy="34" r="3.4" fill="#e5a0ae" fill-opacity="0.8"/><circle cx="35" cy="106" r="3.4" fill="#e5a0ae" fill-opacity="0.8"/>` +
    `<circle cx="70" cy="70" r="2" fill="#d9b48b" fill-opacity="0.6"/>`;
  return svg(140, 140, body);
}

function splatter(seed: number): string {
  const rand = rng(seed);
  const tones = ['#d9836f', '#e0b45f', '#7fa7c4', '#8fb58c', '#b98bb8'];
  let body = '';
  for (let i = 0; i < 14; i++) {
    const c = tones[Math.floor(rand() * tones.length)] ?? '#d98';
    body += `<circle cx="${(rand() * 360).toFixed(0)}" cy="${(rand() * 360).toFixed(0)}" r="${(0.8 + rand() * 2.4).toFixed(1)}" fill="${c}" fill-opacity="${(0.25 + rand() * 0.3).toFixed(2)}"/>`;
  }
  return svg(360, 360, body);
}

// ---------------------------------------------------------------------------- les murs

const multiply = 'multiply';
const soft = 'soft-light';

export const WALLS: readonly WallDef[] = [
  {
    id: 'platre',
    key: 'wall:platre',
    name: t('Plâtre', 'Plaster'),
    dark: false,
    color: '#f1eadf',
    layers: () => [
      { image: 'linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0) 40%)' },
      { image: cloudTexture([128, 104, 82], 0.3, 9, 3), size: px(520, 520), blend: multiply },
      { image: grainTexture([118, 98, 78], 0.13, 3), size: px(128, 128), blend: multiply },
    ],
  },
  {
    id: 'bois-clair',
    key: 'wall:bois-clair',
    name: t('Bois clair', 'Light wood'),
    dark: false,
    color: '#d9bb8f',
    layers: () => [
      {
        image:
          'repeating-linear-gradient(90deg, rgba(70,42,18,0.34) 0 2px, rgba(255,255,255,0.14) 2px 4px, transparent 4px calc(var(--ws, 1) * 68px))',
      },
      {
        image: svg(
          272,
          8,
          '<rect width="68" height="8" fill="#fff" fill-opacity="0.1"/><rect x="68" width="68" height="8" fill="#7a4a1e" fill-opacity="0.08"/><rect x="136" width="68" height="8" fill="#fff" fill-opacity="0.04"/><rect x="204" width="68" height="8" fill="#7a4a1e" fill-opacity="0.14"/>',
          true,
        ),
        size: colW(272),
      },
      {
        image: fibreTexture([100, 58, 22], 0.62, 5, { cellsX: 44, cellsY: 3 }),
        size: px(256, 256),
        blend: multiply,
      },
    ],
  },
  {
    id: 'brique',
    key: 'wall:brique',
    name: t('Brique', 'Brick'),
    dark: false,
    color: '#b25a40',
    layers: () => [
      { image: 'linear-gradient(180deg, rgba(255,235,210,0.12), rgba(0,0,0,0) 45%)' },
      { image: grainTexture([70, 30, 14], 0.5, 8), size: px(128, 128), blend: multiply },
      {
        image: bricks({
          w: 120,
          h: 64,
          fills: ['#b5583d', '#a94d37', '#c0654a', '#9f4936', '#b96246'],
          mortar: '#d7c8b6',
          seed: 12,
        }),
        size: px(120, 64),
      },
    ],
  },
  {
    id: 'beton',
    key: 'wall:beton',
    name: t('Béton ciré', 'Polished concrete'),
    dark: false,
    color: '#bcbdbd',
    layers: () => [
      {
        image: svg(
          280,
          280,
          '<path d="M279 0V280M0 279H280" stroke="#000" stroke-opacity="0.13" stroke-width="2" fill="none"/><path d="M280 0V280M0 280H280" stroke="#fff" stroke-opacity="0.22" stroke-width="1" fill="none" transform="translate(-1 -1)"/><circle cx="34" cy="34" r="3.4" fill="#000" fill-opacity="0.22"/><circle cx="246" cy="34" r="3.4" fill="#000" fill-opacity="0.22"/><circle cx="34" cy="246" r="3.4" fill="#000" fill-opacity="0.22"/><circle cx="246" cy="246" r="3.4" fill="#000" fill-opacity="0.22"/>',
        ),
        size: px(280, 280),
      },
      { image: cloudTexture([70, 72, 78], 0.3, 21, 4), size: px(560, 560), blend: multiply },
      { image: grainTexture([60, 60, 62], 0.38, 4), size: px(128, 128), blend: multiply },
    ],
  },
  {
    id: 'velours',
    key: 'wall:velours',
    name: t('Velours', 'Velvet'),
    dark: true,
    color: '#5b2040',
    layers: () => [
      {
        image:
          'linear-gradient(115deg, rgba(255,255,255,0) 15%, rgba(255,170,210,0.16) 42%, rgba(255,255,255,0) 68%)',
        size: rowH(1100),
      },
      { image: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, rgba(0,0,0,0.05) 1px 3px)' },
      { image: grainTexture([255, 205, 228], 0.5, 6), size: px(128, 128), blend: soft },
    ],
  },
  {
    id: 'lambris',
    key: 'wall:lambris',
    name: t('Lambris', 'Wood panelling'),
    dark: false,
    color: '#d5dbd0',
    layers: () => [
      {
        image: svg(
          170,
          300,
          '<rect x="22" y="26" width="126" height="248" rx="3" fill="#fff" fill-opacity="0.16" stroke="#000" stroke-opacity="0.2" stroke-width="2"/><rect x="23" y="27" width="124" height="246" rx="2.5" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="1.5" transform="translate(1.5 1.5)"/><rect x="40" y="44" width="90" height="212" rx="2" fill="#000" fill-opacity="0.045" stroke="#000" stroke-opacity="0.13" stroke-width="1.5"/>',
        ),
        size: px(170, 300),
      },
      { image: grainTexture([80, 86, 74], 0.4, 14), size: px(128, 128), blend: multiply },
    ],
  },
  {
    id: 'papier-peint',
    key: 'wall:papier-peint',
    name: t('Papier peint fleuri', 'Floral wallpaper'),
    dark: false,
    color: '#f4e6d4',
    layers: () => [
      { image: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(120,70,40,0.06))' },
      { image: flowers(), size: px(140, 140) },
      { image: grainTexture([110, 80, 56], 0.36, 17), size: px(128, 128), blend: multiply },
    ],
  },
  {
    id: 'ardoise',
    key: 'wall:ardoise',
    name: t('Ardoise', 'Slate'),
    dark: true,
    color: '#2b353a',
    layers: () => [
      { image: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.12))' },
      {
        image: fibreTexture([214, 226, 236], 0.55, 31, { cellsX: 9, cellsY: 2 }),
        size: px(300, 300),
        blend: soft,
      },
      { image: cloudTexture([214, 224, 232], 0.5, 12, 5), size: px(420, 420), blend: soft },
      { image: grainTexture([205, 218, 228], 0.8, 2), size: px(128, 128), blend: soft },
    ],
  },
  {
    id: 'nuit-etoilee',
    key: 'wall:nuit-etoilee',
    name: t('Nuit étoilée', 'Starry night'),
    dark: true,
    color: '#111842',
    layers: () => [
      { image: stars(300, 34, 5, 1.05), size: px(300, 300) },
      { image: stars(470, 20, 11, 1.7), size: px(470, 470) },
      { image: 'radial-gradient(60% 260px at 15% 12%, rgba(132,96,235,0.4), transparent)', size: rowH(1500) },
      {
        image: 'radial-gradient(55% 300px at 90% 46%, rgba(64,150,240,0.28), transparent)',
        size: rowH(1500),
      },
      { image: 'linear-gradient(180deg, #0a0f33 0%, #1f1a58 55%, #3a2668 100%)', size: rowH(1500) },
    ],
  },
  {
    id: 'marbre',
    key: 'wall:marbre',
    name: t('Marbre', 'Marble'),
    dark: false,
    color: '#eeece8',
    layers: () => [
      { image: 'linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0) 50%)' },
      { image: marbleTexture([86, 90, 104], 4), size: px(720, 720) },
      { image: marbleTexture([130, 132, 142], 19, 320), size: px(500, 500) },
    ],
  },
  {
    id: 'atelier',
    key: 'wall:atelier',
    name: t('Atelier d’artiste', 'Artist’s studio'),
    dark: false,
    color: '#eee8de',
    layers: () => [
      { image: splatter(7), size: px(360, 360) },
      {
        image: bricks({
          w: 130,
          h: 68,
          fills: ['#f7f3ec', '#f1ebe1', '#f4efe6', '#ece5d9'],
          mortar: '#d9d0c2',
          seed: 3,
          gap: 3.5,
        }),
        size: px(130, 68),
      },
      { image: grainTexture([100, 84, 66], 0.36, 23), size: px(128, 128), blend: multiply },
    ],
  },
  {
    id: 'musee',
    key: 'wall:musee',
    name: t('Salle de musée', 'Museum hall'),
    dark: true,
    color: '#2f493f',
    layers: () => [
      {
        image: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0) 30%, rgba(0,0,0,0.16))',
        size: rowH(1400),
      },
      {
        image:
          'repeating-linear-gradient(90deg, rgba(226,190,120,0.34) 0 1px, transparent 1px calc(var(--ws, 1) * 84px))',
        pos: '41px 0',
      },
      {
        image:
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 calc(var(--ws, 1) * 42px), transparent calc(var(--ws, 1) * 42px) calc(var(--ws, 1) * 84px))',
      },
      { image: grainTexture([225, 255, 238], 0.5, 27), size: px(128, 128), blend: soft },
    ],
  },
];

export const DEFAULT_WALL = 'wall:platre';

export function wallByKey(key: string | null | undefined): WallDef {
  return WALLS.find((w) => w.key === key) ?? (WALLS[0] as WallDef);
}

/** Style CSS d'un mur (`scale` : mise à l'échelle des motifs pour les aperçus). */
const styles = new Map<string, CSSProperties>();

export function wallStyle(w: WallDef, scale = 1): CSSProperties {
  const memo = `${w.id}/${String(scale)}`;
  const known = styles.get(memo);
  if (known) return known;
  const layers = w.layers();
  const style: CSSProperties = {
    backgroundColor: w.color,
    backgroundImage: layers.map((l) => l.image).join(', '),
    backgroundSize: layers.map((l) => l.size ?? 'auto').join(', '),
    backgroundPosition: layers.map((l) => l.pos ?? '0 0').join(', '),
    backgroundBlendMode: layers.map((l) => l.blend ?? 'normal').join(', '),
    ['--ws' as string]: scale,
  };
  styles.set(memo, style);
  return style;
}

// ---------------------------------------------------------------------------- choix mémorisé

const STORAGE_KEY = 'tessel.gallery.wall';

function readChoice(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_WALL;
  } catch {
    return DEFAULT_WALL;
  }
}

/** Mur choisi (mémorisé sur l'appareil) ; un mur encore verrouillé retombe sur le plâtre. */
export function useWallChoice(unlocked: ReadonlySet<string>): [WallDef, (key: string) => void] {
  const [saved, setSaved] = useState(readChoice);
  const choose = useCallback((key: string) => {
    setSaved(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // stockage indisponible : le choix vaut pour cette session
    }
  }, []);
  return [wallByKey(unlocked.has(saved) ? saved : DEFAULT_WALL), choose];
}
