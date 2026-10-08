import { lapEnd, nextQueue } from './playlist';

/** Piste en boucle exacte (manifeste audio). */
export interface LoopTrack {
  id: string;
  file: string;
  /** Longueur exacte de la boucle (échantillons à 48 kHz). */
  samples: number;
  /** Début de la boucle dans le son décodé (échantillons à 48 kHz). */
  offset?: number;
}

interface DeckHost {
  ctx(): AudioContext | null;
  out(): AudioNode | null;
  track(id: string): LoopTrack | undefined;
}

/** Une piste qui joue : source en boucle → fondus (relais) → coupure (changement brusque). */
interface Bed {
  id: string;
  src: AudioBufferSourceNode;
  fade: GainNode;
  kill: GainNode;
  /** Début de son premier tour (horloge audio). */
  t0: number;
  /** Durée d'un tour (s). */
  loop: number;
}

/** Fondu enchaîné entre deux pistes (s). */
const CROSSFADE = 8;
/** La piste suivante se décode tant d'avance sur la fin du tour (s). */
const PRELOAD = 35;
/** Fondu d'entrée de la première piste et des changements demandés (s). */
const FADE = 2.5;

/** Courbe à puissance constante (quart de sinus) : pas de creux au milieu d'un fondu enchaîné. */
function curve(rising: boolean): Float32Array {
  const n = 128;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * (Math.PI / 2);
    c[i] = rising ? Math.sin(x) : Math.cos(x);
  }
  return c;
}
const RISE = curve(true);
const FALL = curve(false);

/**
 * Lecteur de musique : chaque piste est une boucle exacte (tampon décodé, `loopStart`/`loopEnd` à
 * l'échantillon près) qui tourne sans couture. Avec plusieurs pistes cochées, la suivante se décode
 * en avance et prend le relais en fondu enchaîné à puissance constante, calé sur la fin d'un tour.
 * En mémoire : une piste décodée, deux le temps d'un relais.
 */
export class MusicDeck {
  private ids: string[] = [];
  private shuffle = true;
  private enabled = true;
  private queue: string[] = [];
  private readonly failed = new Set<string>();
  private bed: Bed | null = null;
  private incoming: { bed: Bed; at: number } | null = null;
  private next: { id: string; buffer: AudioBuffer | null } | null = null;
  private starting: string | null = null;
  private gen = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private playing: string | null = null;
  private readonly listeners = new Set<(id: string | null) => void>();

  constructor(private readonly host: DeckHost) {}

  /** Pistes cochées (dans l'ordre du catalogue) et mode de lecture. */
  set(ids: readonly string[], shuffle: boolean): void {
    const same =
      shuffle === this.shuffle && ids.length === this.ids.length && ids.every((id, i) => id === this.ids[i]);
    if (same) return;
    this.ids = [...ids];
    this.shuffle = shuffle;
    this.queue = [];
    if (this.next && !this.wanted().includes(this.next.id)) this.next = null;
    this.sync();
  }

