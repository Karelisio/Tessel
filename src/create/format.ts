import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import jsQR from 'jsqr';
import { encode } from 'uqr';
import type { Grid } from '@/content/grid';
import { decodeGrid, encodeGrid, fromBase64, toBase64 } from '@/db/codecs';

/** Œuvre échangée entre joueurs (.tessel ou QR code). */
export interface SharedArtwork {
  title: string;
  grid: Grid;
  createdAt: number;
}

export const TESSEL_MIME = 'application/x-tessel';
export const TESSEL_EXT = 'tessel';

interface TesselJson {
  format: 'tessel';
  version: 1;
  title: string;
  createdAt: number;
  /** Grille binaire (codecs.encodeGrid) en base64. */
  grid: string;
}

/** Fichier .tessel : JSON compressé (gzip). */
export function encodeTessel(a: SharedArtwork): Uint8Array {
  const json: TesselJson = {
    format: 'tessel',
    version: 1,
    title: a.title.slice(0, 80),
    createdAt: a.createdAt,
    grid: toBase64(encodeGrid(a.grid)),
  };
  return gzipSync(strToU8(JSON.stringify(json)), { level: 9 });
}

export function decodeTessel(bytes: Uint8Array): SharedArtwork {
  // gzip (0x1f 0x8b) ou JSON brut
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? strFromU8(gunzipSync(bytes)) : strFromU8(bytes);
  let json: Partial<TesselJson>;
  try {
    json = JSON.parse(text) as Partial<TesselJson>;
  } catch {
    throw new Error('Ce fichier n’est pas une œuvre Tessel');
  }
  if (json.format !== 'tessel' || typeof json.grid !== 'string')
    throw new Error('Ce fichier n’est pas une œuvre Tessel');
  if (json.version !== 1) throw new Error('Œuvre créée avec une version plus récente de Tessel');
  return {
    title:
      typeof json.title === 'string' && json.title.trim() ? json.title.trim().slice(0, 80) : 'Œuvre partagée',
    createdAt: typeof json.createdAt === 'number' ? json.createdAt : Date.now(),
    grid: decodeGrid(fromBase64(json.grid)),
  };
}

// ---------------------------------------------------------------- QR code

const QR_MAGIC = [0x54, 0x51, 0x31]; // "TQ1"
/** Capacité d'un QR version 40, correction L, en mode octets (marge de sécurité incluse). */
export const QR_MAX_BYTES = 2900;

/** Charge binaire compacte : magic, titre (u8 + UTF-8), grille binaire. */
export function encodeQrPayload(a: SharedArtwork): Uint8Array {
  let title = strToU8(a.title);
  if (title.length > 60) title = strToU8(a.title.slice(0, 40));
  const grid = encodeGrid(a.grid);
  const out = new Uint8Array(3 + 1 + title.length + grid.length);
  out.set(QR_MAGIC, 0);
  out[3] = title.length;
  out.set(title, 4);
  out.set(grid, 4 + title.length);
  return out;
}

export function decodeQrPayload(bytes: Uint8Array): SharedArtwork {
  if (bytes.length < 5 || QR_MAGIC.some((b, i) => bytes[i] !== b))
    throw new Error('Ce QR code n’est pas une œuvre Tessel');
  const n = bytes[3] ?? 0;
  const title = strFromU8(bytes.subarray(4, 4 + n)) || 'Œuvre partagée';
  return { title, grid: decodeGrid(bytes.subarray(4 + n)), createdAt: Date.now() };
}

/** Une œuvre tient-elle dans un QR code ? */
export function fitsInQr(a: SharedArtwork): boolean {
  return encodeQrPayload(a).length <= QR_MAX_BYTES;
}

/** Modules du QR code (true = noir), ou null si l'œuvre est trop grande. */
export function qrMatrix(a: SharedArtwork): boolean[][] | null {
  const payload = encodeQrPayload(a);
  if (payload.length > QR_MAX_BYTES) return null;
  return encode(Array.from(payload), { ecc: 'L', border: 0 }).data;
}

/** Dessine le QR code (modules carrés, marge blanche) dans un canvas. */
export function drawQr(
  matrix: boolean[][],
  px: number,
  dark = '#1f1d24',
  light = '#ffffff',
): HTMLCanvasElement {
  const n = matrix.length;
  const margin = 4;
  const size = (n + margin * 2) * px;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = dark;
  matrix.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) ctx.fillRect((x + margin) * px, (y + margin) * px, px, px);
    });
  });
  return c;
}

/** Cherche un QR code d'œuvre dans une image (caméra, photo). */
export function scanQr(image: ImageData): SharedArtwork | null {
  const found = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
  if (!found || found.binaryData.length === 0) return null;
  try {
    return decodeQrPayload(Uint8Array.from(found.binaryData));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- identité

/** Empreinte stable d'une grille (même œuvre importée deux fois = même partie). */
export function gridHash(grid: Grid): string {
  const bytes = encodeGrid(grid);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const b of bytes) {
    h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ b, 0x5bd1e995) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}
