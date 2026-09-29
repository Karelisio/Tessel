import { describe, expect, it } from 'vitest';
import { sunsetLake } from '@/content/generators/sunsetLake';
import { Bitset } from '@/content/progress';
import {
  Op,
  decodeBitset,
  decodeGrid,
  decodeOps,
  encodeBitset,
  encodeGrid,
  encodeOps,
  fromBase64,
  toBase64,
} from './codecs';

describe('codecs', () => {
  it('base64 aller-retour, y compris de gros tableaux', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 37) & 255);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it('grille : aller-retour exact et compression efficace', () => {
    const g = sunsetLake(150, 150, 1);
    const bin = encodeGrid(g);
    const back = decodeGrid(bin);
    expect(back.width).toBe(150);
    expect(back.palette).toEqual(g.palette);
    expect(back.cells).toEqual(g.cells);
    expect(bin.length).toBeLessThan(g.cells.length / 4);
  });

  it('refuse une grille corrompue', () => {
    expect(() => decodeGrid(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow();
  });

  it('bitset : aller-retour', () => {
    const b = new Bitset(90_000);
    for (let i = 0; i < 90_000; i += 7) b.set(i);
    const back = decodeBitset(encodeBitset(b), 90_000);
    expect(back.bytes).toEqual(b.bytes);
  });

  it('journal : aller-retour avec deltas négatifs, grands index et annulations', () => {
    const ops = [
      { op: Op.Place, index: 12 },
      { op: Op.Place, index: 13 },
      { op: Op.Place, index: 89_999 },
      { op: Op.Unplace, index: 13 },
      { op: Op.Place, index: 0 },
      { op: Op.Place, index: 300 },
    ];
    expect(decodeOps(encodeOps(ops))).toEqual(ops);
  });

  it('journal : une pose voisine tient sur un octet', () => {
    const ops = Array.from({ length: 64 }, (_, i) => ({ op: Op.Place, index: 1000 + i }));
    // premier index sur 2 octets, puis 1 octet par pose voisine
    expect(fromBase64(encodeOps(ops)).length).toBe(2 + 63);
  });
});
