import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HapticsEngine } from './haptics';

const vibrate = vi.hoisted(() => vi.fn(() => Promise.resolve({ played: true })));
vi.mock('@/native/TesselNative', () => ({ TesselNative: { vibrate } }));

const waveforms = () => vibrate.mock.calls.map((c) => (c as unknown[])[0]);

beforeEach(() => {
  vi.useFakeTimers();
  vibrate.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('haptique', () => {
  it('passe par le plugin natif (vibration de jeu), clic plus appuyé que la touche légère', () => {
    const h = new HapticsEngine();
    h.pulse('tick-light', 0);
    h.pulse('click', 100);
    expect(waveforms()).toEqual([
      { timings: [0, 50], amplitudes: [0, 110] },
      { timings: [0, 43], amplitudes: [0, 180] },
    ]);
  });

  it('limite la cadence pendant un glissé', () => {
    const h = new HapticsEngine(45);
    for (let t = 0; t <= 100; t += 10) h.pulse('tick', t);
    expect(vibrate).toHaveBeenCalledTimes(3);
  });

  it('point de croix : seconde impulsion 240 ms plus tard, sauf si on coupe entre-temps', () => {
    const h = new HapticsEngine();
    h.pulse('double-tick', 0);
    vi.advanceTimersByTime(240);
    expect(vibrate).toHaveBeenCalledTimes(2);
    h.pulse('double-tick', 1000);
    h.enabled = false;
    vi.advanceTimersByTime(240);
    expect(vibrate).toHaveBeenCalledTimes(3);
  });

  it('les gestes ponctuels vibrent aussi (soft), rien quand c’est désactivé', () => {
    const h = new HapticsEngine();
    h.soft();
    h.success();
    expect(vibrate).toHaveBeenCalledTimes(2);
    h.enabled = false;
    h.soft();
    h.success();
    h.pulse('click', 5000);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });
});
