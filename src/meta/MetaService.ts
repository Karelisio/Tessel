import { CATEGORY_IDS, type CategoryId } from '@/content/categories';
import { hashString } from '@/content/random';
import type { DbDriver } from '@/db/driver';
import type { ProjectCounter, ProjectSource } from '@/db/ProgressStore';
import { MODE_IDS, type ModeId } from '@/modes/types';
import { achievementRewards, indexByMetric, reached, type AchievementDef } from './achievements';
import { ACHIEVEMENTS } from './achievements.data';
import { STARTER_UNLOCKS, unlockKind, type UnlockKey, type UnlockKind } from './catalog';
import { chestContents } from './chests';
import { cellXpRate, completionXp, DISCOVERY, levelInfo, totalXpForLevel, type LevelInfo } from './levels';
import { SIZE, type CounterMetric, type GaugeMetric, type Metric, type SecretId } from './metrics';
import { MetaStore } from './MetaStore';
import {
  advanceQuests,
  generateQuests,
  PERIOD_BONUS,
  questRewards,
  rerollQuest,
  type Quest,
  type QuestContext,
  type QuestPeriod,
  type QuestTemplate,
} from './quests';
import { QUEST_TEMPLATES } from './quests.data';
import {
  chestItem,
  reward,
  STARTING_TOOLS,
  TOOL_IDS,
  toolItem,
  type ChestSize,
  type ItemKey,
  type Reward,
  type ToolId,
} from './rewards';
import { completionSecrets, daySecrets, hourSecrets, SECRET_RULES } from './secrets';
import { Dirty, emptyState, type DayStats, type MetaState } from './state';
import {
  displayedStreak,
  milestoneRewards,
  STREAK,
  streakDayXp,
  streakStatus,
  validateDay,
  type StreakStatus,
  type StreakUpdate,
} from './streak';
import type { I18nText } from '@/i18n/text';
import { dayKey, weekOf, systemClock, type DayKey, type MetaClock } from './time';
import { levelRewards } from './unlocks';

/** Événements montrés au joueur (toasts, cartes de déblocage, coffres…). */
export type MetaNotice =
  | { type: 'levelUp'; level: number; rewards: Reward[] }
  | { type: 'achievement'; def: AchievementDef; rewards: Reward[] }
  | { type: 'quest'; quest: Quest; rewards: Reward[] }
  | { type: 'questsAll'; period: QuestPeriod; rewards: Reward[] }
  | { type: 'streak'; update: StreakUpdate; rewards: Reward[] }
  | { type: 'collection'; name: I18nText; event: boolean; rewards: Reward[] };

/** Ce que la méta-progression doit savoir d'une partie. */
export interface ArtworkContext {
  projectId: string;
  artworkId: string;
  mode: ModeId;
  source: ProjectSource;
  category: CategoryId | null;
  /** Cases à poser (hors cases transparentes). */
  cells: number;
  colors: number;
  /** Début de la partie (succès « patience »). */
  startedAt: number;
  /** Cases déjà posées à l'ouverture. */
  filled: number;
  /** Compteurs déjà enregistrés pour cette partie. */
  undos: number;
  errors: number;
  tools: number;
  /** Œuvre d'un événement saisonnier. */
  eventId?: string;
}

