import type { UnlockKey } from './catalog';
import type { Quest, QuestPeriod } from './quests';
import type { ItemKey } from './rewards';
import { INITIAL_STREAK, type StreakState } from './streak';
import type { DayKey } from './time';

export interface DayStats {
  cells: number;
  timeMs: number;
  completed: number;
}

/** Toute la méta-progression du joueur, en mémoire ; MetaStore la lit et l'écrit en base. */
export interface MetaState {
  xp: number;
  level: number;
  createdAt: number;
  inventory: Map<ItemKey, number>;
  unlocks: Map<UnlockKey, { at: number; seen: boolean }>;
  /** Succès obtenus → instant d'obtention. */
  achievements: Map<string, number>;
  /** Quêtes du jour et de la semaine en cours. */
  quests: Quest[];
  streak: StreakState;
  /** Compteurs et jauges (métriques), plus quelques clés internes préfixées par `_`. */
  stats: Map<string, number>;
  /** Statistiques par jour (au moins le jour courant). */
  days: Map<DayKey, DayStats>;
  /** Récompenses uniques déjà versées (départ, bonus de quêtes, remplacement du jour…). */
  claimed: Set<string>;
}

export function emptyState(createdAt: number): MetaState {
  return {
    xp: 0,
    level: 1,
    createdAt,
    inventory: new Map(),
    unlocks: new Map(),
    achievements: new Map(),
    quests: [],
    streak: { ...INITIAL_STREAK },
    stats: new Map(),
    days: new Map(),
    claimed: new Set(),
  };
}

/** Ce qui a changé depuis la dernière écriture. */
export class Dirty {
  player = false;
  streak = false;
  readonly inventory = new Set<ItemKey>();
  readonly unlocks = new Set<UnlockKey>();
  readonly achievements = new Set<string>();
  readonly quests = new Set<string>();
  /** Période → clé courante : les quêtes des autres clés sont supprimées. */
  readonly questPeriods = new Map<QuestPeriod, string>();
  readonly stats = new Set<string>();
  readonly days = new Set<DayKey>();
  readonly claimed = new Set<string>();
  /** Cases posées par couleur (rgb), à ajouter. */
  readonly colors = new Map<number, number>();

  get any(): boolean {
    return (
      this.player ||
      this.streak ||
      this.inventory.size > 0 ||
      this.unlocks.size > 0 ||
      this.achievements.size > 0 ||
      this.quests.size > 0 ||
      this.questPeriods.size > 0 ||
      this.stats.size > 0 ||
      this.days.size > 0 ||
      this.claimed.size > 0 ||
      this.colors.size > 0
    );
  }

  /** Transfère tout vers une copie (écriture en cours) et repart à vide. */
  take(): Dirty {
    const copy = new Dirty();
    copy.player = this.player;
    copy.streak = this.streak;
    const move = <T>(from: Set<T>, to: Set<T>) => {
      for (const v of from) to.add(v);
      from.clear();
    };
    move(this.inventory, copy.inventory);
    move(this.unlocks, copy.unlocks);
    move(this.achievements, copy.achievements);
    move(this.quests, copy.quests);
    move(this.stats, copy.stats);
    move(this.days, copy.days);
    move(this.claimed, copy.claimed);
    for (const [k, v] of this.questPeriods) copy.questPeriods.set(k, v);
    for (const [k, v] of this.colors) copy.colors.set(k, v);
    this.questPeriods.clear();
    this.colors.clear();
    this.player = false;
    this.streak = false;
    return copy;
  }

  /** Remet en attente une écriture échouée (les valeurs seront relues dans l'état). */
  restore(failed: Dirty): void {
    this.player ||= failed.player;
    this.streak ||= failed.streak;
    for (const v of failed.inventory) this.inventory.add(v);
    for (const v of failed.unlocks) this.unlocks.add(v);
    for (const v of failed.achievements) this.achievements.add(v);
    for (const v of failed.quests) this.quests.add(v);
    for (const v of failed.stats) this.stats.add(v);
    for (const v of failed.days) this.days.add(v);
    for (const v of failed.claimed) this.claimed.add(v);
    for (const [k, v] of failed.questPeriods) if (!this.questPeriods.has(k)) this.questPeriods.set(k, v);
    for (const [k, v] of failed.colors) this.colors.set(k, (this.colors.get(k) ?? 0) + v);
  }
}
