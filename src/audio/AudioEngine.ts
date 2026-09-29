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

export interface MusicTrack {
  id: string;
  file: string;
  title: { fr: string; en: string };
  seconds: number;
  samples: number;
}

interface AudioManifest {
  music: MusicTrack[];
  ambience: MusicTrack[];
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
    // musique et ambiance demandées avant le premier geste
    this.refreshBeds();
  }

  setVolume(bus: Bus, value: number): void {
    this.volumes[bus] = value;
    const g = this.buses.get(bus);
    if (g && this.ctx) g.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
    if (bus !== 'sfx') this.refreshBeds();
  }

  play(bank: string, opts: { gain?: number; semitones?: number; burst?: boolean } = {}): void {
    const ctx = this.ctx;
    const out = this.buses.get('sfx');
    const b = this.banks.get(bank);
    if (!ctx || !out || !b || ctx.state !== 'running') return;
    b.play(ctx, out, opts);
  }

  // ------------------------------------------------------------ musique et ambiances

  private music: { el: HTMLAudioElement; gain: GainNode; id: string } | null = null;
  private playlist: MusicTrack[] = [];
  private queue: string[] = [];
  private musicWanted = false;
  private ambience: { src: AudioBufferSourceNode; gain: GainNode; id: string } | null = null;
  private ambienceWanted: string | null = null;
  private manifest: Promise<AudioManifest> | null = null;

  private loadManifest(): Promise<AudioManifest> {
    this.manifest ??= fetch('audio/tracks.json')
      .then((r) => (r.ok ? (r.json() as Promise<AudioManifest>) : { music: [], ambience: [] }))
      .catch(() => ({ music: [], ambience: [] }));
    return this.manifest;
  }

  /**
   * Musique de fond : lecture en continu (fichiers, sans tout décoder en mémoire) des pistes données,
   * mélangées, avec fondu enchaîné. Liste vide ou volume nul : silence.
   */
  async setMusic(trackIds: readonly string[]): Promise<void> {
    const m = await this.loadManifest();
    this.playlist = m.music.filter((t) => trackIds.includes(t.id));
    this.musicWanted = this.playlist.length > 0;
    if (!this.musicWanted) this.fadeOutMusic();
    else if (!this.music) this.nextTrack();
    else if (!this.playlist.some((t) => t.id === this.music?.id)) this.nextTrack();
  }

  private nextTrack(): void {
    const ctx = this.ctx;
    const out = this.buses.get('music');
    if (!ctx || !out || !this.musicWanted || this.playlist.length === 0 || this.volumes.music <= 0) return;
    if (this.queue.length === 0) {
      this.queue = this.playlist.map((t) => t.id).sort(() => Math.random() - 0.5);
      // pas deux fois la même piste d'affilée
      if (this.queue[0] === this.music?.id && this.queue.length > 1)
        this.queue.push(this.queue.shift() ?? '');
    }
    const id = this.queue.shift();
    const track = this.playlist.find((t) => t.id === id);
    if (!track) return;
    this.fadeOutMusic();
    const el = new Audio(`audio/${track.file}`);
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain).connect(out);
    gain.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    const current = { el, gain, id: track.id };
    this.music = current;
    // enchaîne quelques secondes avant la fin
    el.addEventListener('timeupdate', () => {
      if (this.music === current && el.duration - el.currentTime < 4) this.nextTrack();
    });
    el.addEventListener('error', () => {
      if (this.music === current) this.music = null;
    });
    void el.play().catch(() => undefined);
  }

  private fadeOutMusic(): void {
    const m = this.music;
    const ctx = this.ctx;
    this.music = null;
    if (!m || !ctx) return;
    m.gain.gain.setTargetAtTime(0, ctx.currentTime, 1.2);
    setTimeout(() => {
      m.el.pause();
      m.el.src = '';
    }, 6000);
  }

  /** Ambiance en boucle sans couture (pluie, feu…), null pour aucune. */
  async setAmbience(id: string | null): Promise<void> {
    this.ambienceWanted = id;
    const ctx = this.ctx;
    const out = this.buses.get('ambience');
    if (this.ambience && this.ambience.id !== id) {
      const a = this.ambience;
      this.ambience = null;
      if (ctx) {
        a.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
        a.src.stop(ctx.currentTime + 4);
      }
    }
    if (!id || !ctx || !out || this.ambience?.id === id || this.volumes.ambience <= 0) return;
    const m = await this.loadManifest();
    const entry = m.ambience.find((a) => a.id === id);
    if (!entry) return;
    const data = await fetch(`audio/${entry.file}`).then((r) => r.arrayBuffer());
    const buffer = await ctx.decodeAudioData(data);
    if (this.ambienceWanted !== id || this.ambience) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = 0;
    // longueur exacte : le bourrage de fin d'encodage ne crée pas de trou dans la boucle
    src.loopEnd = Math.min(buffer.duration, entry.samples / 48000);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(out);
    gain.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
    src.start();
    this.ambience = { src, gain, id };
  }

  /** Réveille la musique et l'ambiance après un changement de volume (0 → audible). */
  private refreshBeds(): void {
    if (this.volumes.music <= 0) this.fadeOutMusic();
    else if (!this.music && this.musicWanted) this.nextTrack();
    if (this.volumes.ambience > 0 && this.ambienceWanted && !this.ambience)
      void this.setAmbience(this.ambienceWanted);
  }

  async suspend(): Promise<void> {
    await this.ctx?.suspend();
  }

  async resume(): Promise<void> {
    await this.ctx?.resume();
  }
}

/** Moteur audio unique de l'application (jeu, musique, ambiances). */
export const sharedAudio = new AudioEngine();
