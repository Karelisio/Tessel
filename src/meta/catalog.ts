import { CATEGORIES } from '@/content/categories';
import { t, type I18nText } from '@/i18n/text';

export type UnlockKind =
  'mode' | 'category' | 'frame' | 'texture' | 'palette' | 'wall' | 'ambience' | 'music' | 'badge';

/** Clé d'un élément à débloquer : `genre:id`. */
export type UnlockKey = `${UnlockKind}:${string}`;

export interface CatalogItem {
  readonly key: UnlockKey;
  readonly name: I18nText;
  /** Disponible dès le premier lancement. */
  readonly starter?: boolean;
}

const item = (key: UnlockKey, name: I18nText, starter = false): CatalogItem =>
  starter ? { key, name, starter } : { key, name };

/**
 * Tout ce qui se débloque. Les paramètres visuels (couleurs des cadres, matières, palettes…)
 * vivent avec leur rendu ; ici seulement l'identité et le nom. Thèmes d'interface et options
 * d'accessibilité ne sont jamais verrouillés.
 */
export const CATALOG: readonly CatalogItem[] = [
  item('mode:pixel', t('Pixel art', 'Pixel art'), true),
  item('mode:diamond', t('Diamond painting', 'Diamond painting')),
  item('mode:crossstitch', t('Point de croix', 'Cross-stitch')),
  item('mode:mosaic', t('Mosaïque', 'Mosaic')),

  ...CATEGORIES.map((c, i) => item(`category:${c.id}`, c.name, i < 6)),

  item('frame:blanc', t('Blanc galerie', 'Gallery white'), true),
  item('frame:or', t('Or', 'Gold'), true),
  item('frame:chene', t('Chêne', 'Oak'), true),
  item('frame:ardoise', t('Ardoise', 'Slate'), true),
  item('frame:noyer', t('Noyer', 'Walnut')),
  item('frame:argent', t('Argent', 'Silver')),
  item('frame:rose-poudre', t('Rose poudré', 'Powder pink')),
  item('frame:bambou', t('Bambou', 'Bamboo')),
  item('frame:cuivre', t('Cuivre', 'Copper')),
  item('frame:laque-noire', t('Laque noire', 'Black lacquer')),
  item('frame:menthe', t('Menthe', 'Mint')),
  item('frame:baroque', t('Baroque', 'Baroque')),
  item('frame:chene-blanchi', t('Chêne blanchi', 'Whitewashed oak')),
  item('frame:ivoire', t('Ivoire', 'Ivory')),
  item('frame:terracotta', t('Terre cuite', 'Terracotta')),
  item('frame:emeraude', t('Émeraude', 'Emerald')),
  item('frame:nacre', t('Nacre', 'Mother-of-pearl')),
  item('frame:ebene', t('Ébène', 'Ebony')),
  item('frame:lavande', t('Lavande', 'Lavender')),
  item('frame:bronze', t('Bronze', 'Bronze')),
  item('frame:corail', t('Corail', 'Coral')),
  item('frame:or-rose', t('Or rose', 'Rose gold')),
  item('frame:marbre', t('Marbre', 'Marble')),
  item('frame:saphir', t('Saphir', 'Sapphire')),
  item('frame:cerisier', t('Cerisier', 'Cherry wood')),
  item('frame:champagne', t('Champagne', 'Champagne')),
  item('frame:obsidienne', t('Obsidienne', 'Obsidian')),
  item('frame:aurore', t('Aurore', 'Aurora')),

  item('texture:pixel-lisse', t('Papier lisse', 'Smooth paper'), true),
  item('texture:pixel-aquarelle', t('Papier aquarelle', 'Watercolor paper')),
  item('texture:pixel-kraft', t('Papier kraft', 'Kraft paper')),
  item('texture:pixel-carnet', t('Carnet pointillé', 'Dotted notebook')),
  item('texture:pixel-toile', t('Toile de peintre', 'Painter’s canvas')),
  item('texture:diamond-rond', t('Diamants ronds', 'Round drills'), true),
  item('texture:diamond-carre', t('Diamants carrés', 'Square drills')),
  item('texture:diamond-aurore', t('Diamants aurore boréale', 'Aurora borealis drills')),
  item('texture:crossstitch-blanc', t('Aïda blanche', 'White Aida'), true),
  item('texture:crossstitch-ecru', t('Aïda écrue', 'Ecru Aida')),
  item('texture:crossstitch-lin', t('Lin naturel', 'Natural linen')),
  item('texture:crossstitch-noir', t('Aïda noire', 'Black Aida')),
  item('texture:crossstitch-bleu-nuit', t('Aïda bleu nuit', 'Midnight Aida')),
  item('texture:crossstitch-rose', t('Aïda rose', 'Pink Aida')),
  item('texture:mosaic-pierre', t('Pierre', 'Stone'), true),
  item('texture:mosaic-verre', t('Pâte de verre', 'Glass')),
  item('texture:mosaic-ceramique', t('Céramique', 'Ceramic')),
  item('texture:mosaic-marbre', t('Marbre', 'Marble')),
  item('texture:mosaic-smalt', t('Smalts dorés', 'Gold smalti')),

  item('palette:classique', t('Classique', 'Classic'), true),
  item('palette:pastel', t('Pastel', 'Pastel'), true),
  item('palette:nature', t('Nature', 'Nature'), true),
  item('palette:sepia', t('Sépia', 'Sepia')),
  item('palette:ocean', t('Océan', 'Ocean')),
  item('palette:automne', t('Automne', 'Autumn')),
  item('palette:neon', t('Néon', 'Neon')),
  item('palette:bonbon', t('Bonbon', 'Candy')),
  item('palette:terre', t('Terre', 'Earth')),
  item('palette:nordique', t('Nordique', 'Nordic')),
  item('palette:vintage', t('Vintage', 'Vintage')),
  item('palette:aurore', t('Aurore', 'Dawn')),
  item('palette:crepuscule', t('Crépuscule', 'Dusk')),
  item('palette:pop', t('Pop', 'Pop')),
  item('palette:givre', t('Givre', 'Frost')),

  item('wall:platre', t('Plâtre', 'Plaster'), true),
  item('wall:bois-clair', t('Bois clair', 'Light wood'), true),
  item('wall:brique', t('Brique', 'Brick')),
  item('wall:beton', t('Béton ciré', 'Polished concrete')),
  item('wall:velours', t('Velours', 'Velvet')),
  item('wall:lambris', t('Lambris', 'Wood panelling')),
  item('wall:papier-peint', t('Papier peint fleuri', 'Floral wallpaper')),
  item('wall:ardoise', t('Ardoise', 'Slate')),
  item('wall:nuit-etoilee', t('Nuit étoilée', 'Starry night')),
  item('wall:marbre', t('Marbre', 'Marble')),

  item('ambience:pluie', t('Pluie', 'Rain'), true),
  item('ambience:feu', t('Feu de cheminée', 'Fireplace')),
  item('ambience:cafe', t('Café', 'Café')),
  item('ambience:foret', t('Forêt', 'Forest')),
  item('ambience:vagues', t('Vagues', 'Waves')),

  // pistes par numéro d'emplacement : tracks.json peut remplacer les fichiers sans toucher au code
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => item(`music:${n}`, t(`Piste ${n}`, `Track ${n}`), n <= 4)),

  // obtenus par les séries et les succès (voir streak.ts et achievements.data.ts)
  item('frame:flamme', t('Flamme', 'Flame')),
  item('frame:constellation', t('Constellation', 'Constellation')),
  item('frame:jubile', t('Jubilé', 'Jubilee')),
  item('frame:centenaire', t('Centenaire', 'Centennial')),
  item('frame:millier', t('Mille œuvres', 'Thousand works')),
  item('frame:prisme', t('Prisme', 'Prism')),
  item('wall:atelier', t('Atelier d’artiste', 'Artist’s studio')),
  item('wall:musee', t('Salle de musée', 'Museum hall')),
];

const BY_KEY = new Map(CATALOG.map((c) => [c.key, c]));

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Badges de prestige (au-delà du niveau 80) : générés à l'infini. */
export function prestigeBadge(tier: number): CatalogItem {
  const label = tier <= ROMAN.length ? (ROMAN[tier - 1] ?? String(tier)) : String(tier);
  return item(`badge:prestige-${tier}`, t(`Prestige ${label}`, `Prestige ${label}`));
}

export function catalogItem(key: UnlockKey): CatalogItem | undefined {
  const known = BY_KEY.get(key);
  if (known) return known;
  const m = /^badge:prestige-(\d+)$/.exec(key);
  return m ? prestigeBadge(Number(m[1])) : undefined;
}

export function unlockKind(key: UnlockKey): UnlockKind {
  return key.slice(0, key.indexOf(':')) as UnlockKind;
}

export function unlockId(key: UnlockKey): string {
  return key.slice(key.indexOf(':') + 1);
}

export const STARTER_UNLOCKS: readonly UnlockKey[] = CATALOG.filter((c) => c.starter).map((c) => c.key);
