import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getServices } from '@/app/services';
import type { Bitset } from '@/content/progress';
import type { Grid } from '@/content/grid';
import { TRANSPARENT } from '@/content/grid';
import { getMode } from '@/modes';
import { useSettings } from '@/store/settings';
import type { ModeId } from '@/modes/types';
import { TesselNative, type WallpaperTarget } from '@/native/TesselNative';
import { ArtworkRenderer, type RenderOptions } from './ArtworkRenderer';

/** Tout ce qu'il faut pour rendre une partie hors écran. */
export interface Artwork {
  projectId: string;
  title: string;
  mode: ModeId;
  grid: Grid;
  filled: Bitset;
  /** Ordre des poses (timelapse). */
  history: readonly number[];
  frame: string | null;
  updatedAt: number;
  completed: boolean;
}

export async function loadArtwork(projectId: string): Promise<Artwork> {
  const { store } = await getServices();
  const p = await store.load(projectId);
  return {
    projectId,
    title: p.meta.title ?? 'Tessel',
    mode: p.meta.mode,
    grid: p.grid,
    filled: p.filled,
    history: p.history,
    frame: p.meta.frame,
    updatedAt: p.meta.updatedAt,
    completed: p.meta.completedAt !== null,
  };
}

export interface ImageOptions {
  /** Plus grand côté (px). */
  size: number;
  framed?: boolean;
  /** Cadre (`frame:…`) ; celui de la partie par défaut. */
  frame?: string | null;
  transparent?: boolean;
  background?: RenderOptions['background'];
}

/** Image de l'œuvre (état actuel de la partie), rendue avec les shaders du jeu. */
export async function renderArtwork(a: Artwork, opts: ImageOptions): Promise<HTMLCanvasElement> {
  const r = await ArtworkRenderer.get();
  return r.render({
    grid: a.grid,
    mode: getMode(a.mode),
    texture: useSettings.getState().textures[a.mode] ?? null,
    filled: a.filled,
    framed: opts.framed ?? true,
    frame: opts.frame === undefined ? a.frame : opts.frame,
    size: opts.size,
    ...(opts.transparent !== undefined && { transparent: opts.transparent }),
    ...(opts.background && { background: opts.background }),
  });
}

export function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Image impossible à encoder'));
      },
      type,
      quality,
    );
  });
}

// ---------------------------------------------------------------- miniatures de galerie

const THUMB_CACHE = 'tessel-renders-v1';
const memory = new Map<string, string>();

/**
 * Miniature encadrée et détourée d'une partie (mur de galerie), mise en cache (mémoire + Cache Storage)
 * tant que la partie et son cadre ne changent pas. Renvoie une URL d'objet.
 */
export async function artworkThumb(
  projectId: string,
  opts: { size?: number; frame?: string | null } = {},
): Promise<string> {
  const size = opts.size ?? 480;
  const a = await loadArtwork(projectId);
  const frame = opts.frame === undefined ? a.frame : opts.frame;
  const key = `https://tessel.local/thumb/${projectId}/${String(a.updatedAt)}/${frame ?? 'mode'}/${String(size)}`;
  const hit = memory.get(key);
  if (hit) return hit;
  let blob: Blob | undefined;
  const cache = await caches.open(THUMB_CACHE).catch(() => null);
  const cached = await cache?.match(key);
  if (cached) blob = await cached.blob();
  if (!blob) {
    blob = await canvasBlob(await renderArtwork(a, { size, frame, transparent: true }));
    await cache
      ?.put(key, new Response(blob, { headers: { 'content-type': 'image/png' } }))
      .catch(() => undefined);
  }
  const url = URL.createObjectURL(blob);
  memory.set(key, url);
  return url;
}

// ---------------------------------------------------------------- fond d'écran

