import { describe, expect, it } from 'vitest';
import { integratedLoudness, normalize } from './loudness';
import { muxOggOpus, oggCrc } from './ogg';

const sine = (freq: number, amp: number, seconds: number, fs = 48000) => {
  const x = new Float32Array(seconds * fs);
  for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / fs);
  return x;
};

describe('sonie BS.1770', () => {
  it('sinus 1 kHz à 0 dBFS sur deux canaux ≈ 0 LUFS', () => {
    const l = integratedLoudness([sine(1000, 1, 5), sine(1000, 1, 5)], 48000);
    expect(l).toBeGreaterThan(-0.3);
    expect(l).toBeLessThan(0.3);
  });

  it('sinus 1 kHz à 0 dBFS sur un canal ≈ -3,01 LUFS', () => {
    const l = integratedLoudness([sine(1000, 1, 5)], 48000);
    expect(l).toBeCloseTo(-3.01, 1);
  });

  it('normalise à -16 LUFS', () => {
    const ch = [sine(440, 0.05, 6), sine(440, 0.05, 6)];
    normalize(ch, 48000, -16);
    expect(integratedLoudness(ch, 48000)).toBeCloseTo(-16, 0);
  });
});

describe('conteneur Ogg', () => {
  it('CRC Ogg de référence', () => {
    expect(oggCrc(new TextEncoder().encode('123456789'))).toBe(0x89a1897f);
  });

  it('pages valides : en-têtes, granule final, drapeaux', () => {
    const packets = Array.from({ length: 120 }, (_, i) => ({
      data: new Uint8Array(80 + (i % 7)),
      samples: 960,
    }));
    const bytes = muxOggOpus({ channels: 2, preSkip: 312, packets, totalSamples: 120 * 960 - 500 });
    const text = new TextDecoder('latin1').decode(bytes.subarray(0, 64));
    expect(text.startsWith('OggS')).toBe(true);
    expect(text).toContain('OpusHead');
    // dernière page : drapeau fin de flux et granule = pre-skip + longueur réelle
    let p = 0;
    let lastPage = 0;
    while (p < bytes.length) {
      lastPage = p;
      const segs = bytes[p + 26] ?? 0;
      let size = 27 + segs;
      for (let k = 0; k < segs; k++) size += bytes[p + 27 + k] ?? 0;
      p += size;
    }
    expect(p).toBe(bytes.length);
    const v = new DataView(bytes.buffer, bytes.byteOffset + lastPage);
    expect(bytes[lastPage + 5]).toBe(0x04);
    expect(Number(v.getBigInt64(6, true))).toBe(312 + 120 * 960 - 500);
  });
});