  /** Volume nul : plus rien ne joue ni ne reste en mémoire. */
  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    this.sync();
  }

  /** Piste suivante tout de suite (fondu court). */
  skip(): void {
    const bed = this.bed;
    if (!bed || this.wanted().length < 2) return;
    this.cancelIncoming();
    this.next = null;
    void this.begin(this.take(bed.id), FADE);
  }

  /** Piste qu'on entend (null : aucune). */
  current(): string | null {
    return this.playing;
  }

  subscribe(fn: (id: string | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Met la lecture en accord avec la sélection (à rappeler quand le contexte audio s'ouvre). */
  sync(): void {
    const ctx = this.host.ctx();
    if (!ctx || !this.host.out()) return;
    const wanted = this.wanted();
    if (wanted.length === 0) {
      this.stopAll();
      return;
    }
    const bed = this.bed;
    if (!bed) {
      if (this.starting === null || !wanted.includes(this.starting)) void this.begin(this.take(null), FADE);
    } else if (!wanted.includes(bed.id)) {
      this.cancelIncoming();
      void this.begin(this.take(bed.id), FADE);
    } else if (this.incoming && (wanted.length < 2 || !wanted.includes(this.incoming.bed.id))) {
      // relais prévu devenu inutile : la piste en cours continue de boucler
      this.cancelIncoming();
    }
    this.ensureTimer();
  }

  private wanted(): string[] {
    if (!this.enabled) return [];
    return this.ids.filter((id) => !this.failed.has(id) && this.host.track(id) !== undefined);
  }

  /** Prochaine piste de la file (reconstruite si vide ou périmée). */
  private take(current: string | null): string {
    const wanted = this.wanted();
    if (this.queue.length === 0 || !this.queue.every((id) => wanted.includes(id)))
      this.queue = nextQueue(wanted, current, this.shuffle);
    if (!this.shuffle) this.queue = nextQueue(wanted, current, false);
    return this.queue.shift() ?? wanted[0] ?? '';
  }

  private async load(id: string): Promise<AudioBuffer | null> {
    const ctx = this.host.ctx();
    const track = this.host.track(id);
    if (!ctx || !track) return null;
    try {
      const data = await fetch(`audio/${track.file}`).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      });
      return await ctx.decodeAudioData(data);
    } catch (e) {
      console.warn('Musique illisible', id, e);
      this.failed.add(id);
      return null;
    }
  }

  private makeBed(id: string, buffer: AudioBuffer, at: number): Bed | null {
    const ctx = this.host.ctx();
    const out = this.host.out();
    const track = this.host.track(id);
    if (!ctx || !out || !track) return null;
    const offset = (track.offset ?? 0) / 48000;
    const loop = Math.min(track.samples / 48000, buffer.duration - offset);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    // boucle exacte : le bourrage de fin d'encodage n'est jamais joué
    src.loopStart = offset;
    src.loopEnd = offset + loop;
    const fade = ctx.createGain();
    fade.gain.value = 0;
    const kill = ctx.createGain();
    src.connect(fade).connect(kill).connect(out);
    src.start(at, offset);
    const bed: Bed = { id, src, fade, kill, t0: at, loop };
    src.onended = () => {
      kill.disconnect();
      if (this.bed === bed) this.bed = null;
    };
    return bed;
  }

  /** Démarre `id` dès qu'il est décodé ; ce qui joue s'efface en `fade` secondes. */
  private async begin(id: string, fade: number): Promise<void> {
    if (!id) return;
    const gen = ++this.gen;
    this.starting = id;
    const buffer = await this.load(id);
    if (gen !== this.gen) return;
    this.starting = null;
    const ctx = this.host.ctx();
    if (!ctx || !buffer || !this.wanted().includes(id)) {
      this.sync();
      return;
    }
    const at = ctx.currentTime + 0.05;
    this.cancelIncoming();
    this.next = null;
    if (this.bed) this.release(this.bed, at, fade);
    const bed = this.makeBed(id, buffer, at);
    if (!bed) return;
    bed.fade.gain.setValueCurveAtTime(RISE, at, fade);
    this.bed = bed;
    this.ensureTimer();
    this.setPlaying(id);
  }

  /** Coupe une piste en douceur (indépendamment de ses fondus en cours). */
  private release(bed: Bed, at: number, fade: number): void {
    bed.kill.gain.setValueAtTime(bed.kill.gain.value, at);
    bed.kill.gain.linearRampToValueAtTime(0, at + fade);
    try {
      bed.src.stop(at + fade + 0.05);
    } catch {
      /* déjà arrêtée */
    }
    if (this.bed === bed) this.bed = null;
  }

  /** Annule un relais programmé qui n'a pas commencé ; la piste en cours reste à plein volume. */
  private cancelIncoming(): void {
    const inc = this.incoming;
    if (!inc) return;
    this.incoming = null;
    try {
      inc.bed.src.stop();
    } catch {
      /* pas encore démarrée */
    }
    inc.bed.kill.disconnect();
    this.bed?.fade.gain.cancelScheduledValues(inc.at);
  }

  private stopAll(): void {
    this.gen++;
    this.starting = null;
    this.next = null;
    this.cancelIncoming();
    const ctx = this.host.ctx();
    if (this.bed && ctx) this.release(this.bed, ctx.currentTime, 1.5);
    this.bed = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.setPlaying(null);
  }

  private ensureTimer(): void {
    this.timer ??= setInterval(() => {
      this.tick();
    }, 500);
  }

  /** Horloge du lecteur : relais en fin de tour, décodage anticipé, piste affichée. */
  private tick(): void {
    const ctx = this.host.ctx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const inc = this.incoming;
    if (inc && now >= inc.at) {
      // le fondu enchaîné a commencé : la nouvelle piste devient la piste en cours
      const old = this.bed;
      this.incoming = null;
      this.bed = inc.bed;
      if (old) {
        try {
          old.src.stop(inc.at + CROSSFADE + 0.05);
        } catch {
          /* déjà arrêtée */
        }
      }
      this.setPlaying(inc.bed.id);
    }
    const bed = this.bed;
    if (!bed) {
      if (this.starting === null && this.wanted().length > 0) this.sync();
      return;
    }
    const wanted = this.wanted();
    // une seule piste : elle boucle sans fin, rien à prévoir
    if (wanted.length < 2 || this.incoming) return;
    const end = lapEnd(bed.t0, bed.loop, now, CROSSFADE + 1);
    if (!this.next && end - now < PRELOAD) {
      const id = this.take(bed.id);
      if (id && id !== bed.id) {
        const next = { id, buffer: null as AudioBuffer | null };
        this.next = next;
        void this.load(id).then((buffer) => {
          next.buffer = buffer;
          if (!buffer && this.next === next) this.next = null;
        });
      }
    }
    const next = this.next;
    if (next?.buffer && wanted.includes(next.id) && end - now < CROSSFADE + 3) {
      const at = end - CROSSFADE;
      const nb = this.makeBed(next.id, next.buffer, at);
      this.next = null;
      if (!nb) return;
      nb.fade.gain.setValueCurveAtTime(RISE, at, CROSSFADE);
      bed.fade.gain.setValueCurveAtTime(FALL, at, CROSSFADE);
      this.incoming = { bed: nb, at };
    }
  }

  private setPlaying(id: string | null): void {
    if (id === this.playing) return;
    this.playing = id;
    for (const fn of this.listeners) fn(id);
  }
}
