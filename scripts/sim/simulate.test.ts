import { describe, expect, it } from 'vitest';
import { PROFILES, simulate } from './simulate';

const dayOf = (r: ReturnType<typeof simulate>, level: number) => (r.levelDay.get(level) ?? Infinity) + 1;

describe('équilibrage de la progression (simulation)', () => {
  const regular = simulate(PROFILES.regular, 450);

  it('joueur régulier : jalons de niveau', () => {
    expect(regular.samples[0]?.level).toBeGreaterThanOrEqual(3);
    expect(regular.samples[0]?.level).toBeLessThanOrEqual(6);
    expect(dayOf(regular, 10)).toBeLessThanOrEqual(6);
    expect(dayOf(regular, 30)).toBeGreaterThanOrEqual(15);
    expect(dayOf(regular, 30)).toBeLessThanOrEqual(40);
    expect(dayOf(regular, 50)).toBeGreaterThanOrEqual(60);
    expect(dayOf(regular, 50)).toBeLessThanOrEqual(120);
    expect(dayOf(regular, 100)).toBeGreaterThanOrEqual(330);
    expect(dayOf(regular, 100)).toBeLessThanOrEqual(520);
  });

  it('les cases posées restent la source principale d’XP', () => {
    const total = Object.values(regular.xpBySource).reduce((s, v) => s + v, 0);
    expect((regular.xpBySource.cases ?? 0) / total).toBeGreaterThan(0.5);
    expect((regular.xpBySource.quetes ?? 0) / total).toBeLessThan(0.25);
  });

  it('outils : ni pénurie ni accumulation absurde', () => {
    const last = regular.samples[regular.samples.length - 1];
    expect(last?.tools.loupe).toBeLessThan(150);
    expect(regular.toolsUsed.bucket).toBeGreaterThan(100);
    expect(regular.toolsUsed.wand).toBeGreaterThan(50);
  });

  it('occasionnel et assidu : toujours des niveaux, sans excès', () => {
    const casual = simulate(PROFILES.casual, 365);
    expect(dayOf(casual, 10)).toBeLessThanOrEqual(21);
    expect(casual.samples[364]?.level).toBeGreaterThanOrEqual(45);
    const dedicated = simulate(PROFILES.dedicated, 365);
    expect(dayOf(dedicated, 100)).toBeGreaterThanOrEqual(120);
  });
});
