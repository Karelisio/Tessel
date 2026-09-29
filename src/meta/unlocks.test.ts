import { describe, expect, it } from 'vitest';
import { CATALOG, catalogItem, STARTER_UNLOCKS, unlockKind, type UnlockKey } from './catalog';
import { CATEGORY_IDS } from '@/content/categories';
import { LAST_SCHEDULED_LEVEL, LEVEL_UNLOCKS, levelRewards, unlockLevel } from './unlocks';

describe('déblocages', () => {
  it('au moins une nouveauté à chaque niveau jusqu’au 80, et des outils à chaque niveau', () => {
    for (let level = 2; level <= LAST_SCHEDULED_LEVEL; level++) {
      const rewards = levelRewards(level);
      expect(rewards.some((r) => r.kind === 'unlock')).toBe(true);
      expect(rewards.some((r) => r.kind === 'tool')).toBe(true);
    }
    for (let level = 81; level <= 300; level++) {
      expect(levelRewards(level).filter((r) => r.kind === 'tool').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('chaque clé programmée existe et n’apparaît qu’une fois', () => {
    const all = Object.values(LEVEL_UNLOCKS).flat();
    expect(new Set(all).size).toBe(all.length);
    for (const key of all) {
      expect(catalogItem(key), key).toBeDefined();
      expect(STARTER_UNLOCKS).not.toContain(key);
    }
  });

  it('le catalogue n’a pas de doublons et chaque élément est obtenable', () => {
    const keys = CATALOG.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    const special: UnlockKey[] = [
      'frame:flamme',
      'frame:constellation',
      'frame:jubile',
      'frame:centenaire',
      'frame:millier',
      'frame:prisme',
      'wall:atelier',
      'wall:musee',
    ];
    for (const c of CATALOG) {
      const obtainable = c.starter === true || unlockLevel(c.key) !== undefined || special.includes(c.key);
      expect(obtainable, c.key).toBe(true);
    }
  });

  it('modes et catégories : ordre de découverte', () => {
    expect(unlockLevel('mode:diamond')).toBe(2);
    expect(unlockLevel('mode:crossstitch')).toBe(6);
    expect(unlockLevel('mode:mosaic')).toBe(10);
    for (const id of CATEGORY_IDS) {
      const key: UnlockKey = `category:${id}`;
      const level = unlockLevel(key);
      expect(level === undefined ? STARTER_UNLOCKS.includes(key) : level <= 32, id).toBe(true);
    }
    expect(STARTER_UNLOCKS.filter((k) => unlockKind(k) === 'category')).toHaveLength(6);
  });

  it('badges de prestige à l’infini', () => {
    const r = levelRewards(LAST_SCHEDULED_LEVEL + 30);
    expect(r).toContainEqual({ kind: 'unlock', key: 'badge:prestige-3' });
    expect(catalogItem('badge:prestige-3')?.name.fr).toBe('Prestige III');
    expect(catalogItem('badge:prestige-42')?.name.en).toBe('Prestige 42');
  });
});
