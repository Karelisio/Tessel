import { describe, expect, it } from 'vitest';
import { addDays } from '@/meta/time';
import { activeEvents, daysLeft, editionKey, EVENTS, eventById, isActive, nextEvent } from './events';

const ids = (day: string) => activeEvents(day).map((e) => e.id);

describe('événements saisonniers', () => {
  it('bornes incluses', () => {
    expect(ids('2026-12-01')).toEqual(['noel']);
    expect(ids('2026-11-30')).toEqual([]);
    expect(ids('2026-12-27')).toEqual(['noel']);
    expect(ids('2026-10-15')).toEqual(['halloween']);
    expect(ids('2026-11-03')).toEqual(['halloween']);
    expect(ids('2026-11-04')).toEqual([]);
  });

  it('le nouvel an chevauche le changement d’année', () => {
    expect(ids('2026-12-28')).toEqual(['nouvel-an']);
    expect(ids('2027-01-01')).toEqual(['nouvel-an']);
    expect(ids('2027-01-07')).toEqual(['nouvel-an']);
    expect(ids('2027-01-08')).toEqual([]);
    const e = eventById('nouvel-an');
    if (!e) throw new Error('événement attendu');
    expect(editionKey(e, '2026-12-30')).toBe('nouvel-an-2026');
    expect(editionKey(e, '2027-01-03')).toBe('nouvel-an-2026');
    expect(daysLeft(e, '2027-01-07')).toBe(1);
  });

  it('revient chaque année, jamais deux événements en même temps', () => {
    for (let d = 0; d < 365 * 3; d++) {
      const day = addDays('2025-01-01', d);
      expect(activeEvents(day).length).toBeLessThanOrEqual(1);
    }
    const e = eventById('printemps');
    if (!e) throw new Error('événement attendu');
    expect(isActive(e, '2026-04-01')).toBe(true);
    expect(isActive(e, '2031-04-01')).toBe(true);
    expect(editionKey(e, '2031-04-01')).toBe('printemps-2031');
  });

  it('prochain événement et compte à rebours', () => {
    expect(nextEvent('2026-09-29')).toMatchObject({ event: { id: 'halloween' }, inDays: 16 });
    expect(nextEvent('2026-12-05').event.id).toBe('nouvel-an');
    expect(nextEvent('2027-01-02').event.id).toBe('saint-valentin');
    expect(new Set(EVENTS.map((e) => e.decor)).size).toBe(EVENTS.length);
  });
});
