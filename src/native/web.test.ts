import { describe, expect, it } from 'vitest';
import { vibrationPattern } from './web';

describe('repli navigateur', () => {
  it('forme d’onde → vibration, pause, vibration…', () => {
    expect(vibrationPattern({ timings: [0, 50], amplitudes: [0, 110] })).toEqual([50]);
    expect(vibrationPattern({ timings: [0, 35, 65, 21], amplitudes: [0, 250, 0, 180] })).toEqual([
      35, 65, 21,
    ]);
    // pause d'entrée, segments de même état fusionnés, pause finale inutile
    expect(vibrationPattern({ timings: [10, 20, 5, 30, 40], amplitudes: [0, 90, 200, 0, 0] })).toEqual([
      0, 10, 25,
    ]);
    expect(vibrationPattern({ timings: [0, 50], amplitudes: [0, 0] })).toEqual([]);
  });
});
