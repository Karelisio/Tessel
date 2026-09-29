import { t, type I18nText } from '@/i18n/text';
import { reward, type Reward } from '@/meta/rewards';

export interface CollectionDef {
  readonly id: string;
  readonly name: I18nText;
  /** Œuvres de la bibliothèque (identifiants sans difficulté) : toutes à terminer, dans n'importe quel mode. */
  readonly artworks: readonly string[];
}

const c = (id: string, name: I18nText, artworks: string[]): CollectionDef => ({ id, name, artworks });
const mandalas = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `mandalas/mandala-${String(from + i).padStart(2, '0')}`);

/** Collections thématiques : chacune se termine une fois et rapporte un coffre. */
export const COLLECTIONS: readonly CollectionDef[] = [
  c('amis-foret', t('Les amis de la forêt', 'Forest friends'), [
    'animaux/renard',
    'animaux/cerf',
    'animaux/ecureuil',
    'animaux/herisson',
    'animaux/raton-laveur',
    'paysages/foret-ete',
  ]),
  c('calins', t('Câlins', 'Cuddles'), [
    'animaux/chat-endormi',
    'animaux/chiot',
    'animaux/lapin',
    'animaux/koala',
    'animaux/panda',
    'animaux/ours',
  ]),
  c('bouquet', t('Le grand bouquet', 'The big bouquet'), [
    'fleurs/coquelicots',
    'fleurs/tulipes',
    'fleurs/rose',
    'fleurs/iris',
    'fleurs/marguerites',
    'fleurs/tournesol',
  ]),
  c('jardin-secret', t('Jardin secret', 'Secret garden'), [
    'jardin/arrosoir',
    'jardin/cabane',
    'jardin/banc',
    'jardin/bassin',
    'jardin/nichoir',
    'jardin/serre',
  ]),
  c('recolte', t('Belle récolte', 'Good harvest'), [
    'jardin/potager',
    'jardin/brouette',
    'nourriture/pommes',
    'nourriture/fraises',
    'nourriture/citrons',
    'nourriture/pasteque',
  ]),
  c('salon-de-the', t('Salon de thé', 'Tea room'), [
    'nourriture/the',
    'nourriture/croissant',
    'nourriture/gateau',
    'nourriture/macarons',
    'nourriture/cupcake',
    'nourriture/glace',
  ]),
  c('mandalas-1', t('Mandalas, premier cercle', 'Mandalas, first circle'), mandalas(1, 6)),
  c('mandalas-2', t('Mandalas, second cercle', 'Mandalas, second circle'), mandalas(7, 12)),
  c('geometries', t('Géométries', 'Geometries'), [
    'motifs/patchwork-terre',
    'motifs/patchwork-lagon',
    'motifs/patchwork-rose',
    'motifs/patchwork-bleu',
    'motifs/zellige-bleu',
    'motifs/alveoles-rose',
  ]),
  c('illusions', t('Illusions', 'Illusions'), [
    'motifs/labyrinthe-foret',
    'motifs/labyrinthe-cerise',
    'motifs/losanges-nuit',
    'motifs/losanges-corail',
    'motifs/fractale-prune',
    'motifs/fractale-emeraude',
  ]),
  c('au-fil-eau', t('Au fil de l’eau', 'Under the sea'), [
    'mer/baleine',
    'mer/tortue',
    'mer/poisson-clown',
    'mer/meduses',
    'mer/voilier',
    'mer/phare',
  ]),
  c('rivages', t('Rivages', 'Shores'), [
    'mer/bord-de-mer',
    'mer/phare-couchant',
    'paysages/lac-couchant',
    'paysages/montagnes-soir',
    'japon/seigaiha-nuit',
    'jardin/bassin',
  ]),
  c('grands-espaces', t('Grands espaces', 'Wide open spaces'), [
    'paysages/montagnes-matin',
    'paysages/montagnes-aube',
    'paysages/dunes-midi',
    'paysages/dunes-couchant',
    'paysages/champs-fleurs',
    'paysages/foret-aube',
  ]),
  c('plumes', t('Plumes', 'Feathers'), [
    'oiseaux/chouette',
    'oiseaux/rouge-gorge',
    'oiseaux/flamant-rose',
    'oiseaux/toucan',
    'oiseaux/cygne',
    'oiseaux/mesange',
  ]),
  c('petit-peuple', t('Le petit peuple', 'Little folk'), [
    'insectes/coccinelle',
    'insectes/papillon',
    'insectes/abeille',
    'insectes/libellule',
    'insectes/escargot',
    'insectes/chenille',
  ]),
  c('clair-de-lune', t('Clair de lune', 'Moonlight'), [
    'nuit/chat-toit',
    'nuit/village-lune',
    'nuit/feu-de-camp',
    'nuit/lanterne',
    'nuit/nuit-etoilee',
    'insectes/luciole',
  ]),
  c('ciel-du-nord', t('Ciel du Nord', 'Northern sky'), [
    'nuit/aurore-boreale',
    'nuit/aurore-lac',
    'nuit/voie-lactee',
    'espace/galaxie-spirale',
    'espace/galaxie-jade',
    'espace/nebuleuse-doree',
  ]),
  c('odyssee', t('Odyssée spatiale', 'Space odyssey'), [
    'espace/fusee',
    'espace/astronaute',
    'espace/planete-ambre',
    'espace/planete-bleue',
    'espace/planete-mauve',
    'espace/nebuleuse-sable',
  ]),
  c('voyage', t('Carnet de voyage', 'Travel journal'), [
    'architecture/maisons',
    'architecture/moulin',
    'architecture/chateau',
    'architecture/chalet',
    'architecture/pont',
    'architecture/horloge',
  ]),
  c('lumiere', t('Éclats de lumière', 'Glimmers of light'), [
    'architecture/rosace',
    'architecture/cabane-arbre',
    'fleurs/lavande',
    'fleurs/soleil-spirale',
    'fleurs/fleur-lagon',
    'japon/koi',
  ]),
  c('quatre-saisons', t('Les quatre saisons', 'The four seasons'), [
    'saisons/arbre-printemps',
    'saisons/arbre-ete',
    'saisons/arbre-automne',
    'saisons/arbre-hiver',
    'saisons/bonhomme-de-neige',
    'saisons/parapluie',
  ]),
  c('japon', t('Estampes et jardins', 'Prints and gardens'), [
    'japon/koi',
    'japon/torii',
    'japon/seigaiha-glycine',
    'japon/seigaiha-nuit',
  ]),
];

export const COLLECTION_REWARDS: readonly Reward[] = [reward.xp(1000), reward.chest('medium')];

/** Collection d'un événement : récompenses d'une édition (le cadre seulement la première fois). */
export function eventCollectionRewards(frame: Reward | null): Reward[] {
  return [reward.xp(1500), reward.chest('large'), ...(frame ? [frame] : [])];
}

export function collectionProgress(def: CollectionDef, completed: ReadonlySet<string>): number {
  return def.artworks.filter((a) => completed.has(a)).length;
}

/** Collections que l'œuvre `artwork` vient de compléter. */
export function completedBy(artwork: string, completed: ReadonlySet<string>): CollectionDef[] {
  return COLLECTIONS.filter(
    (def) => def.artworks.includes(artwork) && def.artworks.every((a) => completed.has(a)),
  );
}
