/**
 * Les 8 pistes de Tessel, composées en code avec Tone.js (exécuté dans Chromium, rendu hors ligne).
 * Toutes calmes : lo-fi, piano électrique, nappes, cloches. Déterministes (graine par piste).
 */
import * as Tone from 'tone';

// ---------------------------------------------------------------- outils musicaux

const NAMES: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

const QUALITIES: Record<string, number[]> = {
  maj: [0, 4, 7],
  m: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 14],
  '69': [0, 4, 7, 9, 14],
  m11: [0, 3, 7, 10, 14, 17],
  maj7s11: [0, 4, 7, 11, 18],
};

/** « Dmaj7 », « F#m9 », « Bb69 »… → racine (0–11) et intervalles. */
function parseChord(sym: string): { root: number; iv: number[] } {
  const m = /^([A-G][#b]?)(.*)$/.exec(sym);
  if (!m) throw new Error(`Accord inconnu : ${sym}`);
  const root = NAMES[m[1] ?? 'C'] ?? 0;
  const iv = QUALITIES[m[2] === '' ? 'maj' : (m[2] ?? 'maj')];
  if (!iv) throw new Error(`Qualité inconnue : ${sym}`);
  return { root, iv };
}

const freq = (midi: number) => Tone.Frequency(midi, 'midi').toFrequency();

/** Voicing resserré autour d'une note centrale (conduite de voix douce). */
function voicing(sym: string, center: number, drop = false): number[] {
  const { root, iv } = parseChord(sym);
  const notes = iv.map((i) => {
    let n = root + i;
    while (n < center - 6) n += 12;
    while (n > center + 6) n -= 12;
    return n;
  });
  notes.sort((a, b) => a - b);
  if (drop && notes.length > 3) {
    const second = notes.splice(notes.length - 2, 1)[0];
    if (second !== undefined) notes.unshift(second - 12);
  }
  return notes;
}

function bassNote(sym: string, center = 40): number {
  const { root } = parseChord(sym);
  let n = root;
  while (n < center - 6) n += 12;
  while (n > center + 6) n -= 12;
  return n;
}

/** Gamme (intervalles) → notes MIDI entre lo et hi. */
function scaleNotes(root: number, iv: readonly number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) if (iv.includes((((n - root) % 12) + 12) % 12)) out.push(n);
  return out;
}

const PENTA = [0, 2, 4, 7, 9];
const PENTA_MINOR = [0, 3, 5, 7, 10];

/** Hasard déterministe (mulberry32). */
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

// ---------------------------------------------------------------- instruments

function epiano(out: Tone.InputNode, volume = -14): Tone.PolySynth<Tone.FMSynth> {
  const s = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1,
    modulationIndex: 2.2,
    oscillator: { type: 'sine' },
    modulation: { type: 'sine' },
    envelope: { attack: 0.004, decay: 1.6, sustain: 0.2, release: 1.4 },
    modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0.05, release: 0.6 },
  });
  s.maxPolyphony = 48;
  s.volume.value = volume;
  s.connect(out);
  return s;
}

function bell(out: Tone.InputNode, volume = -20): Tone.PolySynth<Tone.FMSynth> {
  const s = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 6,
    oscillator: { type: 'sine' },
    modulation: { type: 'sine' },
    envelope: { attack: 0.002, decay: 2.4, sustain: 0, release: 2.4 },
    modulationEnvelope: { attack: 0.002, decay: 0.8, sustain: 0, release: 0.8 },
  });
  s.maxPolyphony = 24;
  s.volume.value = volume;
  s.connect(out);
  return s;
}

function mallet(out: Tone.InputNode, volume = -16): Tone.PolySynth<Tone.FMSynth> {
  const s = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 4,
    modulationIndex: 3,
    oscillator: { type: 'sine' },
    modulation: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.6 },
    modulationEnvelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.2 },
  });
  s.maxPolyphony = 24;
  s.volume.value = volume;
  s.connect(out);
  return s;
}

function pad(out: Tone.InputNode, volume = -24, cutoff = 900): Tone.PolySynth {
  const filter = new Tone.Filter({ frequency: cutoff, type: 'lowpass', rolloff: -24, Q: 0.6 });
  const lfo = new Tone.LFO({ frequency: 0.05, min: cutoff * 0.7, max: cutoff * 1.5 }).start(0);
  lfo.connect(filter.frequency);
  const chorus = new Tone.Chorus({ frequency: 0.3, delayTime: 4, depth: 0.6, wet: 0.5 }).start();
  const s = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
    envelope: { attack: 2.2, decay: 1, sustain: 0.85, release: 3.5 },
  });
  s.maxPolyphony = 24;
  s.volume.value = volume;
  s.chain(filter, chorus, out);
  return s;
}

