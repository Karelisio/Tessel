/**
 * Ambiances sonores (boucles sans couture), synthétisées : pluie, feu de cheminée, café, forêt, vagues.
 * Rendu hors ligne en Web Audio pur (48 kHz stéréo).
 */

export interface AmbienceDef {
  id: string;
  title: { fr: string; en: string };
  seconds: number;
  seed: number;
  build: (ctx: OfflineAudioContext, r: () => number, seconds: number) => void;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise(
  ctx: BaseAudioContext,
  seconds: number,
  r: () => number,
  kind: 'white' | 'pink' | 'brown',
): AudioBuffer {
  const buf = ctx.createBuffer(2, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = r() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
  }
  return buf;
}

function bed(
  ctx: OfflineAudioContext,
  r: () => number,
  seconds: number,
  kind: 'white' | 'pink' | 'brown',
  filters: BiquadFilterOptions[],
  gain: number,
): GainNode {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx, seconds, r, kind);
  let node: AudioNode = src;
  for (const f of filters) {
    const b = new BiquadFilterNode(ctx, f);
    node.connect(b);
    node = b;
  }
  const g = ctx.createGain();
  g.gain.value = gain;
  node.connect(g).connect(ctx.destination);
  src.start(0);
  return g;
}

/** Petit bruit filtré bref (goutte, crépitement, clic), panoramique aléatoire. */
function tick(
  ctx: OfflineAudioContext,
  r: () => number,
  at: number,
  freq: number,
  q: number,
  decay: number,
  peak: number,
): void {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx, decay * 4 + 0.01, r, 'white');
  const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: freq, Q: q });
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.002);
  g.gain.setTargetAtTime(0, at + 0.002, decay);
  const pan = new StereoPannerNode(ctx, { pan: r() * 1.6 - 0.8 });
  src.connect(bp).connect(g).connect(pan).connect(ctx.destination);
  src.start(at);
}

