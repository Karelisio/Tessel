import { describe, expect, it } from 'vitest';
import { completionSecrets, daySecrets, fullMoonAt, hourSecrets, isFullMoonDay } from './secrets';

const created = new Date(2025, 5, 1, 10).getTime();

describe('secrets', () => {
  it('pleines lunes connues, à quelques minutes près', () => {
    const known = [
      Date.UTC(2025, 0, 13, 22, 27),
      Date.UTC(2026, 8, 26, 16, 49),
      Date.UTC(2024, 11, 15, 9, 2),
      Date.UTC(2026, 0, 3, 10, 3),
      Date.UTC(2025, 5, 11, 7, 44),
      Date.UTC(2027, 1, 20, 23, 24),
    ];
    for (const t of known) {
      const k = Math.round((t - Date.UTC(2000, 0, 21)) / 86_400_000 / 29.530588861);
      expect(Math.abs(fullMoonAt(k) - t) / 60_000, new Date(t).toISOString()).toBeLessThan(20);
    }
  });

  it('un seul jour de pleine lune par lunaison', () => {
    let n = 0;
    for (let day = 0; day < 365; day++) {
      const d = new Date(2026, 0, 1 + day);
      if (
        isFullMoonDay(
          `2026-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        )
      )
        n++;
    }
    expect(n).toBeGreaterThanOrEqual(12);
    expect(n).toBeLessThanOrEqual(13);
    expect(isFullMoonDay('2026-09-11')).toBe(false);
  });

  it('dates particulières', () => {
    expect(daySecrets('2027-01-01', created)).toContain('newYear');
    expect(daySecrets('2028-02-29', created)).toContain('leapDay');
    expect(daySecrets('2026-11-13', created)).toContain('friday13');
    expect(daySecrets('2026-12-13', created)).not.toContain('friday13');
    expect(daySecrets('2026-05-31', created)).not.toContain('anniversary');
    expect(daySecrets('2026-06-01', created)).toContain('anniversary');
  });

  it('heures', () => {
    expect(hourSecrets(0)).toEqual(['nightOwl']);
    expect(hourSecrets(3)).toEqual(['nightOwl']);
    expect(hourSecrets(4)).toEqual([]);
    expect(hourSecrets(6)).toEqual(['earlyBird']);
    expect(hourSecrets(7)).toEqual([]);
  });

  it('fin d’œuvre', () => {
    const base = { cells: 3000, colors: 12, undos: 1, errors: 3, tools: 1, completedModes: 1, startedAt: 0 };
    expect(completionSecrets({ ...base, now: 1000 })).toEqual([]);
    expect(completionSecrets({ ...base, undos: 0, errors: 0, now: 1000 })).toEqual(['noUndo', 'flawless']);
    expect(completionSecrets({ ...base, cells: 900, undos: 0, now: 1000 })).toEqual([]);
    expect(completionSecrets({ ...base, colors: 4, now: 1000 })).toEqual(['minimalist']);
    expect(completionSecrets({ ...base, colors: 48, completedModes: 4, now: 1000 })).toEqual([
      'rainbow',
      'allModes',
    ]);
    expect(completionSecrets({ ...base, now: 31 * 86_400_000 })).toEqual(['patience']);
    expect(completionSecrets({ ...base, cells: 40_000, tools: 0, now: 1000 })).toEqual(['purist']);
  });
});
