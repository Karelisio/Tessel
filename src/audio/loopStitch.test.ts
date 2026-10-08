import { describe, expect, it } from 'vitest';
import { stitchLoop } from './loopStitch';

/** Tampon décodé factice : la boucle [offset, offset + samples) puis sa suite décodée. */
function decoded(length: number, at: (i: number) => number) {
  const data = Float32Array.from({ length }, (_, i) => at(i));
  return { length, numberOfChannels: 1, getChannelData: () => data, data };
}

describe('raccord de boucle', () => {
  it('la jonction suit la suite décodée, puis rejoint le début réel', () => {
    // signal lisse ; le décodage du début est décalé de 0,01 (erreurs de codage indépendantes)
    const samples = 4000;
    const offset = 10;
    const b = decoded(offset + samples + 2000, (i) => {
      const k = i - offset;
      const base = Math.sin((2 * Math.PI * ((k + samples) % samples)) / samples);
      return k >= 0 && k < 100 ? base + 0.01 : base;
    });
    const end = b.data[offset + samples - 1] ?? 0;
    const step = Math.abs((b.data[offset] ?? 0) - end);
    expect(step).toBeGreaterThan(0.009);
    stitchLoop(b, offset, samples, 50);
    // plus de marche à la jonction : le pas est celui du signal lisse
    expect(Math.abs((b.data[offset] ?? 0) - end)).toBeLessThan(0.002);
    // après le fondu, le début réel est intact
    expect(b.data[offset + 60]).toBeCloseTo(Math.sin((2 * Math.PI * 60) / samples) + 0.01, 6);
  });

  it('sans suite décodée, rien ne change', () => {
    const b = decoded(1000, (i) => i / 1000);
    const before = Array.from(b.data);
    stitchLoop(b, 0, 1000);
    expect(Array.from(b.data)).toEqual(before);
  });
});