export interface MetaServiceOptions {
  clock?: MetaClock;
  achievements?: readonly AchievementDef[];
  templates?: readonly QuestTemplate[];
  /** Catégories qui ont du contenu jouable (les quêtes n'en proposent pas d'autres). */
  categoryAvailable?: (c: CategoryId) => boolean;
  /** Délai d'écriture après une modification (ms). */
  saveDelayMs?: number;
  /** Délai de regroupement des notifications de changement d'état (ms). */
  changeDelayMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

const PLAYTIME_MS = '_playtime.ms';

/**
 * Méta-progression : XP et niveaux, déblocages, inventaire, série, quêtes, succès, statistiques.
 * Tout se calcule en mémoire (instantané pendant le jeu) et s'écrit en base par petits lots.
 */
export class MetaService {
  private readonly clock: MetaClock;
  private readonly templates: readonly QuestTemplate[];
  private readonly achievementIndex: Map<Metric, AchievementDef[]>;
  private readonly unlockedAchievements: Set<string>;
  private readonly categoryAvailable: (c: CategoryId) => boolean;
  private readonly dirty = new Dirty();
  private readonly notices = new Set<(n: MetaNotice) => void>();
  private readonly listeners = new Set<() => void>();
  private readonly opts: Required<Pick<MetaServiceOptions, 'saveDelayMs' | 'changeDelayMs'>> &
    Pick<MetaServiceOptions, 'setTimer' | 'clearTimer'>;
  private today: DayKey = '';
  private dayEndsAt = -Infinity;
  private xpFraction = 0;
  private saveTimer: unknown = null;
  private changeTimer: unknown = null;
  private saving: Promise<void> = Promise.resolve();

  private constructor(
    private readonly state: MetaState,
    private readonly store: MetaStore | null,
    options: MetaServiceOptions,
  ) {
    this.clock = options.clock ?? systemClock;
    this.templates = options.templates ?? QUEST_TEMPLATES;
    this.achievementIndex = indexByMetric(options.achievements ?? ACHIEVEMENTS);
    this.unlockedAchievements = new Set(state.achievements.keys());
    this.categoryAvailable = options.categoryAvailable ?? (() => true);
    this.opts = {
      saveDelayMs: options.saveDelayMs ?? 2000,
      changeDelayMs: options.changeDelayMs ?? 150,
      ...(options.setTimer && { setTimer: options.setTimer }),
      ...(options.clearTimer && { clearTimer: options.clearTimer }),
    };
    this.init();
  }

  /** Charge la progression depuis la base (sauvegarde automatique). */
  static async open(db: DbDriver, options: MetaServiceOptions = {}): Promise<MetaService> {
    const store = new MetaStore(db);
    const state = await store.load();
    return new MetaService(state, store, {
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => {
        clearTimeout(h as ReturnType<typeof setTimeout>);
      },
      ...options,
    });
  }

  /** Progression en mémoire seulement (simulation d'équilibrage, tests, parties éphémères). */
  static inMemory(options: MetaServiceOptions = {}, state?: MetaState): MetaService {
    const clock = options.clock ?? systemClock;
    return new MetaService(state ?? emptyState(clock.now()), null, options);
  }

  // --- Lecture ------------------------------------------------------------------

  get xp(): number {
    return this.state.xp;
  }

  get level(): number {
    return this.state.level;
  }

  get levelInfo(): LevelInfo {
    return levelInfo(this.state.xp);
  }

  get createdAt(): number {
    return this.state.createdAt;
  }

  /** Jour courant selon l'horloge de la méta-progression (date forcée en debug). */
  get day(): DayKey {
    this.rollover();
    return this.today;
  }

  /** Graine propre au joueur (quêtes, coffres). */
  get playerSeed(): number {
    return hashString(`tessel:${this.state.createdAt}`);
  }

  tools(tool: ToolId): number {
    return this.state.inventory.get(toolItem(tool)) ?? 0;
  }

  chests(size: ChestSize): number {
    return this.state.inventory.get(chestItem(size)) ?? 0;
  }

  get freezes(): number {
    return this.state.streak.freezes;
  }

  get streak(): { current: number; best: number; status: StreakStatus; todayCells: number } {
    this.rollover();
    return {
      current: displayedStreak(this.state.streak, this.today),
      best: this.state.streak.best,
      status: streakStatus(this.state.streak, this.today),
      todayCells: this.todayStats().cells,
    };
  }

  quests(period?: QuestPeriod): readonly Quest[] {
    this.rollover();
    return period ? this.state.quests.filter((q) => q.period === period) : this.state.quests;
  }

  get canReroll(): boolean {
    this.rollover();
    return !this.state.claimed.has(`reroll:${this.today}`);
  }

