import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS } from '@/content/categories';
import { MODE_IDS } from '@/modes/types';
import { isCounter } from './metrics';
import {
  advanceQuests,
  generateQuests,
  levelTier,
  periodOf,
  questRewards,
  rerollQuest,
  SLOTS,
  type QuestContext,
} from './quests';
import { QUEST_TEMPLATES } from './quests.data';

const ctx = (over: Partial<QuestContext> = {}): QuestContext => ({
  level: 12,
  modes: ['pixel', 'diamond', 'crossstitch'],
  categories: ['animaux', 'fleurs', 'paysages'],
  stat: () => 5,
  seed: 1234,
  ...over,
});

describe('quêtes', () => {
  it('modèles valides', () => {
    const ids = QUEST_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of QUEST_TEMPLATES) {
      const resolved = t.metric
        .replace('{mode}', MODE_IDS[0] ?? '')
        .replace('{category}', CATEGORY_IDS[0] ?? '');
      expect(isCounter(resolved), t.id).toBe(true);
      expect(t.id.startsWith(periodOf(t.slot) === 'daily' ? 'd-' : 'w-'), t.id).toBe(true);
      for (let i = 1; i < 4; i++) expect(t.targets[i]).toBeGreaterThanOrEqual(t.targets[i - 1] ?? 0);
    }
    // chaque emplacement a de quoi tirer, même pour un joueur tout neuf
    const fresh = ctx({ level: 1, modes: ['pixel'], stat: () => 0 });
    for (const slot of [...SLOTS.daily, ...SLOTS.weekly]) {
      const pool = QUEST_TEMPLATES.filter((t) => t.slot === slot && !t.requires);
      expect(pool.length, slot).toBeGreaterThanOrEqual(2);
    }
    expect(generateQuests('daily', '2026-09-29', fresh, QUEST_TEMPLATES)).toHaveLength(3);
    expect(generateQuests('weekly', '2026-W40', fresh, QUEST_TEMPLATES)).toHaveLength(3);
  });

  it('3 quêtes par période, déterministes, sans doublon de métrique', () => {
    for (let d = 1; d <= 60; d++) {
      const key = `2026-10-${String((d % 28) + 1).padStart(2, '0')}#${d}`;
      const a = generateQuests('daily', key, ctx(), QUEST_TEMPLATES);
      const b = generateQuests('daily', key, ctx(), QUEST_TEMPLATES);
      expect(a).toEqual(b);
      expect(a.map((q) => q.slot)).toEqual(['easy', 'medium', 'variety']);
      expect(new Set(a.map((q) => q.metric)).size).toBe(3);
    }
  });

  it('les joueurs n’ont pas tous les mêmes quêtes', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const qs = generateQuests('daily', '2026-09-29', ctx({ seed }), QUEST_TEMPLATES);
      seen.add(qs.map((q) => q.template + q.metric).join());
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it('paramètres tirés parmi le contenu débloqué', () => {
    for (let seed = 0; seed < 200; seed++) {
      const c = ctx({ seed, modes: ['pixel', 'diamond'], categories: ['fleurs'] });
      for (const q of [
        ...generateQuests('daily', 'j', c, QUEST_TEMPLATES),
        ...generateQuests('weekly', 's', c, QUEST_TEMPLATES),
      ]) {
        if (q.params.mode) expect(['pixel', 'diamond']).toContain(q.params.mode);
        if (q.params.category) expect(q.params.category).toBe('fleurs');
      }
    }
  });

  it('conditions : pas de quête photo pour qui n’a jamais importé de photo', () => {
    for (let seed = 0; seed < 300; seed++) {
      const c = ctx({ seed, level: 30, stat: (m) => (m === 'photos' ? 0 : 50) });
      const qs = [
        ...generateQuests('daily', 'j', c, QUEST_TEMPLATES),
        ...generateQuests('weekly', 's', c, QUEST_TEMPLATES),
      ];
      expect(qs.some((q) => q.metric === 'artworks.photo')).toBe(false);
    }
  });

  it('progression, accomplissement unique', () => {
    const [q] = generateQuests('daily', 'j', ctx({ seed: 3 }), QUEST_TEMPLATES);
    if (!q) throw new Error('quête attendue');
    expect(advanceQuests([q], 'artworks.mode.mosaic', 1, 0)).toHaveLength(0);
    const done = advanceQuests([q], q.metric, q.target + 50, 42);
    expect(done).toEqual([q]);
    expect(q.progress).toBe(q.target);
    expect(q.doneAt).toBe(42);
    expect(advanceQuests([q], q.metric, 10, 43)).toHaveLength(0);
  });

  it('remplacement : autre modèle, même emplacement, quête accomplie non remplaçable', () => {
    const qs = generateQuests('daily', '2026-09-29', ctx(), QUEST_TEMPLATES);
    const first = qs[0];
    if (!first) throw new Error('quête attendue');
    const next = rerollQuest(first, qs, ctx(), QUEST_TEMPLATES, 0);
    expect(next?.slot).toBe(first.slot);
    expect(next?.id).toBe(first.id);
    expect(next?.template).not.toBe(first.template);
    for (const other of qs.slice(1)) expect(next?.metric).not.toBe(other.metric);
    first.doneAt = 1;
    expect(rerollQuest(first, qs, ctx(), QUEST_TEMPLATES, 0)).toBeNull();
  });

  it('objectifs et récompenses selon le niveau', () => {
    expect(levelTier(1)).toBe(0);
    expect(levelTier(10)).toBe(1);
    expect(levelTier(49)).toBe(2);
    expect(levelTier(120)).toBe(3);
    const xp = (level: number) => questRewards('easy', level).find((r) => r.kind === 'xp');
    expect(xp(1)).toEqual({ kind: 'xp', amount: 60 });
    expect(xp(41)).toEqual({ kind: 'xp', amount: 120 });
  });
});
