import type { Bitset } from '@/content/progress';
import { Op, type JournalOp } from './codecs';
import type { ProgressStore } from './ProgressStore';

export interface AutoSaverOptions {
  /** Taille maximale d'un lot avant écriture immédiate. */
  maxOps: number;
  /** Délai maximal avant écriture d'un lot incomplet (ms). */
  maxDelayMs: number;
  /** Intervalle entre deux photos compactes de l'état (ms). */
  compactEveryMs: number;
  /** Au-delà de cette pause, le temps n'est plus compté comme temps de jeu (ms). */
  idleMs: number;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

const DEFAULTS: AutoSaverOptions = {
  maxOps: 64,
  maxDelayMs: 2000,
  compactEveryMs: 30_000,
  idleMs: 30_000,
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => {
    clearTimeout(h as ReturnType<typeof setTimeout>);
  },
};

/**
 * Sauvegarde continue : regroupe les poses en petits lots (64 poses ou 2 s), écrit les lots
 * dans l'ordre sans jamais bloquer le jeu, et prend régulièrement une photo compacte de l'état.
 */
export class AutoSaver {
  private readonly opts: AutoSaverOptions;
  private buffer: JournalOp[] = [];
  private filledDelta = 0;
  private timeMs = 0;
  private lastOpAt = -Infinity;
  private lastCompact: number;
  private timer: unknown = null;
  private chain: Promise<void> = Promise.resolve();
  /** Une écriture attend déjà dans la file : elle prendra les nouvelles poses. */
  private queued = false;
  private disposed = false;
  /** Temps de jeu actif compté (pauses de plus de `idleMs` exclues), pour la méta-progression. */
  onActiveTime: ((ms: number) => void) | null = null;
  onError: ((e: unknown) => void) | null = null;

  constructor(
    private readonly store: ProgressStore,
    readonly projectId: string,
    private readonly getFilled: () => Bitset,
    options: Partial<AutoSaverOptions> = {},
  ) {
    this.opts = { ...DEFAULTS, ...options };
    this.lastCompact = this.opts.now();
  }

  get pending(): number {
    return this.buffer.length;
  }

  record(op: Op, index: number): void {
    if (this.disposed) return;
    const now = this.opts.now();
    const gap = now - this.lastOpAt;
    if (gap > 0 && gap < this.opts.idleMs) {
      this.timeMs += gap;
      this.onActiveTime?.(gap);
    }
    this.lastOpAt = now;
    this.buffer.push({ op, index });
    this.filledDelta += op === Op.Place ? 1 : -1;
    if (this.buffer.length >= this.opts.maxOps) {
      void this.flush();
    } else if (this.timer === null) {
      this.timer = this.opts.setTimer(() => {
        this.timer = null;
        void this.flush();
      }, this.opts.maxDelayMs);
    }
  }

  /**
   * Écrit le lot en attente (les écritures sont sérialisées). Pendant une rafale (pot de peinture,
   * baguette), une seule écriture attend derrière celle en cours et emporte tout ce qui s'est accumulé.
   */
  flush(): Promise<void> {
    if (this.timer !== null) {
      this.opts.clearTimer(this.timer);
      this.timer = null;
    }
    if (this.queued) return this.chain;
    this.queued = true;
    this.chain = this.chain.then(async () => {
      this.queued = false;
      const ops = this.buffer;
      const delta = this.filledDelta;
      const time = this.timeMs;
      this.buffer = [];
      this.filledDelta = 0;
      this.timeMs = 0;
      const compactDue = this.opts.now() - this.lastCompact >= this.opts.compactEveryMs;
      try {
        await this.store.append(this.projectId, ops, delta, time);
        if (compactDue) {
          this.lastCompact = this.opts.now();
          await this.store.compact(this.projectId, this.getFilled());
        }
      } catch (e) {
        // on garde le lot pour la prochaine tentative, en tête de file
        this.buffer = [...ops, ...this.buffer];
        this.filledDelta += delta;
        this.timeMs += time;
        this.onError?.(e);
      }
    });
    return this.chain;
  }

  /** Écrit tout et prend une photo de l'état (mise en arrière-plan, fin d'œuvre, sortie). */
  async flushAndCompact(): Promise<void> {
    await this.flush();
    this.chain = this.chain.then(async () => {
      this.lastCompact = this.opts.now();
      await this.store.compact(this.projectId, this.getFilled());
    });
    await this.chain;
  }

  async dispose(): Promise<void> {
    await this.flushAndCompact();
    this.disposed = true;
  }
}