function softPad(out: Tone.InputNode, volume = -22): Tone.PolySynth {
  const filter = new Tone.Filter({ frequency: 1400, type: 'lowpass', rolloff: -12 });
  const s = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 1.6, decay: 0.8, sustain: 0.9, release: 4 },
  });
  s.maxPolyphony = 24;
  s.volume.value = volume;
  s.chain(filter, out);
  return s;
}

function bass(out: Tone.InputNode, volume = -12): Tone.MonoSynth {
  const s = new Tone.MonoSynth({
    oscillator: { type: 'triangle' },
    filter: { Q: 1, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.01, decay: 0.6, sustain: 0.6, release: 0.5 },
    filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.5, baseFrequency: 120, octaves: 2 },
  });
  s.volume.value = volume;
  s.connect(out);
  return s;
}

interface Drums {
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  hat: Tone.NoiseSynth;
}

function drums(out: Tone.InputNode, volume = -16): Drums {
  const bus = new Tone.Gain(Tone.dbToGain(volume)).connect(out);
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 5,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.2 },
  }).connect(bus);
  kick.volume.value = -2;
  const snF = new Tone.Filter({ frequency: 1800, type: 'bandpass', Q: 0.8 }).connect(bus);
  const snare = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.002, decay: 0.18, sustain: 0 },
  }).connect(snF);
  snare.volume.value = -6;
  const hF = new Tone.Filter({ frequency: 7000, type: 'highpass' }).connect(bus);
  const hat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0 },
  }).connect(hF);
  hat.volume.value = -14;
  return { kick, snare, hat };
}

/** Craquements de vinyle discrets. */
function vinyl(out: Tone.InputNode, duration: number, r: () => number): void {
  const hiss = new Tone.Noise({ type: 'brown', volume: -46 }).connect(out);
  hiss.start(0).stop(duration);
  const f = new Tone.Filter({ frequency: 3000, type: 'highpass' }).connect(out);
  const click = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.0005, decay: 0.004, sustain: 0 },
  }).connect(f);
  click.volume.value = -30;
  for (let t = 0.2; t < duration; t += 0.05 + r() * 0.5)
    click.triggerAttackRelease(0.004, t, 0.2 + r() * 0.8);
}

// ---------------------------------------------------------------- mixage

interface Mix {
  /** Entrée normale : son direct + part de réverbération. */
  dry: Tone.Gain;
  /** Entrée qui ne passe que par la réverbération (lointain). */
  wet: Tone.Gain;
}

async function mixBus(opts: { reverb: number; decay: number; lofi?: boolean }): Promise<Mix> {
  const master = new Tone.Gain(1);
  const comp = new Tone.Compressor({ threshold: -20, ratio: 2.5, attack: 0.03, release: 0.3 });
  const tone = new Tone.Filter({ frequency: opts.lofi ? 7500 : 16000, type: 'lowpass', rolloff: -12 });
  const hp = new Tone.Filter({ frequency: 30, type: 'highpass' });
  // lo-fi : léger pleurage de bande avant la chaîne
  if (opts.lofi)
    master.chain(
      new Tone.Vibrato({ frequency: 0.4, depth: 0.04, wet: 1 }),
      hp,
      tone,
      comp,
      Tone.getDestination(),
    );
  else master.chain(hp, tone, comp, Tone.getDestination());
  const reverb = new Tone.Reverb({ decay: opts.decay, preDelay: 0.03, wet: 1 });
  await reverb.generate();
  const wet = new Tone.Gain(opts.reverb);
  wet.chain(reverb, master);
  const direct = new Tone.Gain(1).connect(master);
  const dry = new Tone.Gain(1);
  dry.fan(direct, wet);
  return { dry, wet };
}

interface Ctx {
  duration: number;
  r: () => number;
  mix: Mix;
}

const human = (r: () => number, amount = 0.012) => (r() - 0.5) * 2 * amount;

/** Joue une grille d'accords (une mesure par accord, `beats` temps par mesure). */
function chordsLoop(
  prog: readonly string[],
  bpm: number,
  beats: number,
  duration: number,
  each: (chord: string, barStart: number, bar: number, beat: number) => void,
): void {
  const beat = 60 / bpm;
  const bar = beat * beats;
  for (let i = 0, t = 0.5; t < duration - bar; i++, t += bar) each(prog[i % prog.length] ?? 'C', t, i, beat);
}

