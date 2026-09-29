/**
 * Courbe d'XP : coût du passage n → n+1 = base + scale·n^exponent.
 * Calibrée par scripts/sim/progression.ts sur un joueur régulier (~20 min/jour) :
 * niveau 10 vers le 3e jour, 30 vers 1 mois, 50 vers 3 mois, 100 vers 14 mois ; niveaux illimités.
 */
export const LEVEL_CURVE = { base: 800, scale: 330, exponent: 1 } as const;

export function xpToNext(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return Math.round(LEVEL_CURVE.base + LEVEL_CURVE.scale * n ** LEVEL_CURVE.exponent);
}

/** cumulative[n] = XP totale nécessaire pour atteindre le niveau n (niveau 1 = 0). */
const cumulative: number[] = [0, 0];

function ensure(level: number): void {
  while (cumulative.length <= level) {
    const n = cumulative.length - 1;
    cumulative.push((cumulative[n] ?? 0) + xpToNext(n));
  }
}

export function totalXpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  ensure(n);
  return cumulative[n] ?? 0;
}

export interface LevelInfo {
  level: number;
  /** XP gagnée depuis le début du niveau. */
  into: number;
  /** XP nécessaire pour passer au niveau suivant. */
  span: number;
  /** Avancement dans le niveau, de 0 à 1. */
  progress: number;
}

export function levelForXp(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  let level = 1;
  while (totalXpForLevel(level + 1) <= xp) level++;
  return level;
}

export function levelInfo(totalXp: number): LevelInfo {
  const level = levelForXp(totalXp);
  const into = Math.max(0, totalXp) - totalXpForLevel(level);
  const span = xpToNext(level);
  return { level, into, span, progress: into / span };
}

/** Bonus des grandes œuvres, selon le nombre de cases à poser. */
export function sizeMultiplier(cells: number): number {
  if (cells <= 64 * 64) return 1;
  if (cells <= 128 * 128) return 1.2;
  if (cells <= 200 * 200) return 1.4;
  return 1.6;
}

/** Bonus découverte : les premières œuvres terminées dans chaque mode rapportent plus. */
export const DISCOVERY = { artworks: 3, multiplier: 1.5 } as const;

/** XP par case posée. */
export function cellXpRate(cells: number, discovery: boolean): number {
  return sizeMultiplier(cells) * (discovery ? DISCOVERY.multiplier : 1);
}

/** Prime de fin d'œuvre : 15 % des cases + 50, avec le bonus de taille. */
export function completionXp(cells: number): number {
  return Math.round((cells * 0.15 + 50) * sizeMultiplier(cells));
}

/** Les récompenses en XP (quêtes, coffres) grandissent avec le niveau pour garder leur saveur. */
export function xpScale(level: number): number {
  return 1 + (Math.max(1, level) - 1) / 40;
}
