import { describe, expect, it } from 'vitest';
import { addDays, dayKey, dayNumber, daysBetween, nextWeekStart, weekday, weekKey, weekOf } from './time';

describe('dates locales', () => {
  it('jour local, y compris juste avant minuit', () => {
    expect(dayKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
    expect(dayKey(new Date(2025, 11, 31, 23, 59, 59))).toBe('2025-12-31');
    expect(dayKey(new Date(2026, 8, 5, 12).getTime())).toBe('2026-09-05');
  });

  it('écarts en jours exacts, même autour des changements d’heure', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2026-01-05', '2026-01-01')).toBe(-4);
    expect(addDays('2025-12-30', 3)).toBe('2026-01-02');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(dayNumber('1970-01-02')).toBe(1);
  });

  it('jour de la semaine (lundi = 0)', () => {
    expect(weekday('2026-09-28')).toBe(0);
    expect(weekday('2026-10-04')).toBe(6);
    expect(weekday('1970-01-01')).toBe(3);
  });

  it('semaines ISO, y compris à cheval sur deux années', () => {
    expect(weekOf('2026-09-29')).toBe('2026-W40');
    expect(weekOf('2026-01-01')).toBe('2026-W01');
    expect(weekOf('2027-01-01')).toBe('2026-W53');
    expect(weekOf('2024-12-30')).toBe('2025-W01');
    expect(weekOf('2021-01-03')).toBe('2020-W53');
    expect(weekKey(new Date(2026, 8, 29, 23))).toBe('2026-W40');
  });

  it('une semaine va du lundi au dimanche', () => {
    const days = Array.from({ length: 7 }, (_, i) => weekOf(addDays('2026-09-28', i)));
    expect(new Set(days).size).toBe(1);
    expect(weekOf('2026-10-05')).not.toBe(days[0]);
    expect(nextWeekStart('2026-09-29')).toBe('2026-10-05');
    expect(nextWeekStart('2026-10-04')).toBe('2026-10-05');
    expect(nextWeekStart('2026-09-28')).toBe('2026-10-05');
  });
});