  stat(metric: Metric): number {
    return this.state.stats.get(metric) ?? 0;
  }

  isUnlocked(key: UnlockKey): boolean {
    return this.state.unlocks.has(key);
  }

  unlocked(kind: UnlockKind): UnlockKey[] {
    return [...this.state.unlocks.keys()].filter((k) => unlockKind(k) === kind);
  }

  /** Nouveautés pas encore vues (pastilles « nouveau » de l'interface). */
  unseen(): UnlockKey[] {
    return [...this.state.unlocks].filter(([, u]) => !u.seen).map(([k]) => k);
  }

  get unlockedModes(): ModeId[] {
    return MODE_IDS.filter((m) => this.state.unlocks.has(`mode:${m}`));
  }

  get unlockedCategories(): CategoryId[] {
    return CATEGORY_IDS.filter((c) => this.state.unlocks.has(`category:${c}`));
  }

  achievementUnlockedAt(id: string): number | undefined {
    return this.state.achievements.get(id);
  }

  get achievementCount(): number {
    return this.state.achievements.size;
  }

  /** Historique quotidien (cases, temps, œuvres), du plus récent au plus ancien. */
  async dailyHistory(
    limit = 30,
  ): Promise<{ day: string; cells: number; timeMs: number; completed: number }[]> {
    await this.flush();
    const rows = (await this.store?.dailyHistory(limit)) ?? [];
    return rows.map((r) => ({ day: r.day, cells: r.cells, timeMs: r.time_ms, completed: r.completed }));
  }

  /** Couleurs les plus posées (rgb 0xRRGGBB). */
  async favoriteColors(limit = 8): Promise<{ rgb: number; cells: number }[]> {
    await this.flush();
    return (await this.store?.favoriteColors(limit)) ?? [];
  }

  // --- Abonnements -----------------------------------------------------------------

  /** Événements à montrer (niveau, succès, quêtes, série). */
  onNotice(l: (n: MetaNotice) => void): () => void {
    this.notices.add(l);
    return () => this.notices.delete(l);
  }

