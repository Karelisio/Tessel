/**
 * Effets sonores synthétisés hors ligne (OfflineAudioContext) : aucune dépendance à des fichiers,
 * sons nous appartenant. Chaque fonction produit une variante légèrement différente.
 * Tonalité de référence : mi (les poses suivent une gamme pentatonique à partir de cette note).
 */

const RATE = 44100;

type Build = (ctx: OfflineAudioContext, variant: number) => void;

async function render(duration: number, variant: number, build: Build): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.ceil(duration * RATE), RATE);
  build(ctx, variant);
  return ctx.startRendering();
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < d.length; i++) {
    s = (s * 9301 + 49297) % 233280;
    d[i] = (s / 233280) * 2 - 1;
  }
  return buf;
}

function env(
  ctx: BaseAudioContext,
  target: AudioNode,
  at: number,
  attack: number,
  decay: number,
  peak: number,
) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.setTargetAtTime(0, at + attack, decay / 3);
  g.connect(target);
  return g;
}

function noiseTick(
  ctx: OfflineAudioContext,
  out: AudioNode,
  at: number,
  freq: number,
  q: number,
  peak: number,
  v: number,
) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.03, v + 3);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  src.connect(bp).connect(env(ctx, out, at, 0.0005, 0.006, peak));
  src.start(at);
}

/** Pixel : « pop » doux et rond, légèrement accordé (mi 6). */
export const pixelClick: Build = (ctx, v) => {
  const out = ctx.createBiquadFilter();
  out.type = 'lowpass';
  out.frequency.value = 5200;
  out.connect(ctx.destination);
  const f = 1318.5 * (1 + (v - 1.5) * 0.004);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f * 1.25, 0);
  osc.frequency.exponentialRampToValueAtTime(f, 0.012);
  osc.connect(env(ctx, out, 0, 0.002, 0.07, 0.42));
  osc.start(0);
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = f / 2;
  sub.connect(env(ctx, out, 0, 0.002, 0.035, 0.18));
  sub.start(0);
  noiseTick(ctx, out, 0, 3200 + v * 250, 1.2, 0.18, v);
};

/** Diamant : cliquetis cristallin (partiels inharmoniques) + petit ricochet. */
export const diamondClink: Build = (ctx, v) => {
  const out = ctx.createBiquadFilter();
  out.type = 'highpass';
  out.frequency.value = 500;
  out.connect(ctx.destination);
  const f0 = 2637 * (1 + (v - 1.5) * 0.006);
  const partials: [number, number, number][] = [
    [1, 0.34, 0.22],
    [2.76, 0.2, 0.12],
    [5.4, 0.1, 0.07],
    [8.93, 0.05, 0.04],
  ];
  for (const hit of [0, 0.019 + v * 0.002]) {
    const level = hit === 0 ? 1 : 0.28;
    for (const [ratio, amp, decay] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f0 * ratio * (hit === 0 ? 1 : 1.012);
      o.connect(env(ctx, out, hit, 0.0008, decay, amp * level));
      o.start(hit);
    }
    noiseTick(ctx, out, hit, 7000, 2, 0.22 * level, v + hit);
  }
};

/** Point de croix : deux frottements de fil (un par passage de l'aiguille), synchronisés avec l'animation. */
export const threadRub: Build = (ctx, v) => {
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(ctx.destination);
  for (const [at, dur, center] of [
    [0, 0.19, 2400],
    [0.24, 0.2, 2900],
  ] as const) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, dur + 0.05, v * 7 + at * 100);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.1;
    // le fil glisse : le filtre balaie vers l'aigu
    bp.frequency.setValueAtTime(center * 0.55 * (1 + v * 0.04), at);
    bp.frequency.exponentialRampToValueAtTime(center * (1 + v * 0.04), at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.32, at + dur * 0.35);
    g.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(bp).connect(g).connect(out);
    src.start(at);
    // petite note douce quand le fil se tend
    const o = ctx.createOscillator();
    o.frequency.value = at === 0 ? 1318.5 : 1661.2;
    o.connect(env(ctx, out, at + dur * 0.8, 0.004, 0.09, 0.05));
    o.start(at);
  }
};

