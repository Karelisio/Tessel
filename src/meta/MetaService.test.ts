import { describe, expect, it } from 'vitest';
import { migrate } from '@/db/migrations';
import { createTestDb } from '@/db/testing';
import { totalXpForLevel } from './levels';
import { MetaService, type ArtworkContext, type MetaNotice } from './MetaService';

class TestClock {
  constructor(public t: number) {}
  now(): number {
    return this.t;
  }
  /** Avance au jour suivant, même heure. */
  nextDay(days = 1): void {
    const d = new Date(this.t);
    this.t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours()).getTime();
  }
}

const START = new Date(2026, 8, 29, 15, 0).getTime(); // mardi, après-midi

function ctx(over: Partial<ArtworkContext> = {}): ArtworkContext {
  return {
    projectId: 'p1',
    artworkId: 'a1',
    mode: 'pixel',
    source: 'library',
    category: 'fleurs',
    cells: 900,
    colors: 12,
    startedAt: START,
    filled: 0,
    undos: 0,
    errors: 0,
    tools: 0,
    ...over,
  };
}

function setup(start = START) {
  const clock = new TestClock(start);
  const meta = MetaService.inMemory({ clock });
  const notices: MetaNotice[] = [];
  meta.onNotice((n) => notices.push(n));
  return { clock, meta, notices };
}

