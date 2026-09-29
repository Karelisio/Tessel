import { prestigeBadge, type UnlockKey } from './catalog';
import { reward, type Reward } from './rewards';

/**
 * Nouveautés par niveau, du 2 au 80 : au moins une à chaque niveau (testé).
 * Les modes et catégories arrivent tôt, puis ambiances et musiques, puis le cosmétique.
 */
export const LEVEL_UNLOCKS: Readonly<Record<number, readonly UnlockKey[]>> = {
  2: ['mode:diamond'],
  3: ['category:mandalas'],
  4: ['frame:noyer'],
  5: ['category:mer'],
  6: ['mode:crossstitch'],
  7: ['music:5'],
  8: ['category:oiseaux'],
  9: ['ambience:feu'],
  10: ['mode:mosaic'],
  11: ['category:espace'],
  12: ['palette:sepia'],
  13: ['texture:pixel-aquarelle'],
  14: ['category:jardin'],
  15: ['frame:argent'],
  16: ['music:6'],
  17: ['category:architecture'],
  18: ['ambience:cafe'],
  19: ['wall:brique'],
  20: ['category:nuit'],
  21: ['texture:diamond-carre'],
  22: ['palette:ocean'],
  23: ['frame:rose-poudre'],
  24: ['category:japon'],
  25: ['music:7'],
  26: ['texture:crossstitch-ecru'],
  27: ['ambience:foret'],
  28: ['category:insectes'],
  29: ['wall:beton'],
  30: ['frame:bambou'],
  31: ['palette:automne'],
  32: ['category:saisons'],
  33: ['texture:mosaic-verre'],
  34: ['music:8'],
  35: ['frame:cuivre'],
  36: ['ambience:vagues'],
  37: ['palette:neon'],
  38: ['wall:velours'],
  39: ['texture:pixel-kraft'],
  40: ['frame:laque-noire'],
  41: ['palette:bonbon'],
  42: ['texture:diamond-aurore'],
  43: ['frame:menthe'],
  44: ['wall:lambris'],
  45: ['palette:terre'],
  46: ['texture:crossstitch-lin'],
  47: ['frame:baroque'],
  48: ['palette:nordique'],
  49: ['texture:mosaic-ceramique'],
  50: ['frame:chene-blanchi'],
  51: ['wall:papier-peint'],
  52: ['palette:vintage'],
  53: ['texture:pixel-carnet'],
  54: ['frame:ivoire'],
  55: ['palette:aurore'],
  56: ['texture:crossstitch-noir'],
  57: ['frame:terracotta'],
  58: ['wall:ardoise'],
  59: ['palette:crepuscule'],
  60: ['frame:emeraude'],
  61: ['texture:mosaic-marbre'],
  62: ['palette:pop'],
  63: ['frame:nacre'],
  64: ['wall:nuit-etoilee'],
  65: ['texture:pixel-toile'],
  66: ['frame:ebene'],
  67: ['palette:givre'],
  68: ['texture:crossstitch-bleu-nuit'],
  69: ['frame:lavande'],
  70: ['wall:marbre'],
  71: ['frame:bronze'],
  72: ['texture:mosaic-smalt'],
  73: ['frame:corail'],
  74: ['texture:crossstitch-rose'],
  75: ['frame:or-rose'],
  76: ['frame:marbre'],
  77: ['frame:saphir'],
  78: ['frame:cerisier'],
  79: ['frame:champagne'],
  80: ['frame:obsidienne', 'frame:aurore'],
};

export const LAST_SCHEDULED_LEVEL = 80;

/**
 * Récompenses du passage au niveau `level` : nouveautés + outils.
 * Jusqu'au 80 : loupe (pair) ou pot (impair), baguette tous les 5, joker tous les 10.
 * Au-delà : loupe + pot à chaque niveau, baguette et coffre tous les 5, joker et badge de prestige tous les 10.
 */
export function levelRewards(level: number): Reward[] {
  if (level < 2) return [];
  const out: Reward[] = (LEVEL_UNLOCKS[level] ?? []).map((key) => reward.unlock(key));
  if (level <= LAST_SCHEDULED_LEVEL) {
    out.push(reward.tool(level % 2 === 0 ? 'loupe' : 'bucket'));
    if (level % 5 === 0) out.push(reward.tool('wand'));
    if (level % 10 === 0) out.push(reward.freeze());
    return out;
  }
  out.push(reward.tool('loupe'), reward.tool('bucket'));
  if (level % 5 === 0) out.push(reward.tool('wand'), reward.chest('medium'));
  if (level % 10 === 0) {
    out.push(reward.freeze(), reward.unlock(prestigeBadge((level - LAST_SCHEDULED_LEVEL) / 10).key));
  }
  return out;
}

const LEVEL_OF = new Map<UnlockKey, number>(
  Object.entries(LEVEL_UNLOCKS).flatMap(([level, keys]) => keys.map((k) => [k, Number(level)] as const)),
);

/** Niveau de déblocage d'un élément (undefined : dès le départ ou autre source). */
export function unlockLevel(key: UnlockKey): number | undefined {
  return LEVEL_OF.get(key);
}
