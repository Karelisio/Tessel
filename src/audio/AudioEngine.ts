import { Melody } from './melody';
import { BANKS, renderBank, type BankSpec } from './synth';

export type Bus = 'music' | 'ambience' | 'sfx';

interface Voice {
  src: AudioBufferSourceNode;
  end: number;
}

class SfxBank {
  private readonly voices: Voice[] = [];
  private last = -Infinity;
  private lastVariant = -1;
  private readonly melody = new Melody();

  constructor(
    readonly spec: BankSpec,
    private readonly buffers: AudioBuffer[],
  ) {}

  play(
    ctx: AudioContext,
    out: AudioNode,
    opts: { gain?: number; semitones?: number; burst?: boolean },
  ): void {
    const now = ctx.currentTime;
    if (now - this.last < this.spec.minInterval) return;
    const sinceLast = now - this.last;
    this.last = now;

    // variante aléatoire, jamais deux fois la même d'affilée
    let v = Math.floor(Math.random() * this.buffers.length);
    if (v === this.lastVariant) v = (v + 1) % this.buffers.length;
    this.lastVariant = v;
    const buffer = this.buffers[v];
    if (!buffer) return;

    // limite de voix : on coupe la plus ancienne
    for (let i = this.voices.length - 1; i >= 0; i--)
      if ((this.voices[i]?.end ?? 0) <= now) this.voices.splice(i, 1);
    if (this.voices.length >= this.spec.maxVoices) {
      const oldest = this.voices.shift();
      try {
        oldest?.src.stop(now + 0.005);
      } catch {
        /* déjà arrêtée */
      }
    }

    const semis = (this.spec.melodic ? this.melody.next(now) : 0) + (opts.semitones ?? 0);
    const jitter = 1 + (Math.random() - 0.5) * 0.008;
    const rate = 2 ** (semis / 12) * jitter;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    // rafale douce : plus on enchaîne vite, plus c'est discret
    const burstDuck = opts.burst && sinceLast < 0.09 ? 0.55 + sinceLast * 5 : 1;
    const gainJitter = 1 + (Math.random() - 0.5) * 0.2;
    g.gain.value = this.spec.gain * (opts.gain ?? 1) * burstDuck * gainJitter;
    src.connect(g).connect(out);
    src.start(now);
    this.voices.push({ src, end: now + buffer.duration / rate });
  }
}

/**
 * Moteur audio maison : bus musique / ambiance / effets, limiteur doux sur le master,
 * banques d'effets à variantes avec limite de voix.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private readonly buses = new Map<Bus, GainNode>();
  private readonly banks = new Map<string, SfxBank>();
  private readonly volumes: Record<Bus, number> = { music: 0.6, ambience: 0.5, sfx: 0.8 };
  private loading: Promise<void> | null = null;

  /** À appeler depuis un geste utilisateur (politique d'autoplay). */
  unlock(): Promise<void> {
    if (this.loading) {
      void this.ctx?.resume();
      return this.loading;
    }
    this.loading = this.init();
    return this.loading;
  }

  private async init(): Promise<void> {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    limiter.connect(ctx.destination);
    for (const bus of ['music', 'ambience', 'sfx'] as const) {
      const g = ctx.createGain();
      g.gain.value = this.volumes[bus];
      g.connect(limiter);
      this.buses.set(bus, g);
    }
    const rendered = await Promise.all(BANKS.map(async (spec) => [spec, await renderBank(spec)] as const));
    for (const [spec, buffers] of rendered) this.banks.set(spec.id, new SfxBank(spec, buffers));
    await ctx.resume();
  }

  setVolume(bus: Bus, value: number): void {
    this.volumes[bus] = value;
    const g = this.buses.get(bus);
    if (g && this.ctx) g.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
  }

  play(bank: string, opts: { gain?: number; semitones?: number; burst?: boolean } = {}): void {
    const ctx = this.ctx;
    const out = this.buses.get('sfx');
    const b = this.banks.get(bank);
    if (!ctx || !out || !b || ctx.state !== 'running') return;
    b.play(ctx, out, opts);
  }

  async suspend(): Promise<void> {
    await this.ctx?.suspend();
  }

  async resume(): Promise<void> {
    await this.ctx?.resume();
  }
}
