import { mulberry32 } from '@/content/random';
import { MetaService, type ArtworkContext, type MetaNotice } from '@/meta/MetaService';
import { MODE_IDS, type ModeId } from '@/modes/types';
import type { CategoryId } from '@/content/categories';
import { totalXp, type ToolId } from '@/meta/rewards';

/** Un type de joueur : temps de jeu, régularité, vitesse de pose. */
export interface Profile {
  name: string;
  minutesPerDay: number;
  /** Probabilité de jouer un jour donné. */
  playChance: number;
  cellsPerMinute: number;
  /** Importe une photo tous les N jours (0 = jamais). */
  photoEveryDays: number;
}

export const PROFILES: Readonly<Record<'casual' | 'regular' | 'dedicated', Profile>> = {
  casual: { name: 'occasionnel', minutesPerDay: 10, playChance: 0.7, cellsPerMinute: 100, photoEveryDays: 0 },
  regular: { name: 'régulier', minutesPerDay: 20, playChance: 0.9, cellsPerMinute: 110, photoEveryDays: 10 },
  dedicated: { name: 'assidu', minutesPerDay: 45, playChance: 0.98, cellsPerMinute: 120, photoEveryDays: 5 },
};

export interface DaySample {
  day: number;
  level: number;
  xp: number;
  achievements: number;
  artworks: number;
  tools: Record<ToolId, number>;
  streak: number;
}

export interface SimResult {
  profile: Profile;
  samples: DaySample[];
  /** Jour où chaque niveau a été atteint. */
  levelDay: Map<number, number>;
  /** Répartition de l'XP par source. */
  xpBySource: Record<string, number>;
  toolsUsed: Record<ToolId, number>;
}

interface Current {
  ctx: ArtworkContext;
  filled: number;
  tracker: ReturnType<MetaService['startArtwork']>;
  colorsDone: number;
  loupes: number;
}

const SIZES: readonly (readonly [side: number, colors: number])[] = [
  [40, 10],
  [64, 16],
  [100, 22],
  [150, 32],
  [220, 48],
];

/** Taille choisie selon le niveau : on passe peu à peu aux grandes œuvres. */
function pickSize(level: number, rnd: () => number): readonly [number, number] {
  const weights =
    level < 5
      ? [6, 4, 0, 0, 0]
      : level < 15
        ? [3, 3, 3, 1, 0]
        : level < 40
          ? [2, 2, 3, 2, 1]
          : [1, 2, 3, 3, 1];
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rnd() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] ?? 0;
    if (r < 0) return SIZES[i] ?? [40, 10];
  }
  return [40, 10];
}

/**
 * Simule `days` jours de jeu d'un profil : pose des cases, termine des œuvres, suit ses quêtes,
 * utilise ses outils, ouvre ses coffres. Déterministe (graine fixe).
 */