/** Couleur moyenne pondérée des cases (fond des compositions). */
function dominant(grid: Grid): [number, number, number] {
  const counts = new Array<number>(grid.palette.length).fill(0);
  for (const c of grid.cells) if (c !== TRANSPARENT) counts[c] = (counts[c] ?? 0) + 1;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  grid.palette.forEach(([pr, pg, pb], i) => {
    const k = counts[i] ?? 0;
    r += pr * k;
    g += pg * k;
    b += pb * k;
    n += k;
  });
  return n > 0 ? [r / n, g / n, b / n] : [230, 225, 220];
}

/**
 * Fond d'écran au format du téléphone : l'œuvre encadrée au centre (un peu au-dessus, pour l'horloge),
 * sur un fond flou tiré de l'œuvre elle-même.
 */
export async function renderWallpaper(
  a: Artwork,
  opts: { width: number; height: number; frame?: string | null },
): Promise<HTMLCanvasElement> {
  const { width, height } = opts;
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  const [dr, dg, db] = dominant(a.grid);
  ctx.fillStyle = `rgb(${String(dr)}, ${String(dg)}, ${String(db)})`;
  ctx.fillRect(0, 0, width, height);
  // fond : l'œuvre agrandie et floutée, voilée de lumière
  const plain = await renderArtwork(a, { size: 256, framed: false });
  const cover = Math.max(width / plain.width, height / plain.height) * 1.15;
  ctx.filter = `blur(${String(Math.round(width / 18))}px) saturate(1.15)`;
  ctx.drawImage(
    plain,
    (width - plain.width * cover) / 2,
    (height - plain.height * cover) / 2,
    plain.width * cover,
    plain.height * cover,
  );
  ctx.filter = 'none';
  const veil = ctx.createLinearGradient(0, 0, 0, height);
  veil.addColorStop(0, 'rgba(255,255,255,0.28)');
  veil.addColorStop(1, 'rgba(255,255,255,0.12)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, width, height);
  // l'œuvre encadrée
  const side = Math.round(Math.min(width * 0.82, height * 0.5));
  const art = await renderArtwork(a, {
    size: side,
    ...(opts.frame !== undefined && { frame: opts.frame }),
    transparent: true,
  });
  ctx.drawImage(art, (width - art.width) / 2, height * 0.47 - art.height / 2);
  return out;
}

/** Taille d'écran du téléphone en pixels physiques (fond d'écran net). */
export function screenPixels(): { width: number; height: number } {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  return {
    width: Math.round(window.screen.width * dpr),
    height: Math.round(window.screen.height * dpr),
  };
}

// ---------------------------------------------------------------- fichiers, partage, galerie Android

async function blobBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  return btoa(s);
}

/** Nom de fichier sûr, à partir du titre de l'œuvre. */
export function fileName(title: string, ext: string): string {
  const base =
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'tessel';
  return `${base}.${ext}`;
}

/** Écrit un fichier temporaire (cache de l'app) et renvoie son URI `file://`. */
async function writeTemp(blob: Blob, name: string): Promise<string> {
  const path = `exports/${name}`;
  const res = await Filesystem.writeFile({
    path,
    data: await blobBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  });
  return res.uri;
}

/** Hors Android : téléchargement classique. */
function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}

const native = () => Capacitor.isNativePlatform();

/** Menu de partage Android. */
export async function shareFile(blob: Blob, name: string, text?: string): Promise<void> {
  if (!native()) {
    download(blob, name);
    return;
  }
  const uri = await writeTemp(blob, name);
  await Share.share({ files: [uri], ...(text !== undefined && { text }), dialogTitle: text ?? name });
}

/** Enregistre dans la galerie du téléphone (Images/Tessel, Films/Tessel). */
export async function saveToDevice(blob: Blob, name: string): Promise<void> {
  if (!native()) {
    download(blob, name);
    return;
  }
  const uri = await writeTemp(blob, name);
  await TesselNative.saveToGallery({ path: uri, mimeType: blob.type, displayName: name });
}

export async function setWallpaper(blob: Blob, target: WallpaperTarget): Promise<void> {
  const uri = await writeTemp(blob, `wallpaper-${String(Date.now())}.png`);
  await TesselNative.setWallpaper({ path: uri, target });
}
