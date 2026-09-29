import type { CategoryId } from '@/content/categories';
import type { DbDriver } from '@/db/driver';
import type { ModeId } from '@/modes/types';
import type { UnlockKey } from './catalog';
import type { CounterMetric } from './metrics';
import type { Quest, QuestPeriod, QuestSlot } from './quests';
import type { ItemKey } from './rewards';
import { emptyState, type Dirty, type MetaState } from './state';

interface QuestRow {
  id: string;
  period: QuestPeriod;
  period_key: string;
  template: string;
  params: string;
  target: number;
  progress: number;
  claimed_at: number | null;
}

interface StoredParams {
  mode?: ModeId;
  category?: CategoryId;
  slot: QuestSlot;
  metric: CounterMetric;
}

/** Lecture et écriture de la méta-progression en base (une transaction par écriture). */
export class MetaStore {
  constructor(private readonly db: DbDriver) {}

  async load(): Promise<MetaState> {
    const db = this.db;
    const player = (
      await db.query<{ xp: number; level: number; created_at: number }>(
        'SELECT xp, level, created_at FROM player WHERE id = 1',
      )
    )[0];
    const state = emptyState(player?.created_at ?? Date.now());
    state.xp = player?.xp ?? 0;
    state.level = player?.level ?? 1;
    for (const r of await db.query<{ item: ItemKey; count: number }>('SELECT item, count FROM inventory'))
      state.inventory.set(r.item, r.count);
    for (const r of await db.query<{ key: UnlockKey; unlocked_at: number; seen: number }>(
      'SELECT key, unlocked_at, seen FROM unlocks',
    ))
      state.unlocks.set(r.key, { at: r.unlocked_at, seen: r.seen !== 0 });
    for (const r of await db.query<{ id: string; unlocked_at: number | null }>(
      'SELECT id, unlocked_at FROM achievements WHERE unlocked_at IS NOT NULL',
    ))
      if (r.unlocked_at !== null) state.achievements.set(r.id, r.unlocked_at);
    for (const r of await db.query<QuestRow>('SELECT * FROM quests')) {
      const p = JSON.parse(r.params) as StoredParams;
      state.quests.push({
        id: r.id,
        period: r.period,
        periodKey: r.period_key,
        slot: p.slot,
        template: r.template,
        params: {
          ...(p.mode !== undefined && { mode: p.mode }),
          ...(p.category !== undefined && { category: p.category }),
        },
        metric: p.metric,
        target: r.target,
        progress: r.progress,
        doneAt: r.claimed_at,
      });
    }
    const streak = (
      await db.query<{ current: number; best: number; last_day: string | null; freezes: number }>(
        'SELECT current, best, last_day, freezes FROM streak WHERE id = 1',
      )
    )[0];
    if (streak)
      state.streak = {
        current: streak.current,
        best: streak.best,
        lastDay: streak.last_day,
        freezes: streak.freezes,
      };
    for (const r of await db.query<{ key: string; value: number }>('SELECT key, value FROM stats'))
      state.stats.set(r.key, r.value);
    // le jour courant suffit en mémoire : l'historique complet reste en base (écran statistiques)
    for (const r of await db.query<{ day: string; cells: number; time_ms: number; completed: number }>(
      'SELECT day, cells, time_ms, completed FROM stats_daily ORDER BY day DESC LIMIT 2',
    ))
      state.days.set(r.day, { cells: r.cells, timeMs: r.time_ms, completed: r.completed });
    for (const r of await db.query<{ key: string }>('SELECT key FROM rewards_claimed'))
      state.claimed.add(r.key);
    return state;
  }

  async save(state: MetaState, dirty: Dirty, now: number): Promise<void> {
    const db = this.db;
    await db.transaction(async () => {
      if (dirty.player) {
        await db.run('UPDATE player SET xp = ?, level = ? WHERE id = 1', [state.xp, state.level]);
      }
      for (const item of dirty.inventory) {
        await db.run('INSERT OR REPLACE INTO inventory (item, count) VALUES (?, ?)', [
          item,
          state.inventory.get(item) ?? 0,
        ]);
      }
      for (const key of dirty.unlocks) {
        const u = state.unlocks.get(key);
        if (!u) continue;
        await db.run('INSERT OR REPLACE INTO unlocks (key, unlocked_at, seen) VALUES (?, ?, ?)', [
          key,
          u.at,
          u.seen ? 1 : 0,
        ]);
      }
      for (const id of dirty.achievements) {
        const at = state.achievements.get(id);
        if (at === undefined) continue;
        await db.run('INSERT OR REPLACE INTO achievements (id, progress, unlocked_at) VALUES (?, 0, ?)', [
          id,
          at,
        ]);
      }
      for (const [period, key] of dirty.questPeriods) {
        await db.run('DELETE FROM quests WHERE period = ? AND period_key <> ?', [period, key]);
      }
      for (const id of dirty.quests) {
        const q = state.quests.find((x) => x.id === id);
        if (q) await this.writeQuest(q);
      }
      if (dirty.streak) {
        const s = state.streak;
        await db.run('UPDATE streak SET current = ?, best = ?, last_day = ?, freezes = ? WHERE id = 1', [
          s.current,
          s.best,
          s.lastDay,
          s.freezes,
        ]);
      }
      for (const key of dirty.stats) {
        await db.run('INSERT OR REPLACE INTO stats (key, value) VALUES (?, ?)', [
          key,
          state.stats.get(key) ?? 0,
        ]);
      }
      for (const day of dirty.days) {
        const d = state.days.get(day);
        if (!d) continue;
        await db.run(
          'INSERT OR REPLACE INTO stats_daily (day, cells, time_ms, completed) VALUES (?, ?, ?, ?)',
          [day, d.cells, Math.round(d.timeMs), d.completed],
        );
      }
      for (const [rgb, cells] of dirty.colors) {
        await db.run(
          `INSERT INTO color_usage (rgb, cells) VALUES (?, ?)
           ON CONFLICT(rgb) DO UPDATE SET cells = cells + excluded.cells`,
          [rgb, cells],
        );
      }
      for (const key of dirty.claimed) {
        await db.run('INSERT OR IGNORE INTO rewards_claimed (key, claimed_at) VALUES (?, ?)', [key, now]);
      }
    });
  }

  private async writeQuest(q: Quest): Promise<void> {
    const params: StoredParams = { ...q.params, slot: q.slot, metric: q.metric };
    await this.db.run(
      `INSERT OR REPLACE INTO quests (id, period, period_key, template, params, target, progress, claimed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [q.id, q.period, q.periodKey, q.template, JSON.stringify(params), q.target, q.progress, q.doneAt],
    );
  }

  /** Couleurs les plus utilisées (statistiques). */
  async favoriteColors(limit = 8): Promise<{ rgb: number; cells: number }[]> {
    return this.db.query('SELECT rgb, cells FROM color_usage ORDER BY cells DESC LIMIT ?', [limit]);
  }

  /** Historique quotidien (statistiques), du plus récent au plus ancien. */
  async dailyHistory(
    limit = 90,
  ): Promise<{ day: string; cells: number; time_ms: number; completed: number }[]> {
    return this.db.query('SELECT day, cells, time_ms, completed FROM stats_daily ORDER BY day DESC LIMIT ?', [
      limit,
    ]);
  }
}