export function simulate(profile: Profile, days: number, seed = 7): SimResult {
  const rnd = mulberry32(seed);
  const start = new Date(2026, 0, 5, 20, 0).getTime();
  const clock = { t: start, now: () => clock.t };
  const meta = MetaService.inMemory({ clock });
  const xpBySource: Record<string, number> = {
    cases: 0,
    finOeuvre: 0,
    quetes: 0,
    succes: 0,
    serie: 0,
    coffres: 0,
  };
  const toolsUsed: Record<ToolId, number> = { loupe: 0, bucket: 0, wand: 0 };
  const levelDay = new Map<number, number>([[1, 0]]);
  let dayIndex = 0;
  meta.onNotice((n: MetaNotice) => {
    if (n.type === 'levelUp') levelDay.set(n.level, dayIndex);
    const xp = totalXp(n.rewards);
    if (n.type === 'quest') xpBySource.quetes = (xpBySource.quetes ?? 0) + xp;
    if (n.type === 'achievement') xpBySource.succes = (xpBySource.succes ?? 0) + xp;
    if (n.type === 'streak') xpBySource.serie = (xpBySource.serie ?? 0) + xp;
  });

  let current: Current | null = null;
  let projects = 0;
  let pendingPhoto = false;
  const samples: DaySample[] = [];

  const newArtwork = (): Current => {
    const quests = meta.quests().filter((q) => q.doneAt === null);
    const want = (prefix: string) => quests.find((q) => q.metric.startsWith(prefix));
    const modes = meta.unlockedModes;
    const cats = meta.unlockedCategories;
    let mode: ModeId = modes[Math.floor(rnd() * modes.length)] ?? 'pixel';
    let category: CategoryId | null = cats[Math.floor(rnd() * cats.length)] ?? null;
    let source: ArtworkContext['source'] = 'library';
    let [side, colors] = pickSize(meta.level, rnd);
    // le joueur suit volontiers ses quêtes
    const byMode = want('artworks.mode.') ?? want('cells.mode.');
    if (byMode?.params.mode) mode = byMode.params.mode;
    const byCat = want('artworks.category.');
    if (byCat?.params.category) category = byCat.params.category;
    if (want('artworks.daily') || rnd() < 0.5) {
      source = 'daily';
      [side, colors] = [50, 12];
    } else if (pendingPhoto || want('artworks.photo')) {
      source = 'photo';
      pendingPhoto = false;
      [side, colors] = [80, 20];
    } else if (want('artworks.size.large') && side < 100) [side, colors] = [100, 22];
    const cells = Math.round(side * side * 0.92);
    const ctx: ArtworkContext = {
      projectId: `p${++projects}`,
      artworkId: `a${projects}`,
      mode,
      source,
      category: source === 'photo' ? null : category,
      cells,
      colors,
      startedAt: clock.t,
      filled: 0,
      undos: 0,
      errors: 0,
      tools: 0,
    };
    return { ctx, filled: 0, tracker: meta.startArtwork(ctx), colorsDone: 0, loupes: 0 };
  };

  const place = (c: Current, n: number) => {
    const before = meta.xp;
    c.filled = Math.min(c.ctx.cells, c.filled + n);
    c.tracker.progress(c.filled);
    const target = Math.floor((c.filled / c.ctx.cells) * c.ctx.colors);
    while (c.colorsDone < target) {
      c.tracker.colorDone(c.colorsDone, c.colorsDone * 7919, Math.round(c.ctx.cells / c.ctx.colors));
      c.colorsDone++;
    }
    xpBySource.cases = (xpBySource.cases ?? 0) + (meta.xp - before);
  };

  const applyTool = (tool: ToolId): boolean => {
    if (!meta.consumeTool(tool)) return false;
    toolsUsed[tool]++;
    current?.tracker.count('tools');
    return true;
  };

  for (dayIndex = 0; dayIndex < days; dayIndex++) {
    const d = new Date(start);
    clock.t = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() + dayIndex,
      19 + Math.floor(rnd() * 3),
    ).getTime();
    if (profile.photoEveryDays > 0 && dayIndex % profile.photoEveryDays === 3) {
      meta.record('photos');
      pendingPhoto = true;
    }
    if (rnd() < profile.playChance) {
      let budget = profile.minutesPerDay * 60_000 * (0.7 + rnd() * 0.6);
      const msPerCell = 60_000 / profile.cellsPerMinute;
      while (budget > 0) {
        current ??= newArtwork();
        const c: Current = current;
        const left = c.ctx.cells - c.filled;
        // outils : pot sur les grands aplats, baguette quand la réserve le permet, loupe en fin d'œuvre
        if (left > c.ctx.cells * 0.3 && meta.tools('bucket') > 3 && rnd() < 0.3 && applyTool('bucket')) {
          place(c, Math.round(c.ctx.cells * 0.03));
          continue;
        }
        if (meta.tools('wand') > 2 && rnd() < 0.2 && applyTool('wand')) {
          place(c, Math.round(c.ctx.cells / c.ctx.colors));
          continue;
        }
        // chercher les dernières cases : jusqu'à 3 loupes par œuvre
        if (c.loupes < 3 && left < c.ctx.cells * 0.02 && left < 40 * (3 - c.loupes) && applyTool('loupe')) {
          c.loupes++;
        }
        const n = Math.max(1, Math.min(left, 40));
        const ms = n * msPerCell;
        clock.t += ms;
        budget -= ms;
        place(c, n);
        c.tracker.activeTime(ms);
        if (c.filled >= c.ctx.cells) {
          const bonus = c.tracker.complete(1);
          xpBySource.finOeuvre = (xpBySource.finOeuvre ?? 0) + bonus;
          if (rnd() < 0.3 || meta.quests().some((q) => q.doneAt === null && q.metric === 'timelapses'))
            meta.record('timelapses');
          current = null;
        }
      }
      // quêtes impossibles à suivre naturellement : on les remplace
      for (const q of meta.quests('daily')) {
        if (q.doneAt === null && (q.metric === 'artworks.creation' || q.metric === 'tools') && meta.canReroll)
          meta.rerollQuest(q.id);
      }
      for (const size of ['small', 'medium', 'large'] as const) {
        while (meta.chests(size) > 0) {
          const before = meta.xp;
          meta.openChest(size);
          xpBySource.coffres = (xpBySource.coffres ?? 0) + (meta.xp - before);
        }
      }
    }
    samples.push({
      day: dayIndex + 1,
      level: meta.level,
      xp: meta.xp,
      achievements: meta.achievementCount,
      artworks: meta.stat('artworks'),
      tools: { loupe: meta.tools('loupe'), bucket: meta.tools('bucket'), wand: meta.tools('wand') },
      streak: meta.streak.current,
    });
  }
  // l'XP « cases » inclut ce que les poses déclenchent (quêtes, succès, série) : on la corrige
  xpBySource.cases =
    (xpBySource.cases ?? 0) - (xpBySource.quetes ?? 0) - (xpBySource.succes ?? 0) - (xpBySource.serie ?? 0);
  return { profile, samples, levelDay, xpBySource, toolsUsed };
}

export const MODES_COUNT = MODE_IDS.length;