  /** État modifié (notifications regroupées : au plus une toutes les ~150 ms). */
  subscribe(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  // --- Jeu ---------------------------------------------------------------------------

  startArtwork(ctx: ArtworkContext, completedColors: Iterable<number> = []): ArtworkTracker {
    return new ArtworkTracker(this, ctx, completedColors);
  }

  /** @internal cases nouvellement posées (au-delà du maximum déjà atteint dans la partie). */
  cellsPlaced(n: number, ctx: ArtworkContext): void {
    if (n <= 0) return;
    const now = this.clock.now();
    this.rollover(now);
    const discovery = this.stat(`artworks.mode.${ctx.mode}`) < DISCOVERY.artworks;
    this.bump('cells', n);
    this.bump(`cells.mode.${ctx.mode}`, n);
    this.xpFraction += n * cellXpRate(ctx.cells, discovery);
    const whole = Math.floor(this.xpFraction);
    if (whole > 0) {
      this.xpFraction -= whole;
      this.addXp(whole);
    }
    const day = this.todayStats();
    const before = day.cells;
    day.cells += n;
    this.dirty.days.add(this.today);
    if (before < STREAK.cellsToValidate && day.cells >= STREAK.cellsToValidate) this.validateToday();
    for (const s of hourSecrets(new Date(now).getHours())) this.secret(s);
    this.touched();
  }

  /** @internal une couleur de l'œuvre vient d'être terminée. */
  colorCompleted(rgb: number, cells: number): void {
    this.rollover();
    this.bump('colors');
    this.dirty.colors.set(rgb, (this.dirty.colors.get(rgb) ?? 0) + cells);
    this.touched();
  }

  /** @internal temps de coloriage actif (pauses exclues). */
  playtime(ms: number): void {
    if (ms <= 0) return;
    this.rollover();
    const total = (this.state.stats.get(PLAYTIME_MS) ?? 0) + ms;
    const before = Math.floor((total - ms) / 60_000);
    this.state.stats.set(PLAYTIME_MS, total);
    this.dirty.stats.add(PLAYTIME_MS);
    const minutes = Math.floor(total / 60_000) - before;
    if (minutes > 0) this.bump('playtime.minutes', minutes);
    const day = this.todayStats();
    day.timeMs += ms;
    this.dirty.days.add(this.today);
    if (day.timeMs >= SECRET_RULES.marathonMs) this.secret('marathon');
    this.touched();
  }

  /** @internal œuvre terminée : compteurs, secrets et prime de fin. Renvoie la prime d'XP. */
  artworkCompleted(
    ctx: ArtworkContext,
    counters: Readonly<Record<ProjectCounter, number>>,
    completedModes: number,
  ): number {
    const now = this.clock.now();
    this.rollover(now);
    this.bump('artworks');
    this.bump(`artworks.mode.${ctx.mode}`);
    if (ctx.category) {
      this.bump(`artworks.category.${ctx.category}`);
      this.gauge('categories', CATEGORY_IDS.filter((c) => this.stat(`artworks.category.${c}`) > 0).length);
    }
    if (ctx.cells >= SIZE.large) this.bump('artworks.size.large');
    if (ctx.cells >= SIZE.huge) this.bump('artworks.size.huge');
    if (ctx.source === 'photo') this.bump('artworks.photo');
    if (ctx.source === 'daily') this.bump('artworks.daily');
    if (ctx.source === 'creation') this.bump('artworks.creation');
    if (ctx.eventId !== undefined) this.bump('artworks.event');
    this.gauge('modes.completed', MODE_IDS.filter((m) => this.stat(`artworks.mode.${m}`) > 0).length);
    this.todayStats().completed++;
    this.dirty.days.add(this.today);
    for (const s of completionSecrets({
      cells: ctx.cells,
      colors: ctx.colors,
      ...counters,
      completedModes,
      startedAt: ctx.startedAt,
      now,
    }))
      this.secret(s);
    const bonus = completionXp(ctx.cells);
    this.addXp(bonus);
    this.touched();
    return bonus;
  }

  /** Consomme un outil s'il y en a un. */
  consumeTool(tool: ToolId): boolean {
    this.rollover();
    const key = toolItem(tool);
    const n = this.state.inventory.get(key) ?? 0;
    if (n <= 0) return false;
    this.state.inventory.set(key, n - 1);
    this.dirty.inventory.add(key);
    this.bump('tools');
    this.bump(`tools.${tool}`);
    this.touched();
    return true;
  }

  /** Ouvre un coffre : contenu tiré de façon déterministe, versé aussitôt. */
  openChest(size: ChestSize): Reward[] | null {
    this.rollover();
    const key = chestItem(size);
    const n = this.state.inventory.get(key) ?? 0;
    if (n <= 0) return null;
    this.state.inventory.set(key, n - 1);
    this.dirty.inventory.add(key);
    const seed = hashString(`chest|${size}|${this.stat('chests')}|${this.playerSeed}`);
    const contents = chestContents(size, seed, this.state.level);
    this.bump('chests');
    this.grant(contents);
    this.touched();
    return contents;
  }

  /** Remplace une quête non accomplie (une fois par jour). */
  rerollQuest(id: string): Quest | null {
    if (!this.canReroll) return null;
    const quest = this.state.quests.find((q) => q.id === id);
    if (!quest || quest.doneAt !== null) return null;
    const active = this.state.quests.filter((q) => q.period === quest.period);
    const next = rerollQuest(quest, active, this.questContext(), this.templates, 0);
    if (!next) return null;
    this.state.quests = this.state.quests.map((q) => (q.id === id ? next : q));
    this.dirty.quests.add(id);
    this.claim(`reroll:${this.today}`);
    this.touched();
    return next;
  }

  /** Compteur alimenté par l'interface (photo importée, partage, timelapse regardé…). */
  record(metric: CounterMetric, delta = 1): void {
    this.rollover();
    this.bump(metric, delta);
    this.touched();
  }

  /** Jauge alimentée par l'interface (nombre de murs de galerie…). */
  setGauge(metric: GaugeMetric, value: number): void {
    this.rollover();
    this.gauge(metric, value);
    this.touched();
  }

  /**
   * Collection terminée (thématique ou d'événement) : récompense versée une seule fois par clé,
   * compteur et notification. Renvoie false si elle l'était déjà.
   */
  completeCollection(key: string, name: I18nText, rewards: readonly Reward[], event: boolean): boolean {
    this.rollover();
    if (!this.claim(key)) return false;
    this.emit({ type: 'collection', name, event, rewards: [...rewards] });
    this.bump(event ? 'events.collections' : 'collections');
    this.grant(rewards);
    this.touched();
    return true;
  }

  /** Récompense unique (collection terminée…) : versée une seule fois par clé. */
  grantOnce(key: string, rewards: readonly Reward[]): boolean {
    if (!this.claim(key)) return false;
    this.grant(rewards);
    this.touched();
    return true;
  }

  markSeen(keys: readonly UnlockKey[]): void {
    for (const k of keys) {
      const u = this.state.unlocks.get(k);
      if (u && !u.seen) {
        u.seen = true;
        this.dirty.unlocks.add(k);
      }
    }
    this.touched();
  }

  // --- Debug ---------------------------------------------------------------------------

  debugGrant(rewards: readonly Reward[]): void {
    this.rollover();
    this.grant(rewards);
    this.touched();
  }

  /** Après un changement de date forcé : reprend le jour et les quêtes. */
  refresh(): void {
    this.dayEndsAt = -Infinity;
    this.rollover();
    this.touched();
  }

  // --- Persistance -------------------------------------------------------------------

  /** Écrit tout ce qui a changé (mise en arrière-plan, sortie d'écran). */
  flush(): Promise<void> {
    if (this.saveTimer !== null) {
      this.opts.clearTimer?.(this.saveTimer);
      this.saveTimer = null;
    }
    const store = this.store;
    if (!store || !this.dirty.any) return this.saving;
    const batch = this.dirty.take();
    this.saving = this.saving.then(async () => {
      try {
        await store.save(this.state, batch, this.clock.now());
      } catch (e) {
        this.dirty.restore(batch);
        console.error('Sauvegarde de la progression impossible', e);
      }
    });
    return this.saving;
  }

  // --- Interne -------------------------------------------------------------------------

  private init(): void {
    if (!this.state.claimed.has('starter')) {
      const now = this.clock.now();
      for (const key of STARTER_UNLOCKS) {
        this.state.unlocks.set(key, { at: now, seen: true });
        this.dirty.unlocks.add(key);
      }
      for (const tool of TOOL_IDS) this.addItem(toolItem(tool), STARTING_TOOLS[tool]);
      this.claim('starter');
      this.gauge('level', this.state.level);
      this.gauge('modes.unlocked', this.unlockedModes.length);
    }
    this.rollover();
  }

  /** Changement de jour : nouvelles statistiques du jour, nouvelles quêtes. */
  private rollover(now = this.clock.now()): void {
    if (now < this.dayEndsAt) return;
    const date = new Date(now);
    this.today = dayKey(date);
    this.dayEndsAt = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    this.ensureQuests('daily', this.today);
    this.ensureQuests('weekly', weekOf(this.today));
  }

  private ensureQuests(period: QuestPeriod, key: string): void {
    if (this.state.quests.some((q) => q.period === period && q.periodKey === key)) return;
    const fresh = generateQuests(period, key, this.questContext(), this.templates);
    this.state.quests = [...this.state.quests.filter((q) => q.period !== period), ...fresh];
    this.dirty.questPeriods.set(period, key);
    for (const q of fresh) this.dirty.quests.add(q.id);
  }

  private questContext(): QuestContext {
    return {
      level: this.state.level,
      modes: this.unlockedModes,
      categories: this.unlockedCategories.filter(this.categoryAvailable),
      stat: (m) => this.stat(m),
      seed: this.playerSeed,
    };
  }

  private todayStats(): DayStats {
    let d = this.state.days.get(this.today);
    if (!d) {
      d = { cells: 0, timeMs: 0, completed: 0 };
      this.state.days.set(this.today, d);
      // on ne garde en mémoire que le jour courant et la veille
      for (const k of [...this.state.days.keys()].sort().slice(0, -2)) this.state.days.delete(k);
    }
    return d;
  }

  private validateToday(): void {
    const u = validateDay(this.state.streak, this.today);
    if (!u.validated) return;
    this.state.streak = u.state;
    this.dirty.streak = true;
    const rewards: Reward[] = [reward.xp(streakDayXp(u.state.current))];
    if (u.freezeOverflow) rewards.push(reward.xp(STREAK.overflowXp));
    if (u.milestone !== null) rewards.push(...milestoneRewards(u.milestone));
    this.emit({ type: 'streak', update: u, rewards });
    this.bump('days');
    if (u.freezesUsed > 0) this.bump('freezes.used', u.freezesUsed);
    this.gauge('streak.best', u.state.best);
    for (const s of daySecrets(this.today, this.state.createdAt)) this.secret(s);
    this.grant(rewards);
  }

  private bump(metric: CounterMetric, delta = 1): void {
    if (delta <= 0) return;
    const value = (this.state.stats.get(metric) ?? 0) + delta;
    this.state.stats.set(metric, value);
    this.dirty.stats.add(metric);
    this.checkAchievements(metric, value);
    const quests = this.state.quests;
    for (const q of quests) if (q.metric === metric && q.doneAt === null) this.dirty.quests.add(q.id);
    for (const q of advanceQuests(quests, metric, delta, this.clock.now())) this.questDone(q);
  }

  private gauge(metric: GaugeMetric, value: number): void {
    if (value <= (this.state.stats.get(metric) ?? 0)) return;
    this.state.stats.set(metric, value);
    this.dirty.stats.add(metric);
    this.checkAchievements(metric, value);
  }

  private secret(id: SecretId): void {
    this.gauge(`secret.${id}`, 1);
  }

  private checkAchievements(metric: Metric, value: number): void {
    const now = this.clock.now();
    for (const def of reached(this.achievementIndex.get(metric), value, this.unlockedAchievements)) {
      this.unlockedAchievements.add(def.id);
      this.state.achievements.set(def.id, now);
      this.dirty.achievements.add(def.id);
      const rewards = achievementRewards(def);
      this.emit({ type: 'achievement', def, rewards });
      this.grant(rewards);
    }
  }

  private questDone(q: Quest): void {
    const rewards = questRewards(q.slot, this.state.level);
    this.emit({ type: 'quest', quest: q, rewards });
    this.grant(rewards);
    this.bump(q.period === 'daily' ? 'quests.daily' : 'quests.weekly');
    const siblings = this.state.quests.filter((x) => x.period === q.period && x.periodKey === q.periodKey);
    if (
      siblings.length >= 3 &&
      siblings.every((x) => x.doneAt !== null) &&
      this.claim(`quests:${q.periodKey}`)
    ) {
      const bonus = [...PERIOD_BONUS[q.period]];
      this.emit({ type: 'questsAll', period: q.period, rewards: bonus });
      this.grant(bonus);
    }
  }

  private addXp(amount: number): void {
    if (amount <= 0) return;
    this.state.xp += amount;
    this.dirty.player = true;
    while (this.state.xp >= totalXpForLevel(this.state.level + 1)) {
      this.state.level++;
      const rewards = levelRewards(this.state.level);
      this.emit({ type: 'levelUp', level: this.state.level, rewards });
      this.gauge('level', this.state.level);
      this.grant(rewards);
    }
  }

  private grant(rewards: readonly Reward[]): void {
    for (const r of rewards) {
      switch (r.kind) {
        case 'xp':
          this.addXp(r.amount);
          break;
        case 'tool':
          this.addItem(toolItem(r.tool), r.count);
          break;
        case 'chest':
          this.addItem(chestItem(r.size), r.count);
          break;
        case 'freeze': {
          const s = this.state.streak;
          const added = Math.min(Math.max(0, STREAK.maxFreezes - s.freezes), r.count);
          s.freezes += added;
          this.dirty.streak = true;
          // réserve pleine : le joker devient de l'XP
          if (r.count > added) this.addXp((r.count - added) * STREAK.overflowXp);
          break;
        }
        case 'unlock':
          this.unlock(r.key);
          break;
      }
    }
  }

  private addItem(item: ItemKey, count: number): void {
    this.state.inventory.set(item, (this.state.inventory.get(item) ?? 0) + count);
    this.dirty.inventory.add(item);
  }

  private unlock(key: UnlockKey): void {
    if (this.state.unlocks.has(key)) return;
    this.state.unlocks.set(key, { at: this.clock.now(), seen: false });
    this.dirty.unlocks.add(key);
    if (unlockKind(key) === 'mode') this.gauge('modes.unlocked', this.unlockedModes.length);
  }

  private claim(key: string): boolean {
    if (this.state.claimed.has(key)) return false;
    this.state.claimed.add(key);
    this.dirty.claimed.add(key);
    return true;
  }

  private emit(n: MetaNotice): void {
    for (const l of this.notices) l(n);
  }

  /** Après chaque modification : écriture différée et notification regroupée. */
  private touched(): void {
    const { setTimer } = this.opts;
    if (!setTimer) {
      for (const l of this.listeners) l();
      return;
    }
    if (this.store && this.saveTimer === null && this.dirty.any) {
      this.saveTimer = setTimer(() => {
        this.saveTimer = null;
        void this.flush();
      }, this.opts.saveDelayMs);
    }
    if (this.changeTimer === null && this.listeners.size > 0) {
      this.changeTimer = setTimer(() => {
        this.changeTimer = null;
        for (const l of this.listeners) l();
      }, this.opts.changeDelayMs);
    }
  }
}

/**
 * Suivi d'une partie pour la méta-progression. Seules les cases posées au-delà du maximum
 * déjà atteint comptent : annuler puis reposer ne rapporte rien de plus.
 */
export class ArtworkTracker {
  private highWater: number;
  private readonly colorsDone: Set<number>;
  private readonly counters: Record<ProjectCounter, number>;
  private done = false;
  /** Un compteur de la partie a changé (à écrire avec le projet). */
  onCounter: ((c: ProjectCounter) => void) | null = null;

