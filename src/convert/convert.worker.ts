/// <reference lib="webworker" />
import { expose, transfer } from 'comlink';
import { convertPixels, type ConvertParams, type ConvertStats } from './pipeline';

export interface SourceInfo {
  width: number;
  height: number;
}

/** Résultat transférable (tableaux sans copie). */
export interface WorkerResult {
  width: number;
  height: number;
  /** RGB à plat, 3 octets par couleur. */
  palette: Uint8Array;
  cells: Uint8Array;
  stats: ConvertStats;
}

let source: { data: Uint8ClampedArray; width: number; height: number } | null = null;

const api = {
  /** Décode et réduit la photo (côté le plus long ≤ maxSide), puis la garde en mémoire pour les aperçus. */
  setSource(bitmap: ImageBitmap, maxSide: number): SourceInfo {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas indisponible');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    source = { data: ctx.getImageData(0, 0, width, height).data, width, height };
    return { width, height };
  },

  /** Variante sans décodage (pixels RGBA déjà prêts). */
  setPixels(data: Uint8ClampedArray, width: number, height: number): SourceInfo {
    source = { data, width, height };
    return { width, height };
  },

  convert(params: ConvertParams): WorkerResult {
    if (!source) throw new Error('Aucune image chargée');
    const { grid, stats } = convertPixels(source.data, source.width, source.height, params);
    const palette = new Uint8Array(grid.palette.length * 3);
    grid.palette.forEach(([r, g, b], i) => {
      palette.set([r, g, b], i * 3);
    });
    const cells = grid.cells.slice();
    return transfer({ width: grid.width, height: grid.height, palette, cells, stats }, [
      palette.buffer,
      cells.buffer,
    ]);
  },

  clear(): void {
    source = null;
  },
};

export type ConvertWorkerApi = typeof api;

expose(api);
