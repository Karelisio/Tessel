import { describe, expect, it } from 'vitest';
import {
  displayedStreak,
  INITIAL_STREAK,
  milestoneRewards,
  streakDayXp,
  streakStatus,
  validateDay,
  type StreakState,
} from './streak';
import { addDays } from './time';

const D0 = '2026-03-01';

function playDays(days: readonly number[], start: StreakState = INITIAL_STREAK) {
  let s = start;
  const updates = [];
  for (const d of days) {
    const u = validateDay(s, addDays(D0, d));
    updates.push(u);
    s = u.state;
  }
  return { s, updates };
}

describe('série de jours', () => {
  it('jours consécutifs', () => {
    const { s } = playDays([0, 1, 2, 3]);
    expect(s.current).toBe(4);
    expect(s.best).toBe(4);
  });

  it('valider deux fois le même jour ne compte qu’une fois', () => {
    const { s, updates } = playDays([0, 0, 1, 1]);
    expect(s.current).toBe(2);
    expect(updates.map((u) => u.validated)).toEqual([true, false, true, false]);
  });

  it('un jour manqué est comblé par le joker de départ', () => {
    const { s, updates } = playDays([0, 1, 3]);
    expect(s.current).toBe(3);
    expect(s.freezes).toBe(0);
    expect(updates[2]?.freezesUsed).toBe(1);
    expect(updates[2]?.broken).toBe(false);
  });

  it('sans joker suffisant : la série repart à 1, la meilleure est conservée', () => {
    const { s, updates } = playDays([0, 1, 2, 3, 4, 8]);
    expect(s.current).toBe(1);
    expect(s.best).toBe(5);
    expect(s.freezes).toBe(1); // les jokers ne sont pas gaspillés
    expect(updates[5]?.broken).toBe(true);
  });

  it('un joker tous les 7 jours, 3 au maximum, puis compensation', () => {
    const days = Array.from({ length: 28 }, (_, i) => i);
    const { s, updates } = playDays(days);
    expect(s.freezes).toBe(3);
    expect(updates[6]?.freezeEarned).toBe(true);
    expect(updates[13]?.freezeEarned).toBe(true);
    expect(updates[20]?.freezeEarned).toBe(false);
    const overflows = updates.flatMap((u, i) => (u.freezeOverflow ? [i + 1] : []));
    expect(overflows).toEqual([21, 28]);
  });

  it('paliers et récompenses', () => {
    const { updates } = playDays(Array.from({ length: 31 }, (_, i) => i));
    const milestones = updates.map((u) => u.milestone).filter((m) => m !== null);
    expect(milestones).toEqual([3, 7, 14, 30]);
    expect(milestoneRewards(30)).toContainEqual({ kind: 'unlock', key: 'frame:flamme' });
    expect(milestoneRewards(500)).toEqual([{ kind: 'chest', size: 'large', count: 1 }]);
    expect(milestoneRewards(450)).toEqual([]);
  });

  it('statut et affichage', () => {
    const s: StreakState = { current: 9, best: 9, lastDay: D0, freezes: 1 };
    expect(streakStatus(s, D0)).toBe('done');
    expect(streakStatus(s, addDays(D0, 1))).toBe('pending');
    expect(streakStatus(s, addDays(D0, 2))).toBe('pending');
    expect(streakStatus(s, addDays(D0, 3))).toBe('lost');
    expect(displayedStreak(s, addDays(D0, 3))).toBe(0);
    expect(streakStatus(INITIAL_STREAK, D0)).toBe('none');
  });

  it('date reculée : rien ne change', () => {
    const s: StreakState = { current: 4, best: 4, lastDay: D0, freezes: 1 };
    expect(validateDay(s, addDays(D0, -2)).validated).toBe(false);
  });

  it('XP quotidienne plafonnée', () => {
    expect(streakDayXp(1)).toBe(25);
    expect(streakDayXp(20)).toBe(120);
    expect(streakDayXp(300)).toBe(120);
  });
});