export const AMBIENCES: AmbienceDef[] = [
  {
    id: 'ambience:pluie',
    title: { fr: 'Pluie', en: 'Rain' },
    seconds: 40,
    seed: 101,
    build: (ctx, r, s) => {
      bed(
        ctx,
        r,
        s,
        'pink',
        [
          { type: 'highpass', frequency: 400 },
          { type: 'lowpass', frequency: 6000 },
        ],
        0.5,
      );
      bed(ctx, r, s, 'brown', [{ type: 'lowpass', frequency: 500 }], 0.35);
      for (let t = 0; t < s; t += 0.01 + r() * 0.06)
        tick(ctx, r, t, 2500 + r() * 4000, 4, 0.01 + r() * 0.02, 0.05 + r() * 0.12);
    },
  },
  {
    id: 'ambience:feu',
    title: { fr: 'Feu de cheminée', en: 'Fireplace' },
    seconds: 40,
    seed: 202,
    build: (ctx, r, s) => {
      const roar = bed(ctx, r, s, 'brown', [{ type: 'lowpass', frequency: 350 }], 0.7);
      // souffle qui respire
      for (let t = 0; t < s; t += 2) roar.gain.linearRampToValueAtTime(0.5 + r() * 0.35, t + 2);
      bed(ctx, r, s, 'pink', [{ type: 'bandpass', frequency: 1200, Q: 0.6 }], 0.05);
      for (let t = 0; t < s; t += 0.03 + r() ** 2 * 0.6) {
        tick(ctx, r, t, 1500 + r() * 3000, 1.5, 0.004 + r() * 0.01, 0.15 + r() * 0.4);
        if (r() < 0.08)
          for (let k = 0; k < 4; k++) tick(ctx, r, t + k * 0.012, 2500 + r() * 2000, 2, 0.003, 0.2);
      }
    },
  },
  {
    id: 'ambience:cafe',
    title: { fr: 'Café', en: 'Café' },
    seconds: 40,
    seed: 303,
    build: (ctx, r, s) => {
      // brouhaha : bandes de parole qui ondulent
      for (let v = 0; v < 6; v++) {
        const g = bed(ctx, r, s, 'pink', [{ type: 'bandpass', frequency: 350 + r() * 900, Q: 1.2 }], 0.0);
        for (let t = 0; t < s; t += 0.25 + r() * 0.5)
          g.gain.linearRampToValueAtTime(r() < 0.35 ? 0 : 0.08 + r() * 0.1, t);
      }
      bed(ctx, r, s, 'brown', [{ type: 'lowpass', frequency: 200 }], 0.25);
      // tasses et cuillères
      for (let t = 1 + r() * 3; t < s - 1; t += 2 + r() * 5) {
        const f = 2200 + r() * 1800;
        for (const [k, m] of [
          [1, 0.2],
          [2.76, 0.08],
          [5.4, 0.04],
        ] as const) {
          const o = new OscillatorNode(ctx, { type: 'sine', frequency: f * k });
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(m * 0.4, t + 0.002);
          g.gain.setTargetAtTime(0, t + 0.002, 0.08);
          o.connect(g)
            .connect(new StereoPannerNode(ctx, { pan: r() - 0.5 }))
            .connect(ctx.destination);
          o.start(t);
          o.stop(t + 0.6);
        }
      }
    },
  },
  {
    id: 'ambience:foret',
    title: { fr: 'Forêt', en: 'Forest' },
    seconds: 40,
    seed: 404,
    build: (ctx, r, s) => {
      const wind = bed(ctx, r, s, 'pink', [{ type: 'bandpass', frequency: 700, Q: 0.5 }], 0.2);
      for (let t = 0; t < s; t += 3) wind.gain.linearRampToValueAtTime(0.1 + r() * 0.22, t + 3);
      // oiseaux : glissandos rapides en modulation de fréquence
      for (let t = 0.5; t < s - 1; t += 0.6 + r() * 2.5) {
        const base = 2600 + r() * 2200;
        const notes = 2 + Math.floor(r() * 4);
        const pan = new StereoPannerNode(ctx, { pan: r() * 1.4 - 0.7 });
        pan.connect(ctx.destination);
        for (let k = 0; k < notes; k++) {
          const at = t + k * (0.08 + r() * 0.05);
          const o = new OscillatorNode(ctx, { type: 'sine', frequency: base });
          o.frequency.setValueAtTime(base * (0.9 + r() * 0.2), at);
          o.frequency.exponentialRampToValueAtTime(base * (1.2 + r() * 0.5), at + 0.06);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, at);
          g.gain.linearRampToValueAtTime(0.035 + r() * 0.03, at + 0.01);
          g.gain.linearRampToValueAtTime(0, at + 0.07);
          o.connect(g).connect(pan);
          o.start(at);
          o.stop(at + 0.1);
        }
      }
    },
  },
  {
    id: 'ambience:vagues',
    title: { fr: 'Vagues', en: 'Waves' },
    seconds: 40,
    seed: 505,
    build: (ctx, r, s) => {
      const surf = bed(ctx, r, s, 'pink', [{ type: 'lowpass', frequency: 1800 }], 0.05);
      const deep = bed(ctx, r, s, 'brown', [{ type: 'lowpass', frequency: 400 }], 0.2);
      // houle : chaque vague monte, se brise puis se retire (période 8 s, boucle de 40 s)
      for (let t = 0; t < s; t += 8) {
        const peak = 0.45 + r() * 0.2;
        surf.gain.setValueAtTime(0.05, t);
        surf.gain.linearRampToValueAtTime(peak, t + 3);
        surf.gain.linearRampToValueAtTime(0.05, t + 7.8);
        deep.gain.setValueAtTime(0.2, t);
        deep.gain.linearRampToValueAtTime(0.45, t + 2.6);
        deep.gain.linearRampToValueAtTime(0.2, t + 7.5);
      }
    },
  },
];

/**
 * Rend une ambiance en boucle parfaite : on rend 4 s de plus, et la fin est fondue dans le début.
 */
export async function renderAmbience(def: AmbienceDef): Promise<AudioBuffer> {
  const tail = 4;
  const total = def.seconds + tail;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * 48000), 48000);
  def.build(ctx, rng(def.seed), total);
  const full = await ctx.startRendering();
  const n = def.seconds * 48000;
  const x = tail * 48000;
  const out = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: 48000 });
  for (let c = 0; c < 2; c++) {
    const src = full.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src.subarray(0, n));
    for (let i = 0; i < x; i++) {
      const k = i / x;
      // fondu à puissance constante : la queue (après n) glisse sous le début
      dst[i] = (src[i] ?? 0) * Math.sin((k * Math.PI) / 2) + (src[n + i] ?? 0) * Math.cos((k * Math.PI) / 2);
    }
  }
  return out;
}
