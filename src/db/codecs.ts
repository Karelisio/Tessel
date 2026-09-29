import { deflateSync, inflateSync } from 'fflate';
import { createGrid, type Grid, type Rgb } from '@/content/grid';
import { Bitset } from '@/content/progress';

// --- base64 ----------------------------------------------------------------

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// --- Grille (.tgrid) ---------------------------------------------------------

const GRID_MAGIC = [0x54, 0x53, 0x47, 0x31]; // "TSG1"

/**
 * Grille binaire compacte : magic, largeur/hauteur (u16), nombre de couleurs (u8), palette RGB,
 * puis les index de case compressés (deflate).
 */
export function encodeGrid(grid: Grid): Uint8Array {
  const n = grid.palette.length;
  const packed = deflateSync(grid.cells, { level: 9 });
  const out = new Uint8Array(4 + 5 + n * 3 + packed.length);
  out.set(GRID_MAGIC, 0);
  const view = new DataView(out.buffer);
  view.setUint16(4, grid.width, true);
  view.setUint16(6, grid.height, true);
  out[8] = n;
  grid.palette.forEach(([r, g, b], i) => {
    out.set([r, g, b], 9 + i * 3);
  });
  out.set(packed, 9 + n * 3);
  return out;
}

export function decodeGrid(bytes: Uint8Array): Grid {
  if (bytes.length < 9 || GRID_MAGIC.some((b, i) => bytes[i] !== b)) throw new Error('Grille invalide');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(4, true);
  const height = view.getUint16(6, true);
  const n = bytes[8] ?? 0;
  const palette: Rgb[] = [];
  for (let i = 0; i < n; i++) {
    const o = 9 + i * 3;
    palette.push([bytes[o] ?? 0, bytes[o + 1] ?? 0, bytes[o + 2] ?? 0]);
  }
  const cells = inflateSync(bytes.subarray(9 + n * 3));
  return createGrid(width, height, palette, cells);
}

// --- Bitset -----------------------------------------------------------------

export function encodeBitset(bits: Bitset): string {
  return toBase64(deflateSync(bits.bytes, { level: 6 }));
}

export function decodeBitset(b64: string, size: number): Bitset {
  return new Bitset(size, inflateSync(fromBase64(b64)));
}

// --- Journal de poses ------------------------------------------------------------

export const Op = { Place: 0, Unplace: 1 } as const;
export type Op = (typeof Op)[keyof typeof Op];

export interface JournalOp {
  op: Op;
  index: number;
}

function writeVarint(out: number[], v: number): void {
  let x = v >>> 0;
  while (x >= 0x80) {
    out.push((x & 0x7f) | 0x80);
    x >>>= 7;
  }
  out.push(x);
}

/**
 * Lot d'opérations : pour chaque op, varint de (zigzag(delta d'index) << 1 | type).
 * Les poses successives étant voisines, la plupart tiennent sur un octet.
 */
export function encodeOps(ops: readonly JournalOp[]): string {
  const out: number[] = [];
  let prev = 0;
  for (const { op, index } of ops) {
    const d = index - prev;
    const zz = d >= 0 ? d * 2 : -d * 2 - 1;
    writeVarint(out, zz * 2 + op);
    prev = index;
  }
  return toBase64(Uint8Array.from(out));
}

export function decodeOps(b64: string): JournalOp[] {
  const bytes = fromBase64(b64);
  const ops: JournalOp[] = [];
  let prev = 0;
  let i = 0;
  while (i < bytes.length) {
    let v = 0;
    let shift = 0;
    let b: number;
    do {
      b = bytes[i++] ?? 0;
      v += (b & 0x7f) * 2 ** shift;
      shift += 7;
    } while (b & 0x80);
    const op = (v % 2) as Op;
    const zz = Math.floor(v / 2);
    const d = zz % 2 === 0 ? zz / 2 : -(zz + 1) / 2;
    prev += d;
    ops.push({ op, index: prev });
  }
  return ops;
}