describe('MetaService', () => {
  it('état de départ : pixel, 6 catégories, outils, un joker, 3 + 3 quêtes', () => {
    const { meta } = setup();
    expect(meta.level).toBe(1);
    expect(meta.unlockedModes).toEqual(['pixel']);
    expect(meta.unlockedCategories).toHaveLength(6);
    expect([meta.tools('loupe'), meta.tools('bucket'), meta.tools('wand')]).toEqual([3, 2, 1]);
    expect(meta.freezes).toBe(1);
    expect(meta.quests('daily')).toHaveLength(3);
    expect(meta.quests('weekly')).toHaveLength(3);
    expect(meta.streak).toMatchObject({ current: 0, status: 'none' });
  });

  it('XP par case avec bonus découverte, niveau 2 : le diamant se débloque', () => {
    const { meta, notices } = setup();
    const track = meta.startArtwork(ctx());
    track.progress(100);
    // ×1,5 pendant les 3 premières œuvres du mode
    expect(meta.xp).toBeGreaterThanOrEqual(150);
    track.progress(900);
    expect(meta.level).toBeGreaterThanOrEqual(2);
    expect(meta.isUnlocked('mode:diamond')).toBe(true);
    const up = notices.find((n) => n.type === 'levelUp');
    expect(up?.type === 'levelUp' && up.rewards).toContainEqual({ kind: 'unlock', key: 'mode:diamond' });
    expect(meta.unseen()).toContain('mode:diamond');
    meta.markSeen(['mode:diamond']);
    expect(meta.unseen()).not.toContain('mode:diamond');
  });

  it('annuler puis reposer ne rapporte rien de plus', () => {
    const { meta } = setup();
    const track = meta.startArtwork(ctx());
    track.progress(50);
    const xp = meta.xp;
    track.progress(40);
    track.progress(50);
    expect(meta.xp).toBe(xp);
    expect(meta.stat('cells')).toBe(50);
  });

  it('série : 30 cases valident le jour, joker automatique, paliers', () => {
    const { meta, clock, notices } = setup();
    const play = (cells = 40) => {
      const track = meta.startArtwork(ctx({ projectId: String(clock.t) }));
      track.progress(cells);
    };
    play(20);
    expect(meta.streak.status).toBe('none');
    play(20);
    expect(meta.streak).toMatchObject({ current: 1, status: 'done' });
    clock.nextDay();
    expect(meta.streak.status).toBe('pending');
    play();
    clock.nextDay(2); // un jour manqué, comblé par le joker
    play();
    expect(meta.streak.current).toBe(3);
    expect(meta.freezes).toBe(0);
    expect(meta.stat('freezes.used')).toBe(1);
    const milestone = notices.find((n) => n.type === 'streak' && n.update.milestone === 3);
    expect(milestone).toBeDefined();
    expect(meta.chests('small')).toBeGreaterThanOrEqual(1);
  });

  it('quêtes : progression, récompense et bonus des trois', () => {
    const { meta, notices } = setup();
    const before = meta.chests('small');
    // termine assez d'œuvres et de cases pour accomplir n'importe quelle quête du jour de base
    for (let k = 0; k < 6; k++) {
      const t = meta.startArtwork(ctx({ projectId: `p${k}`, category: 'fleurs' }));
      t.progress(900);
      for (let c = 0; c < 12; c++) t.colorDone(c, c * 1000, 75);
      t.activeTime(10 * 60_000);
      t.complete(1);
    }
    meta.record('timelapses');
    meta.record('tools');
    const daily = meta.quests('daily');
    const unfinished = daily.filter((q) => q.doneAt === null);
    for (const q of unfinished) meta.record(q.metric, q.target);
    expect(meta.quests('daily').every((q) => q.doneAt !== null)).toBe(true);
    expect(notices.filter((n) => n.type === 'quest').length).toBeGreaterThanOrEqual(3);
    expect(notices.some((n) => n.type === 'questsAll' && n.period === 'daily')).toBe(true);
    expect(meta.chests('small')).toBeGreaterThan(before);
    expect(meta.stat('quests.daily')).toBe(3);
  });

  it('remplacement de quête une fois par jour', () => {
    const { meta, clock } = setup();
    const q = meta.quests('daily')[0];
    if (!q) throw new Error('quête attendue');
    expect(meta.canReroll).toBe(true);
    const next = meta.rerollQuest(q.id);
    expect(next?.template).not.toBe(q.template);
    expect(meta.canReroll).toBe(false);
    expect(meta.rerollQuest(q.id)).toBeNull();
    clock.nextDay();
    expect(meta.canReroll).toBe(true);
  });

  it('nouveau jour, nouvelles quêtes ; nouvelle semaine le lundi', () => {
    const { meta, clock } = setup();
    const d1 = meta.quests('daily').map((q) => q.id);
    const w1 = meta.quests('weekly').map((q) => q.id);
    clock.nextDay();
    expect(meta.quests('daily').map((q) => q.id)).not.toEqual(d1);
    expect(meta.quests('weekly').map((q) => q.id)).toEqual(w1);
    clock.nextDay(6);
    expect(meta.quests('weekly').map((q) => q.id)).not.toEqual(w1);
  });

  it('succès : paliers et secrets, avec récompenses', () => {
    const night = new Date(2026, 8, 29, 2, 30).getTime();
    const { meta, notices } = setup(night);
    const t = meta.startArtwork(ctx({ cells: 3000, colors: 4 }));
    t.progress(3000);
    t.complete(1);
    const ids = notices.flatMap((n) => (n.type === 'achievement' ? [n.def.id] : []));
    expect(ids).toEqual(expect.arrayContaining(['cells-1', 'cells-2', 'artworks-1', 'secret-nightOwl']));
    expect(ids).toEqual(expect.arrayContaining(['secret-noUndo', 'secret-flawless', 'secret-minimalist']));
    expect(meta.achievementUnlockedAt('secret-nightOwl')).toBe(night);
    // un succès n'est obtenu qu'une fois
    const again = meta.startArtwork(ctx({ projectId: 'p2', cells: 3000, colors: 4 }));
    const count = notices.length;
    again.progress(10);
    expect(notices.slice(count).some((n) => n.type === 'achievement' && n.def.id === 'cells-1')).toBe(false);
  });

  it('fin d’œuvre : compteurs par mode, catégorie, taille, source', () => {
    const { meta } = setup();
    const t = meta.startArtwork(ctx({ cells: 12_000, source: 'photo', category: null }));
    t.progress(12_000);
    const bonus = t.complete(1);
    expect(bonus).toBe(Math.round((12_000 * 0.15 + 50) * 1.2));
    expect(t.complete(1)).toBe(0);
    expect(meta.stat('artworks')).toBe(1);
    expect(meta.stat('artworks.mode.pixel')).toBe(1);
    expect(meta.stat('artworks.size.large')).toBe(1);
    expect(meta.stat('artworks.photo')).toBe(1);
    expect(meta.stat('modes.completed')).toBe(1);
    t.restart();
    t.progress(12_000);
    expect(t.complete(1)).toBe(bonus);
    expect(meta.stat('artworks')).toBe(2);
  });

  it('outils et coffres', () => {
    const { meta } = setup();
    expect(meta.consumeTool('wand')).toBe(true);
    expect(meta.consumeTool('wand')).toBe(false);
    expect(meta.stat('tools.wand')).toBe(1);
    expect(meta.openChest('large')).toBeNull();
    meta.debugGrant([{ kind: 'chest', size: 'large', count: 1 }]);
    const wands = meta.tools('wand');
    const contents = meta.openChest('large');
    expect(contents?.some((r) => r.kind === 'tool' && r.tool === 'wand')).toBe(true);
    expect(meta.tools('wand')).toBeGreaterThan(wands);
    expect(meta.chests('large')).toBe(0);
  });

  it('jokers au maximum : le surplus devient de l’XP', () => {
    const { meta } = setup();
    meta.debugGrant([{ kind: 'freeze', count: 5 }]);
    expect(meta.freezes).toBe(3);
    expect(meta.xp).toBe(3 * 150);
  });

  it('plusieurs niveaux d’un coup : toutes les récompenses', () => {
    const { meta, notices } = setup();
    meta.debugGrant([{ kind: 'xp', amount: totalXpForLevel(11) }]);
    expect(meta.level).toBe(11);
    expect(notices.filter((n) => n.type === 'levelUp')).toHaveLength(10);
    expect(meta.unlockedModes).toEqual(['pixel', 'diamond', 'crossstitch', 'mosaic']);
    expect(meta.stat('modes.unlocked')).toBe(4);
    expect(meta.achievementUnlockedAt('discover-modes')).toBeDefined();
  });

  it('persistance : tout est relu à l’identique', async () => {
    const db = await createTestDb();
    await migrate(db, START);
    const clock = new TestClock(START);
    const opts = { clock, setTimer: () => 0, clearTimer: () => undefined };
    const meta = await MetaService.open(db, opts);
    const t = meta.startArtwork(ctx());
    t.progress(900);
    t.colorDone(0, 0xff0000, 900);
    t.activeTime(90_000);
    t.complete(1);
    meta.consumeTool('loupe');
    const reroll = meta.quests().find((q) => q.doneAt === null);
    if (!reroll) throw new Error('quête en cours attendue');
    expect(meta.rerollQuest(reroll.id)).not.toBeNull();
    await meta.flush();

    const again = await MetaService.open(db, opts);
    expect(again.xp).toBe(meta.xp);
    expect(again.level).toBe(meta.level);
    expect(again.tools('loupe')).toBe(meta.tools('loupe'));
    expect(again.streak).toEqual(meta.streak);
    expect(again.quests()).toEqual(meta.quests());
    expect(again.canReroll).toBe(false);
    expect(again.stat('cells')).toBe(900);
    expect(again.stat('playtime.minutes')).toBe(1);
    expect(again.unlockedModes).toEqual(meta.unlockedModes);
    expect(again.achievementCount).toBe(meta.achievementCount);
    const colors = await db.query<{ rgb: number; cells: number }>('SELECT rgb, cells FROM color_usage');
    expect(colors).toEqual([{ rgb: 0xff0000, cells: 900 }]);
    const days = await db.query<{ cells: number; completed: number }>(
      'SELECT cells, completed FROM stats_daily',
    );
    expect(days).toEqual([{ cells: 900, completed: 1 }]);
    // l'état de départ n'est versé qu'une fois
    expect(again.tools('wand')).toBe(meta.tools('wand'));
  });
});