// ---------------------------------------------------------------- les pistes

export interface TrackDef {
  id: string;
  title: { fr: string; en: string };
  seconds: number;
  seed: number;
  compose: (c: Ctx) => void | Promise<void>;
  reverb: number;
  decay: number;
  lofi?: boolean;
}

export const TRACKS: TrackDef[] = [
  {
    id: 'music:1',
    title: { fr: 'Aube', en: 'Dawn' },
    seconds: 136,
    seed: 11,
    reverb: 0.45,
    decay: 6,
    compose: ({ duration, r, mix }) => {
      const p = pad(mix.dry, -26, 800);
      const ep = epiano(mix.dry, -16);
      const prog = ['Dmaj9', 'Bm9', 'Gmaj9', 'A6'];
      chordsLoop(prog, 70, 4, duration, (ch, t, i, b) => {
        p.triggerAttackRelease(voicing(ch, 60).map(freq), b * 4.2, t, 0.5);
        // arpège doux, montant puis redescendant
        const v = voicing(ch, 67);
        const order = i % 2 === 0 ? [0, 1, 2, 3, 2, 1] : [1, 2, 3, 2, 1, 0];
        order.forEach((k, j) => {
          const n = v[k % v.length];
          if (n === undefined || r() < 0.12) return;
          ep.triggerAttackRelease(freq(n), b * 1.4, t + j * b * 0.66 + human(r), 0.35 + r() * 0.2);
        });
      });
    },
  },
  {
    id: 'music:2',
    title: { fr: 'Tesselles', en: 'Tesserae' },
    seconds: 132,
    seed: 22,
    reverb: 0.25,
    decay: 2.8,
    lofi: true,
    compose: ({ duration, r, mix }) => {
      const ep = epiano(mix.dry, -13);
      const bs = bass(mix.dry, -11);
      const dr = drums(mix.dry, -15);
      vinyl(mix.dry, duration, r);
      const prog = ['Fmaj9', 'Em7', 'Dm9', 'Cmaj7'];
      const swing = 0.06;
      chordsLoop(prog, 78, 4, duration, (ch, t, i, b) => {
        const v = voicing(ch, 62, true);
        // accords en « comping » syncopé
        ep.triggerAttackRelease(v.map(freq), b * 1.6, t + human(r, 0.02), 0.5);
        ep.triggerAttackRelease(v.slice(1).map(freq), b * 0.9, t + b * 2.5 + human(r, 0.02), 0.35);
        bs.triggerAttackRelease(freq(bassNote(ch, 38)), b * 1.5, t, 0.8);
        bs.triggerAttackRelease(freq(bassNote(ch, 38) + (r() < 0.5 ? 7 : 12)), b * 0.8, t + b * 2.5, 0.6);
        if (i < 2 || t > duration - 12) return; // intro et fin sans batterie
        for (let k = 0; k < 4; k++) {
          const at = t + k * b;
          if (k === 0 || (k === 2 && r() < 0.7))
            dr.kick.triggerAttackRelease('C1', 0.3, at + human(r, 0.006), 0.8);
          if (k === 1 || k === 3) dr.snare.triggerAttackRelease(0.16, at + human(r, 0.008), 0.5 + r() * 0.2);
          dr.hat.triggerAttackRelease(0.04, at + human(r, 0.005), 0.4);
          dr.hat.triggerAttackRelease(0.04, at + b * (0.5 + swing) + human(r, 0.005), 0.22);
        }
      });
    },
  },
  {
    id: 'music:3',
    title: { fr: 'Jardin', en: 'Garden' },
    seconds: 128,
    seed: 33,
    reverb: 0.4,
    decay: 4,
    compose: ({ duration, r, mix }) => {
      const m = mallet(mix.dry, -15);
      const sp = softPad(mix.dry, -25);
      const bs = bass(mix.dry, -16);
      const root = 7; // sol
      const scale = scaleNotes(root, PENTA, 67, 86);
      const prog = ['Gadd9', 'Em7', 'Cmaj7', 'D6'];
      let idx = Math.floor(scale.length / 2);
      chordsLoop(prog, 84, 4, duration, (ch, t, i, b) => {
        sp.triggerAttackRelease(voicing(ch, 58).map(freq), b * 4.1, t, 0.45);
        bs.triggerAttackRelease(freq(bassNote(ch, 43)), b * 3.5, t, 0.5);
        // mélodie pentatonique en pas conjoints, avec respirations
        for (let k = 0; k < 8; k++) {
          if (r() < (i % 4 === 3 ? 0.55 : 0.28)) continue;
          idx = Math.max(0, Math.min(scale.length - 1, idx + (r() < 0.5 ? -1 : 1) * (r() < 0.8 ? 1 : 2)));
          const n = scale[idx];
          if (n !== undefined)
            m.triggerAttackRelease(freq(n), b * 0.9, t + k * b * 0.5 + human(r, 0.01), 0.35 + r() * 0.3);
        }
      });
    },
  },
  {
    id: 'music:4',
    title: { fr: 'Nuage', en: 'Cloud' },
    seconds: 140,
    seed: 44,
    reverb: 0.7,
    decay: 9,
    compose: ({ duration, r, mix }) => {
      const p = pad(mix.dry, -22, 1100);
      const b2 = bell(mix.wet, -18);
      const prog = ['Ebmaj7s11', 'Cm9', 'Abmaj9', 'Bb6'];
      chordsLoop(prog, 48, 4, duration, (ch, t, _i, b) => {
        p.triggerAttackRelease(voicing(ch, 60, true).map(freq), b * 4.4, t, 0.6);
        // quelques éclats aigus, comme de la lumière entre les nuages
        const v = voicing(ch, 79);
        for (let k = 0; k < 3; k++) {
          if (r() < 0.45) continue;
          const n = v[Math.floor(r() * v.length)];
          if (n !== undefined) b2.triggerAttackRelease(freq(n), 3, t + r() * b * 4, 0.25 + r() * 0.2);
        }
      });
    },
  },
  {
    id: 'music:5',
    title: { fr: 'Atelier', en: 'Studio' },
    seconds: 130,
    seed: 55,
    reverb: 0.22,
    decay: 2.4,
    lofi: true,
    compose: ({ duration, r, mix }) => {
      const ep = epiano(mix.dry, -14);
      const bs = bass(mix.dry, -10);
      const dr = drums(mix.dry, -17);
      vinyl(mix.dry, duration, r);
      const prog = ['Am9', 'Dm9', 'Gmaj7', 'Cmaj9', 'Fmaj7', 'Bm7', 'E7', 'Am9'];
      const scale = scaleNotes(9, PENTA_MINOR, 69, 84);
      chordsLoop(prog, 72, 4, duration, (ch, t, i, b) => {
        const v = voicing(ch, 60, true);
        ep.triggerAttackRelease(v.map(freq), b * 3.6, t + human(r, 0.015), 0.42);
        bs.triggerAttackRelease(freq(bassNote(ch, 40)), b * 2.8, t, 0.75);
        // petite phrase au piano une mesure sur deux
        if (i % 2 === 1)
          for (let k = 0; k < 5; k++) {
            const n = scale[Math.floor(r() * scale.length)];
            if (n !== undefined && r() > 0.3)
              ep.triggerAttackRelease(freq(n), b * 0.7, t + b * (1 + k * 0.5) + human(r), 0.3 + r() * 0.2);
          }
        if (i < 2 || t > duration - 10) return;
        for (let k = 0; k < 4; k++) {
          const at = t + k * b;
          if (k === 0 || (k === 2 && r() < 0.5)) dr.kick.triggerAttackRelease('C1', 0.3, at, 0.7);
          if (k === 2) dr.snare.triggerAttackRelease(0.14, at + human(r, 0.01), 0.45);
          dr.hat.triggerAttackRelease(0.03, at + b * 0.55 + human(r, 0.006), 0.25);
        }
      });
    },
  },
  {
    id: 'music:6',
    title: { fr: 'Rivière', en: 'River' },
    seconds: 126,
    seed: 66,
    reverb: 0.35,
    decay: 3.5,
    compose: ({ duration, r, mix }) => {
      const m = mallet(mix.dry, -17);
      const sp = softPad(mix.dry, -26);
      const bs = bass(mix.dry, -17);
      const prog = ['Cmaj7', 'Am7', 'Fmaj9', 'G6'];
      // 6/8 : arpèges qui coulent en croches
      chordsLoop(prog, 96, 6, duration, (ch, t, i, b) => {
        sp.triggerAttackRelease(voicing(ch, 57).map(freq), b * 6.2, t, 0.4);
        bs.triggerAttackRelease(freq(bassNote(ch, 40)), b * 5, t, 0.5);
        const v = voicing(ch, 69);
        const pattern = [0, 2, 1, 3, 2, 1];
        pattern.forEach((k, j) => {
          const n = v[k % v.length];
          if (n !== undefined)
            m.triggerAttackRelease(
              freq(n + (j === 3 && i % 2 ? 12 : 0)),
              b * 0.8,
              t + j * b + human(r, 0.008),
              j === 0 ? 0.55 : 0.32,
            );
        });
      });
    },
  },
  {
    id: 'music:7',
    title: { fr: 'Veillée', en: 'Evening' },
    seconds: 134,
    seed: 77,
    reverb: 0.45,
    decay: 5,
    compose: ({ duration, r, mix }) => {
      const ep = epiano(mix.dry, -13);
      const sp = pad(mix.dry, -30, 700);
      const prog = ['Abmaj7', 'Fm9', 'Dbmaj9', 'Eb6', 'Cm7', 'Fm9', 'Bbm7', 'Eb6'];
      const scale = scaleNotes(8, PENTA, 68, 84);
      chordsLoop(prog, 60, 4, duration, (ch, t, _i, b) => {
        sp.triggerAttackRelease(voicing(ch, 55).map(freq), b * 4.2, t, 0.4);
        // main gauche : basse + accord brisé ; main droite : mélodie chantante
        const low = bassNote(ch, 44);
        ep.triggerAttackRelease(freq(low), b * 2, t, 0.45);
        voicing(ch, 58).forEach((n, k) => {
          ep.triggerAttackRelease(freq(n), b * 2.5, t + b * (0.5 + k * 0.25) + human(r), 0.28);
        });
        let k = 0;
        for (let s = 0; s < 3; s++) {
          const n = scale[Math.floor((0.3 + 0.4 * r()) * scale.length) + s - 1];
          k += 1 + Math.floor(r() * 2);
          if (n !== undefined && k < 4)
            ep.triggerAttackRelease(freq(n), b * 1.4, t + b * k * 0.9 + human(r, 0.02), 0.38 + r() * 0.15);
        }
      });
    },
  },
  {
    id: 'music:8',
    title: { fr: 'Constellation', en: 'Constellation' },
    seconds: 138,
    seed: 88,
    reverb: 0.75,
    decay: 10,
    compose: ({ duration, r, mix }) => {
      const b2 = bell(mix.dry, -17);
      const p = softPad(mix.dry, -21);
      const sub = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 3, decay: 1, sustain: 0.9, release: 5 },
      }).connect(mix.dry);
      sub.volume.value = -22;
      const prog = ['Emaj9', 'C#m9', 'Amaj7s11', 'B6'];
      const scale = scaleNotes(4, [0, 2, 4, 6, 7, 9, 11], 72, 91);
      chordsLoop(prog, 50, 4, duration, (ch, t, _i, b) => {
        p.triggerAttackRelease(voicing(ch, 62).map(freq), b * 4.2, t, 0.5);
        sub.triggerAttackRelease(freq(bassNote(ch, 34)), b * 4, t, 0.6);
        // étoiles : notes isolées, loin les unes des autres
        for (let k = 0; k < 4; k++) {
          if (r() < 0.4) continue;
          const n = scale[Math.floor(r() * scale.length)];
          if (n !== undefined) b2.triggerAttackRelease(freq(n), 4, t + r() * b * 4, 0.2 + r() * 0.25);
        }
      });
    },
  },
];

/** Rend une piste hors ligne (48 kHz stéréo), fondu d'entrée et de sortie compris. */
export async function renderTrack(def: TrackDef): Promise<AudioBuffer> {
  const buffer = await Tone.Offline(
    async () => {
      const mix = await mixBus({ reverb: def.reverb, decay: def.decay, ...(def.lofi && { lofi: true }) });
      await def.compose({ duration: def.seconds, r: rng(def.seed), mix });
    },
    def.seconds,
    2,
    48000,
  );
  const out = buffer.get();
  if (!out) throw new Error('Rendu vide');
  const fadeIn = 1.5 * 48000;
  const fadeOut = 6 * 48000;
  for (let c = 0; c < out.numberOfChannels; c++) {
    const d = out.getChannelData(c);
    for (let i = 0; i < fadeIn && i < d.length; i++) d[i] = (d[i] ?? 0) * (i / fadeIn);
    for (let i = 0; i < fadeOut && i < d.length; i++) {
      const k = d.length - 1 - i;
      d[k] = (d[k] ?? 0) * Math.sin(((i / fadeOut) * Math.PI) / 2);
    }
  }
  return out;
}