/** Mosaïque : « clac » céramique (modes résonants) suivi d'un léger tintement. */
export const tileClack: Build = (ctx, v) => {
  const out = ctx.createGain();
  out.connect(ctx.destination);
  noiseTick(ctx, out, 0, 1800 + v * 120, 0.9, 0.5, v);
  for (const [f, amp, decay] of [
    [2150, 0.16, 0.05],
    [3420, 0.1, 0.035],
    [5230, 0.06, 0.025],
    [7700, 0.04, 0.018],
  ] as const) {
    const o = ctx.createOscillator();
    o.frequency.value = f * (1 + (v - 1.5) * 0.02);
    o.connect(env(ctx, out, 0, 0.0005, decay, amp));
    o.start(0);
  }
  const thump = ctx.createOscillator();
  thump.frequency.setValueAtTime(190, 0);
  thump.frequency.exponentialRampToValueAtTime(110, 0.05);
  thump.connect(env(ctx, out, 0, 0.001, 0.05, 0.25));
  thump.start(0);
  const tink = ctx.createOscillator();
  tink.frequency.value = 2637 * (1 + v * 0.003);
  tink.connect(env(ctx, out, 0.012, 0.001, 0.12, 0.04));
  tink.start(0.012);
};

/** Fin d'œuvre : accord arpégé en cloches douces, sur deux octaves. */
export const finaleChord: Build = (ctx, v) => {
  const notes = [329.63, 415.3, 493.88, 659.25, 830.61, 987.77, 1318.5, 1661.2];
  notes.forEach((f, i) => {
    const at = i * 0.11;
    for (const [ratio, amp, decay] of [
      [1, 0.12, 2.2],
      [2, 0.035, 1.0],
      [3.01, 0.015, 0.6],
    ] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = f * ratio * (1 + v * 0.0008);
      o.connect(env(ctx, ctx.destination, at, 0.006, decay, amp));
      o.start(at);
    }
  });
};

/** Carillon de couleur terminée : arpège montant de trois notes. */
export const colorChime: Build = (ctx, v) => {
  const notes = [659.25, 830.61, 987.77, 1318.5];
  notes.forEach((f, i) => {
    const at = i * 0.075;
    for (const [ratio, amp, decay] of [
      [1, 0.2, 0.9],
      [2, 0.06, 0.4],
      [3.01, 0.03, 0.25],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * ratio * (1 + v * 0.001);
      o.connect(env(ctx, ctx.destination, at, 0.004, decay, amp));
      o.start(at);
    }
  });
};

/** Erreur : « tup » feutré, jamais agressif. */
export const softThud: Build = (ctx, v) => {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(260 + v * 6, 0);
  o.frequency.exponentialRampToValueAtTime(170, 0.06);
  o.connect(env(ctx, ctx.destination, 0, 0.003, 0.07, 0.22));
  o.start(0);
};

export interface BankSpec {
  id: string;
  build: Build;
  duration: number;
  variants: number;
  maxVoices: number;
  /** Intervalle minimal entre deux déclenchements (s). */
  minInterval: number;
  gain: number;
  /** Suit la gamme pentatonique pendant les séries de poses. */
  melodic: boolean;
}

export const BANKS: readonly BankSpec[] = [
  {
    id: 'pixel',
    build: pixelClick,
    duration: 0.14,
    variants: 4,
    maxVoices: 6,
    minInterval: 0.028,
    gain: 0.8,
    melodic: true,
  },
  {
    id: 'diamond',
    build: diamondClink,
    duration: 0.4,
    variants: 4,
    maxVoices: 7,
    minInterval: 0.03,
    gain: 0.55,
    melodic: true,
  },
  {
    id: 'chime',
    build: colorChime,
    duration: 1.4,
    variants: 2,
    maxVoices: 2,
    minInterval: 0.2,
    gain: 0.7,
    melodic: false,
  },
  {
    id: 'error',
    build: softThud,
    duration: 0.15,
    variants: 2,
    maxVoices: 2,
    minInterval: 0.12,
    gain: 0.6,
    melodic: false,
  },
];

export async function renderBank(spec: BankSpec): Promise<AudioBuffer[]> {
  const out: AudioBuffer[] = [];
  for (let v = 0; v < spec.variants; v++) out.push(await render(spec.duration, v, spec.build));
  return out;
}