  constructor(
    private readonly meta: MetaService,
    readonly ctx: ArtworkContext,
    completedColors: Iterable<number>,
  ) {
    this.highWater = ctx.filled;
    this.colorsDone = new Set(completedColors);
    this.counters = { undos: ctx.undos, errors: ctx.errors, tools: ctx.tools };
    this.done = ctx.filled >= ctx.cells;
  }

  progress(filled: number): void {
    if (filled <= this.highWater) return;
    const n = filled - this.highWater;
    this.highWater = filled;
    this.meta.cellsPlaced(n, this.ctx);
  }

  colorDone(color: number, rgb: number, cells: number): void {
    if (this.colorsDone.has(color)) return;
    this.colorsDone.add(color);
    this.meta.colorCompleted(rgb, cells);
  }

  count(counter: ProjectCounter): void {
    this.counters[counter]++;
    this.onCounter?.(counter);
  }

  activeTime(ms: number): void {
    this.meta.playtime(ms);
  }

  /** Œuvre terminée ; renvoie la prime d'XP (0 si déjà comptée). */
  complete(completedModes: number): number {
    if (this.done) return 0;
    this.done = true;
    return this.meta.artworkCompleted(this.ctx, this.counters, completedModes);
  }

  /** La partie repart de zéro. */
  restart(): void {
    this.highWater = 0;
    this.colorsDone.clear();
    this.counters.undos = 0;
    this.counters.errors = 0;
    this.counters.tools = 0;
    this.done = false;
  }
}
