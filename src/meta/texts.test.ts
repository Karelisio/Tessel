import { describe, expect, it } from 'vitest';
import type { I18nText } from '@/i18n/text';
import { ACHIEVEMENTS } from './achievements.data';
import { ACHIEVEMENT_TEXT } from './achievements.text';
import { PLACEHOLDERS, questTitle } from './format';
import { periodOf, type Quest } from './quests';
import { QUEST_TEMPLATES } from './quests.data';
import { QUEST_TEXT } from './quests.text';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '');
const both = (x: I18nText) => [x.fr, x.en];

function clean(s: string, where: string) {
  expect(s.length, where).toBeGreaterThan(0);
  expect(s.trim(), where).toBe(s);
  expect(s, where).not.toMatch(/'/); // apostrophe typographique ’
  expect(s, where).not.toMatch(/ {2}/);
}

describe('textes des succès', () => {
  it('un texte par succès, ni plus ni moins', () => {
    expect(Object.keys(ACHIEVEMENT_TEXT).sort()).toEqual(ACHIEVEMENTS.map((a) => a.id).sort());
  });

  it('titres uniques, sans point final ni point d’exclamation', () => {
    for (const lang of ['fr', 'en'] as const) {
      const titles = Object.values(ACHIEVEMENT_TEXT).map((x) => x.title[lang]);
      expect(new Set(titles).size, lang).toBe(titles.length);
      for (const title of titles) expect(title, title).not.toMatch(/[.!]$/);
    }
  });

  it('textes propres, `{n}` seul paramètre, présent sur les paliers', () => {
    for (const def of ACHIEVEMENTS) {
      const text = ACHIEVEMENT_TEXT[def.id];
      if (!text) throw new Error(def.id);
      for (const s of [
        ...both(text.title),
        ...both(text.description),
        ...(text.hint ? both(text.hint) : []),
      ]) {
        clean(s, def.id);
        for (const p of placeholders(s)) expect(p, def.id).toBe('n');
      }
      expect(placeholders(text.title.fr + text.title.en), def.id).toEqual([]);
      if (def.kind === 'tiered' && def.group !== 'playtime')
        for (const s of both(text.description)) expect(s, def.id).toContain('{n}');
      expect(text.hint !== undefined, def.id).toBe(def.kind === 'secret');
    }
  });
});

describe('textes des quêtes', () => {
  it('un texte par modèle, ni plus ni moins', () => {
    expect(Object.keys(QUEST_TEXT).sort()).toEqual(QUEST_TEMPLATES.map((q) => q.id).sort());
  });

  it('paramètres cohérents avec la métrique', () => {
    for (const tpl of QUEST_TEMPLATES) {
      const text = QUEST_TEXT[tpl.id];
      if (!text) throw new Error(tpl.id);
      if (tpl.targets.includes(1)) expect(text.one, tpl.id).toBeDefined();
      const forms = [...both(text.other), ...(text.one ? both(text.one) : [])];
      for (const s of both(text.other)) expect(s, tpl.id).toContain('{n}');
      for (const s of forms) {
        clean(s, tpl.id);
        for (const p of placeholders(s)) expect(PLACEHOLDERS as readonly string[], tpl.id).toContain(p);
        if (tpl.metric.includes('{mode}')) expect(/\{units\}|\{inMode\}/.test(s), tpl.id).toBe(true);
        if (tpl.metric.includes('{category}')) expect(s, tpl.id).toContain('{category}');
      }
    }
  });

  it('rendu complet, au singulier comme au pluriel', () => {
    for (const tpl of QUEST_TEMPLATES) {
      const text = QUEST_TEXT[tpl.id];
      if (!text) throw new Error(tpl.id);
      for (const target of [1, 5, 2000]) {
        const quest: Quest = {
          id: 'x',
          period: periodOf(tpl.slot),
          periodKey: 'x',
          slot: tpl.slot,
          template: tpl.id,
          params: {
            ...(tpl.metric.includes('{mode}') && { mode: 'crossstitch' as const }),
            ...(tpl.metric.includes('{category}') && { category: 'mer' as const }),
          },
          metric: 'cells',
          target,
          progress: 0,
          doneAt: null,
        };
        for (const lang of ['fr', 'en'] as const) {
          const s = questTitle(text, quest, lang);
          expect(s, `${tpl.id} ${lang}`).not.toMatch(/[{}]/);
          expect(s, `${tpl.id} ${lang}`).not.toMatch(/ {2}|^ | $/);
        }
      }
    }
    const q = QUEST_TEMPLATES.find((x) => x.id === 'w-artworks-category');
    const text = QUEST_TEXT['w-artworks-category'];
    if (!q || !text) throw new Error('modèle attendu');
    const quest = (target: number): Quest => ({
      id: 'x',
      period: 'weekly',
      periodKey: 'x',
      slot: q.slot,
      template: q.id,
      params: { category: 'mer' },
      metric: 'artworks.category.mer',
      target,
      progress: 0,
      doneAt: null,
    });
    expect(questTitle(text, quest(1), 'fr')).toBe('Termine une œuvre marine');
    expect(questTitle(text, quest(3), 'fr')).toBe('Termine 3 œuvres marines');
    expect(questTitle(text, quest(3), 'en')).toBe('Complete 3 sea artworks');
  });
});
