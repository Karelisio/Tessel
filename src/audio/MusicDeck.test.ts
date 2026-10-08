import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MusicDeck, type LoopTrack } from './MusicDeck';

// --- faux Web Audio : on n'entend rien, on vérifie ce qui est programmé et quand

type Event = [kind: string, time: number, value?: number];

class FakeParam {
  value = 1;
  events: Event[] = [];
  setValueCurveAtTime(c: Float32Array, t: number, d: number) {
    this.events.push(['curve', t, c[c.length - 1] ?? 0], ['curve-end', t + d]);
  }
  setValueAtTime(v: number, t: number) {
    this.events.push(['set', t, v]);
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push(['ramp', t, v]);
  }
  cancelScheduledValues(t: number) {
    this.events = this.events.filter((e) => e[1] < t);
  }
}

class FakeNode {
  connect<T>(n: T): T {
    return n;
  }
  disconnect() {
    /* rien */
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeSource extends FakeNode {
  buffer: { duration: number; id: string } | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  started: [number, number] | null = null;
  stopped: number | null = null;
  start(when: number, offset: number) {
    this.started = [when, offset];
  }
  stop(when = 0) {
    this.stopped = when;
  }
}

class FakeCtx {
  currentTime = 0;
  sources: FakeSource[] = [];
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createGain() {
    return new FakeGain();
  }
  decodeAudioData(data: ArrayBuffer) {
    const id = new TextDecoder().decode(data);
    const channel = new Float32Array(0);
    return Promise.resolve({
      duration: 121,
      id,
      length: 121 * 48000,
      numberOfChannels: 2,
      getChannelData: () => channel,
    });
  }
}

const TRACKS: LoopTrack[] = ['a', 'b', 'c'].map((id) => ({ id, file: id, samples: 120 * 48000 }));

let ctx: FakeCtx;
let deck: MusicDeck;
const playingLog: (string | null)[] = [];

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/** Avance l'horloge audio et les minuteries ensemble, par pas de 0,5 s. */
async function advance(seconds: number) {
  for (let t = 0; t < seconds; t += 0.5) {
    ctx.currentTime += 0.5;
    vi.advanceTimersByTime(500);
    await flush();
  }
}

const started = () => ctx.sources.filter((s) => s.started);
const idOf = (s: FakeSource) => s.buffer?.id;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode(url.replace('audio/', '')).buffer),
      }),
    ),
  );
  ctx = new FakeCtx();
  playingLog.length = 0;
  deck = new MusicDeck({
    ctx: () => ctx as unknown as AudioContext,
    out: () => new FakeNode() as unknown as AudioNode,
    track: (id) => TRACKS.find((t) => t.id === id),
  });
  deck.subscribe((id) => playingLog.push(id));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('lecteur de musique en boucles', () => {
  it('une seule piste : boucle exacte, jamais de relais', async () => {
    deck.set(['b'], true);
    await flush();
    expect(started()).toHaveLength(1);
    const src = started()[0];
    expect(src && idOf(src)).toBe('b');
    expect(src?.loop).toBe(true);
    expect(src?.loopStart).toBe(0);
    expect(src?.loopEnd).toBe(120);
    await advance(400);
    expect(started()).toHaveLength(1);
    expect(deck.current()).toBe('b');
  });

  it('plusieurs pistes : relais en fondu enchaîné calé sur la fin du tour', async () => {
    deck.set(['a', 'b'], false);
    await flush();
    const first = started()[0];
    expect(first && idOf(first)).toBe('a');
    const t0 = first?.started?.[0] ?? 0;
    // décodée en avance, la suivante n'est programmée qu'une dizaine de secondes avant la fin du tour
    await advance(100);
    expect(started()).toHaveLength(1);
    await advance(12);
    expect(started()).toHaveLength(2);
    const second = started()[1];
    expect(second && idOf(second)).toBe('b');
    // commence 8 s avant la fin du premier tour : la fin du fondu tombe pile sur la boucle
    expect(second?.started?.[0]).toBeCloseTo(t0 + 120 - 8);
    await advance(30);
    expect(deck.current()).toBe('b');
    // l'ancienne s'arrête une fois le fondu fini
    expect(first?.stopped).toBeCloseTo(t0 + 120 + 0.05);
    expect(playingLog).toEqual(['a', 'b']);
  });

  it('décocher la piste suivante avant le relais : la piste en cours continue', async () => {
    deck.set(['a', 'b'], false);
    await flush();
    await advance(112);
    expect(started()).toHaveLength(2);
    const [first, second] = started();
    deck.set(['a'], false);
    await flush();
    expect(second?.stopped).toBe(0);
    // le fondu de sortie programmé est annulé
    expect(first?.stopped).toBeNull();
    await advance(400);
    expect(deck.current()).toBe('a');
    expect(started()).toHaveLength(2);
  });

  it('décocher la piste en cours : une autre prend le relais', async () => {
    deck.set(['a', 'c'], false);
    await flush();
    deck.set(['c'], false);
    await flush();
    const last = started().at(-1);
    expect(last && idOf(last)).toBe('c');
    expect(deck.current()).toBe('c');
  });

  it('piste suivante à la demande, puis silence quand on décoche tout', async () => {
    deck.set(['a', 'b', 'c'], false);
    await flush();
    deck.skip();
    await flush();
    expect(deck.current()).toBe('b');
    deck.set([], false);
    await flush();
    expect(deck.current()).toBeNull();
    expect(started().every((s) => s.stopped !== null)).toBe(true);
  });

  it('volume nul : tout s’arrête ; remonté : ça repart', async () => {
    deck.set(['a'], true);
    await flush();
    deck.setEnabled(false);
    expect(deck.current()).toBeNull();
    deck.setEnabled(true);
    await flush();
    expect(deck.current()).toBe('a');
  });
});
