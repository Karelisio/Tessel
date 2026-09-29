import { describe, expect, it } from 'vitest';
import { catalogItem } from './catalog';
import { achievementRewards, indexByMetric, reached } from './achievements';
import { ACHIEVEMENTS } from './achievements.data';
import { isMetric, SECRETS } from './metrics';

describe('succès', () => {
  it('150 succès : 110 à paliers, 25 découvertes, 15 secrets', () => {
    expect(ACHIEVEMENTS).toHaveLength(150);
    const count = (k: string) => ACHIEVEMENTS.filter((a) => a.kind === k).length;
    expect(count('tiered')).toBe(110);
    expect(count('discovery')).toBe(25);
    expect(count('secret')).toBe(15);
    expect(ACHIEVEMENTS.filter((a) => a.kind === 'secret').map((a) => a.metric)).toEqual(
      SECRETS.map((s) => `secret.${s}`),
    );
  });

  it('identifiants uniques, métriques connues, paliers croissants', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) {
      expect(isMetric(a.metric), a.id).toBe(true);
      expect(a.target, a.id).toBeGreaterThan(0);
    }
    const groups = new Map<string, number[]>();
    for (const a of ACHIEVEMENTS.filter((x) => x.kind === 'tiered')) {
      groups.set(a.group, [...(groups.get(a.group) ?? []), a.target]);
    }
    for (const [group, targets] of groups) {
      for (let i = 1; i < targets.length; i++) expect(targets[i], group).toBeGreaterThan(targets[i - 1] ?? 0);
    }
  });

  it('récompenses valides', () => {
    for (const a of ACHIEVEMENTS) {
      const rewards = achievementRewards(a);
      expect(
        rewards.some((r) => r.kind === 'xp'),
        a.id,
      ).toBe(true);
      for (const r of rewards) if (r.kind === 'unlock') expect(catalogItem(r.key), a.id).toBeDefined();
    }
  });

  it('évaluation par métrique', () => {
    const index = indexByMetric(ACHIEVEMENTS);
    const got = reached(index.get('cells'), 12_000, new Set(['cells-1']));
    expect(got.map((a) => a.id)).toEqual(['cells-2', 'cells-3']);
    expect(reached(index.get('cells'), 50, new Set())).toEqual([]);
    expect(reached(undefined, 1e9, new Set())).toEqual([]);
  });
});
