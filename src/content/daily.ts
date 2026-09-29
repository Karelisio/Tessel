import { t, type I18nText } from '@/i18n/text';
import { addDays, dayNumber, type DayKey } from '@/meta/time';
import type { CategoryId } from './categories';
import { GENERATORS } from './generators';
import type { Grid } from './grid';
import { hashString } from './random';

/** Générateurs proposés pour l'œuvre du jour, avec leur poids et un nom pour le titre. */
const DAILY_POOL: readonly { id: string; weight: number; name: I18nText }[] = [
  { id: 'mandala', weight: 4, name: t('Mandala', 'Mandala') },
  { id: 'quilt', weight: 2, name: t('Patchwork', 'Patchwork') },
  { id: 'truchet', weight: 1, name: t('Labyrinthe', 'Maze') },
  { id: 'stars', weight: 1, name: t('Étoiles', 'Stars') },
  { id: 'hexagons', weight: 1, name: t('Alvéoles', 'Honeycomb') },
  { id: 'seigaiha', weight: 1, name: t('Vagues', 'Waves') },
  { id: 'phyllotaxis', weight: 2, name: t('Fleur', 'Flower') },
  { id: 'mountains', weight: 2, name: t('Montagnes', 'Mountains') },
  { id: 'dunes', weight: 1, name: t('Dunes', 'Dunes') },
  { id: 'fields', weight: 2, name: t('Champs', 'Fields') },
  { id: 'forest', weight: 2, name: t('Forêt', 'Forest') },
  { id: 'seascape', weight: 2, name: t('Bord de mer', 'Seaside') },
  { id: 'planet', weight: 1, name: t('Planète', 'Planet') },
  { id: 'galaxy', weight: 1, name: t('Galaxie', 'Galaxy') },
  { id: 'starry-night', weight: 1, name: t('Nuit étoilée', 'Starry night') },
  { id: 'aurora', weight: 1, name: t('Aurore boréale', 'Northern lights') },
  { id: 'season-tree', weight: 2, name: t('Arbre', 'Tree') },
];

/** Plus grand côté de l'œuvre du jour : de quoi la terminer en une séance (~2 000 cases). */
export const DAILY_LONG_SIDE = 48;

export interface DailyArtwork {
  /** Identifiant de projet : une partie par jour. */
  id: string;
  day: DayKey;
  generator: string;
  seed: number;
  title: I18nText;
  category: CategoryId;
  width: number;
  height: number;
  grid(): Grid;
}

function poolIndex(day: DayKey): number {
  const total = DAILY_POOL.reduce((s, p) => s + p.weight, 0);
  let r = hashString(`tessel-daily:${day}`) % total;
  for (let i = 0; i < DAILY_POOL.length; i++) {
    r -= DAILY_POOL[i]?.weight ?? 0;
    if (r < 0) return i;
  }
  return 0;
}

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Œuvre du jour : un générateur et une graine tirés de la date (hors ligne, identique pour tous
 * les joueurs), jamais le même générateur deux jours de suite.
 */
export function dailyArtwork(day: DayKey): DailyArtwork {
  let index = poolIndex(day);
  if (index === poolIndex(addDays(day, -1))) index = (index + 1 + (dayNumber(day) % 3)) % DAILY_POOL.length;
  const entry = DAILY_POOL[index] ?? DAILY_POOL[0];
  if (!entry) throw new Error('Aucun générateur pour l’œuvre du jour');
  const gen = GENERATORS[entry.id];
  if (!gen) throw new Error(`Générateur inconnu : ${entry.id}`);
  const seed = (hashString(`tessel-seed:${day}`) % 100_000) + 1;
  const portrait = gen.aspect > 1;
  const width = portrait ? Math.round(DAILY_LONG_SIDE / gen.aspect) : DAILY_LONG_SIDE;
  const height = portrait ? DAILY_LONG_SIDE : Math.round(DAILY_LONG_SIDE * gen.aspect);
  const [, m = 1, d = 1] = day.split('-').map(Number);
  return {
    id: `daily:${day}`,
    day,
    generator: entry.id,
    seed,
    title: t(
      `${entry.name.fr} du ${d === 1 ? '1er' : d} ${MONTHS_FR[m - 1] ?? ''}`,
      `${entry.name.en}, ${MONTHS_EN[m - 1] ?? ''} ${d}`,
    ),
    category: gen.category,
    width,
    height,
    grid: () => gen.render(width, height, seed),
  };
}
