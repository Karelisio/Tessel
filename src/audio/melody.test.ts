import { describe, expect, it } from 'vitest';
import { Melody, pentatonicStep } from './melody';

describe('mélodie de pose', () => {
  it('monte sur la gamme pentatonique puis redescend', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(pentatonicStep)).toEqual([0, 2, 4, 7, 9, 12, 14]);
    expect(pentatonicStep(10)).toBe(24);
    expect(pentatonicStep(11)).toBe(pentatonicStep(9));
    expect(pentatonicStep(20)).toBe(0);
  });

  it('remet la série à zéro après une pause', () => {
    const m = new Melody(0.45);
    expect(m.next(0)).toBe(0);
    expect(m.next(0.1)).toBe(2);
    expect(m.next(0.2)).toBe(4);
    expect(m.next(1)).toBe(0);
  });
});
