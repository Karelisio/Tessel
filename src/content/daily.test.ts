import { describe, expect, it } from 'vitest';
import { addDays } from '@/meta/time';
import { dailyArtwork } from './daily';

describe('œuvre du jour', () => {
  it('déterministe : même jour, même œuvre (même grille)', () => {
    const a = dailyArtwork('2026-09-29');
    const b = dailyArtwork('2026-09-29');
    expect(a.id).toBe('daily:2026-09-29');
    expect([a.generator, a.seed]).toEqual([b.generator, b.seed]);
    const ga = a.grid();
    const gb = b.grid();
    expect(ga.cells).toEqual(gb.cells);
    expect(ga.palette).toEqual(gb.palette);
    expect([ga.width, ga.height]).toEqual([a.width, a.height]);
  });

  it('change chaque jour, jamais le même générateur deux jours de suite, et varie sur l’année', () => {
    const seen = new Set<string>();
    let previous = dailyArtwork('2025-12-31');
    for (let d = 0; d < 365; d++) {
      const day = dailyArtwork(addDays('2026-01-01', d));
      expect(day.generator).not.toBe(previous.generator);
      expect(day.seed).not.toBe(previous.seed);
      seen.add(day.generator);
      previous = day;
    }
    expect(seen.size).toBeGreaterThanOrEqual(15);
  });

  it('taille d’une séance, titre daté', () => {
    for (let d = 0; d < 40; d++) {
      const a = dailyArtwork(addDays('2026-03-01', d));
      expect(Math.max(a.width, a.height)).toBe(48);
      const g = a.grid();
      expect(g.palette.length).toBeGreaterThanOrEqual(3);
      expect(g.palette.length).toBeLessThanOrEqual(24);
    }
    expect(dailyArtwork('2026-09-01').title.fr).toMatch(/du 1er septembre$/);
    expect(dailyArtwork('2026-09-29').title.en).toMatch(/September 29$/);
  });
});
