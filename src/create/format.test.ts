import { describe, expect, it } from 'vitest';
import { createGrid, TRANSPARENT } from '@/content/grid';
import {
  decodeQrPayload,
  decodeTessel,
  encodeQrPayload,
  encodeTessel,
  fitsInQr,
  gridHash,
  qrMatrix,
  scanQr,
} from './format';

const grid = (w: number, h: number, colors = 6) => {
  const palette = Array.from({ length: colors }, (_, i) => [i * 40, 255 - i * 30, (i * 70) % 256] as const);
  const cells = new Uint8Array(w * h);
  for (let i = 0; i < cells.length; i++) cells[i] = i % 7 === 0 ? TRANSPARENT : (i * 13) % colors;
  return createGrid(w, h, palette, cells);
};

describe('partage des œuvres', () => {
  it('fichier .tessel aller-retour', () => {
    const a = { title: 'Mon chat', grid: grid(20, 14), createdAt: 1234 };
    const b = decodeTessel(encodeTessel(a));
    expect(b.title).toBe('Mon chat');
    expect(b.createdAt).toBe(1234);
    expect(b.grid.width).toBe(20);
    expect(Array.from(b.grid.cells)).toEqual(Array.from(a.grid.cells));
    expect(gridHash(b.grid)).toBe(gridHash(a.grid));
  });

  it('refuse les fichiers étrangers', () => {
    expect(() => decodeTessel(new TextEncoder().encode('{"hello":1}'))).toThrow();
    expect(() => decodeTessel(new Uint8Array([1, 2, 3]))).toThrow();
  });

  it('charge QR compacte aller-retour, et QR généré', () => {
    const a = { title: 'Étoile ✨', grid: grid(32, 32, 12), createdAt: 0 };
    const b = decodeQrPayload(encodeQrPayload(a));
    expect(b.title).toBe('Étoile ✨');
    expect(Array.from(b.grid.cells)).toEqual(Array.from(a.grid.cells));
    expect(fitsInQr(a)).toBe(true);
    const m = qrMatrix(a);
    expect(m?.length).toBeGreaterThan(20);
  });

  it('un QR généré se relit (image → jsQR)', () => {
    const a = { title: 'Cœur', grid: grid(24, 24, 8), createdAt: 0 };
    const m = qrMatrix(a);
    if (!m) throw new Error('QR attendu');
    const px = 4;
    const margin = 4;
    const side = (m.length + margin * 2) * px;
    const data = new Uint8ClampedArray(side * side * 4).fill(255);
    m.forEach((row, y) => {
      row.forEach((on, x) => {
        if (!on) return;
        for (let dy = 0; dy < px; dy++)
          for (let dx = 0; dx < px; dx++) {
            const o = (((y + margin) * px + dy) * side + (x + margin) * px + dx) * 4;
            data[o] = data[o + 1] = data[o + 2] = 0;
          }
      });
    });
    const b = scanQr({ data, width: side, height: side, colorSpace: 'srgb' });
    expect(b?.title).toBe('Cœur');
    expect(Array.from(b?.grid.cells ?? [])).toEqual(Array.from(a.grid.cells));
  });

  it('empreinte différente pour des grilles différentes', () => {
    expect(gridHash(grid(10, 10))).not.toBe(gridHash(grid(10, 11)));
  });
});
