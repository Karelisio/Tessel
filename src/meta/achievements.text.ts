import { t, type I18nText } from '@/i18n/text';

export interface AchievementText {
  readonly title: I18nText;
  /** `{n}` est remplacé par l'objectif, formaté selon la langue. */
  readonly description: I18nText;
  /** Succès secrets : indice poétique montré avant l'obtention. */
  readonly hint?: I18nText;
}

const a = (title: I18nText, description: I18nText, hint?: I18nText): AchievementText =>
  hint ? { title, description, hint } : { title, description };

const CELLS = t('Pose {n} cases', 'Place {n} cells');
const PIXELS = t('Pose {n} pixels', 'Place {n} pixels');
const DIAMONDS = t('Pose {n} diamants', 'Place {n} diamonds');
const STITCHES = t('Brode {n} croix', 'Stitch {n} crosses');
const TILES = t('Pose {n} tesselles', 'Set {n} tiles');
const ARTWORK = t('Termine {n} œuvre', 'Complete {n} artwork');
const ARTWORKS = t('Termine {n} œuvres', 'Complete {n} artworks');
const inMode = (fr: string, en: string, plural: boolean) =>
  plural
    ? t(`Termine {n} œuvres ${fr}`, `Complete {n} ${en} artworks`)
    : t(`Termine {n} œuvre ${fr}`, `Complete {n} ${en} artwork`);
const PIXEL_ONE = inMode('en pixel art', 'pixel art', false);
const PIXEL_MANY = inMode('en pixel art', 'pixel art', true);
const DIAMOND_ONE = inMode('en diamond painting', 'diamond painting', false);
const DIAMOND_MANY = inMode('en diamond painting', 'diamond painting', true);
const STITCH_ONE = inMode('en point de croix', 'cross-stitch', false);
const STITCH_MANY = inMode('en point de croix', 'cross-stitch', true);
const MOSAIC_ONE = inMode('en mosaïque', 'mosaic', false);
const MOSAIC_MANY = inMode('en mosaïque', 'mosaic', true);
const LARGE_ONE = t(
  'Termine {n} grande œuvre (100×100 ou plus)',
  'Complete {n} large artwork (100×100 or more)',
);
const LARGE_MANY = t(
  'Termine {n} grandes œuvres (100×100 ou plus)',
  'Complete {n} large artworks (100×100 or more)',
);
const HUGE_ONE = t(
  'Termine {n} œuvre géante (200×200 ou plus)',
  'Complete {n} huge artwork (200×200 or more)',
);
const HUGE_MANY = t(
  'Termine {n} œuvres géantes (200×200 ou plus)',
  'Complete {n} huge artworks (200×200 or more)',
);
const COLORS = t('Termine {n} couleurs', 'Complete {n} colors');
const PHOTO_ONE = t(
  'Termine {n} œuvre créée à partir de tes photos',
  'Complete {n} artwork made from your photos',
);
const PHOTO_MANY = t(
  'Termine {n} œuvres créées à partir de tes photos',
  'Complete {n} artworks made from your photos',
);
const DAILY_ONE = t('Termine {n} œuvre du jour', 'Complete {n} daily artwork');
const DAILY_MANY = t('Termine {n} œuvres du jour', 'Complete {n} daily artworks');
const STREAK = t('Atteins une série de {n} jours', 'Reach a {n}-day streak');
const LEVEL = t('Atteins le niveau {n}', 'Reach level {n}');
const QUESTS_DAILY = t('Termine {n} quêtes du jour', 'Complete {n} daily quests');
const QUESTS_WEEKLY = t('Termine {n} quêtes de la semaine', 'Complete {n} weekly quests');
const COLLECTION_ONE = t('Termine {n} collection', 'Complete {n} collection');
const COLLECTIONS = t('Termine {n} collections', 'Complete {n} collections');
const EVENT_ONE = t('Termine {n} œuvre d’un événement de saison', 'Complete {n} seasonal event artwork');
const EVENT_MANY = t('Termine {n} œuvres d’événements de saison', 'Complete {n} seasonal event artworks');
const CATEGORIES = t(
  'Termine une œuvre dans {n} catégories différentes',
  'Complete an artwork in {n} different categories',
);
const DAYS = t('Colorie pendant {n} jours différents', 'Color on {n} different days');

/** Textes des 150 succès (clés = identifiants de achievements.data.ts). */
export const ACHIEVEMENT_TEXT: Readonly<Record<string, AchievementText>> = {
  'cells-1': a(t('Premier coup de pinceau', 'First brushstroke'), CELLS),
  'cells-2': a(t('Mille petites touches', 'A thousand little touches'), CELLS),
  'cells-3': a(t('Main légère', 'Light touch'), CELLS),
  'cells-4': a(t('Rythme tranquille', 'Steady rhythm'), CELLS),
  'cells-5': a(t('Cent mille éclats', 'A hundred thousand sparks'), CELLS),
  'cells-6': a(t('Pluie de couleurs', 'Rain of colors'), CELLS),
  'cells-7': a(t('Océan de nuances', 'Ocean of shades'), CELLS),
  'cells-8': a(t('Le million', 'The million'), CELLS),
  'cells-9': a(t('Légende du pinceau', 'Brush legend'), CELLS),

  'cells-pixel-1': a(t('Pixel après pixel', 'Pixel by pixel'), PIXELS),
  'cells-pixel-2': a(t('Cœur de pixel', 'Pixel heart'), PIXELS),
  'cells-pixel-3': a(t('Âme 8 bits', '8-bit soul'), PIXELS),
  'cells-pixel-4': a(t('Maîtrise du pixel', 'Pixel mastery'), PIXELS),
  'cells-diamond-1': a(t('Premiers éclats', 'First sparkles'), DIAMONDS),
  'cells-diamond-2': a(t('Pluie de strass', 'Rhinestone rain'), DIAMONDS),
  'cells-diamond-3': a(t('Rivière de diamants', 'River of diamonds'), DIAMONDS),
  'cells-diamond-4': a(t('Trésor scintillant', 'Glittering treasure'), DIAMONDS),
  'cells-crossstitch-1': a(t('Fil à fil', 'Thread by thread'), STITCHES),
  'cells-crossstitch-2': a(t('Main de fée', 'Fairy fingers'), STITCHES),
  'cells-crossstitch-3': a(t('Tapisserie vivante', 'Living tapestry'), STITCHES),
  'cells-crossstitch-4': a(t('Âme brodée', 'Embroidered soul'), STITCHES),
  'cells-mosaic-1': a(t('Pierre après pierre', 'Stone by stone'), TILES),
  'cells-mosaic-2': a(t('Joints parfaits', 'Perfect grout'), TILES),
  'cells-mosaic-3': a(t('Fresque de tesselles', 'Tessellated fresco'), TILES),
  'cells-mosaic-4': a(t('Cathédrale de verre', 'Glass cathedral'), TILES),

  'artworks-1': a(t('Première œuvre', 'First artwork'), ARTWORK),
  'artworks-2': a(t('Petite collection', 'Small collection'), ARTWORKS),
  'artworks-3': a(t('Dix merveilles', 'Ten wonders'), ARTWORKS),
  'artworks-4': a(t('Carnet bien rempli', 'Full sketchbook'), ARTWORKS),
  'artworks-5': a(t('Atelier vivant', 'Living studio'), ARTWORKS),
  'artworks-6': a(t('Centenaire', 'Centennial'), ARTWORKS),
  'artworks-7': a(t('Musée personnel', 'Personal museum'), ARTWORKS),
  'artworks-8': a(t('Œuvre d’une vie', 'Life’s work'), ARTWORKS),
  'artworks-9': a(t('Mille et une œuvres', 'A thousand and one works'), ARTWORKS),

  'artworks-pixel-1': a(t('Premier pixel art', 'First pixel art'), PIXEL_ONE),
  'artworks-pixel-2': a(t('Galerie rétro', 'Retro gallery'), PIXEL_MANY),
  'artworks-pixel-3': a(t('Pixels en fête', 'Pixel party'), PIXEL_MANY),
  'artworks-pixel-4': a(t('Virtuose du pixel', 'Pixel virtuoso'), PIXEL_MANY),
  'artworks-diamond-1': a(t('Première parure', 'First jewel'), DIAMOND_ONE),
  'artworks-diamond-2': a(t('Écrin de lumière', 'Jewel box'), DIAMOND_MANY),
  'artworks-diamond-3': a(t('Constellation de strass', 'Rhinestone constellation'), DIAMOND_MANY),
  'artworks-diamond-4': a(t('Virtuose du diamant', 'Diamond virtuoso'), DIAMOND_MANY),
  'artworks-crossstitch-1': a(t('Premier ouvrage', 'First sampler'), STITCH_ONE),
  'artworks-crossstitch-2': a(t('Trousseau brodé', 'Embroidered keepsakes'), STITCH_MANY),
  'artworks-crossstitch-3': a(t('Tambour infatigable', 'Tireless hoop'), STITCH_MANY),
  'artworks-crossstitch-4': a(t('Virtuose du fil', 'Thread virtuoso'), STITCH_MANY),
  'artworks-mosaic-1': a(t('Première mosaïque', 'First mosaic'), MOSAIC_ONE),
  'artworks-mosaic-2': a(t('Pavement d’artiste', 'Artist’s pavement'), MOSAIC_MANY),
  'artworks-mosaic-3': a(t('Villa romaine', 'Roman villa'), MOSAIC_MANY),
  'artworks-mosaic-4': a(t('Virtuose des tesselles', 'Tile virtuoso'), MOSAIC_MANY),

  'large-1': a(t('Grand format', 'Large format'), LARGE_ONE),
  'large-2': a(t('Voir grand', 'Thinking big'), LARGE_MANY),
  'large-3': a(t('Horizons immenses', 'Vast horizons'), LARGE_MANY),
  'huge-1': a(t('Monumental', 'Monumental'), HUGE_ONE),
  'huge-2': a(t('Fresque monumentale', 'Monumental fresco'), HUGE_MANY),
  'huge-3': a(t('Patience de cathédrale', 'Cathedral patience'), HUGE_MANY),

  'colors-1': a(t('Nuancier', 'Swatch book'), COLORS),
  'colors-2': a(t('Arc-en-ciel apprivoisé', 'Tamed rainbow'), COLORS),
  'colors-3': a(t('Mille teintes', 'A thousand hues'), COLORS),
  'colors-4': a(t('Alchimie des couleurs', 'Color alchemy'), COLORS),

  'photo-1': a(t('Souvenir en couleurs', 'Memory in color'), PHOTO_ONE),
  'photo-2': a(t('Album vivant', 'Living album'), PHOTO_MANY),
  'photo-3': a(t('Chronique en couleurs', 'Chronicle in color'), PHOTO_MANY),

  'daily-1': a(t('Premier cadeau', 'First gift'), DAILY_ONE),
  'daily-2': a(t('Semaine de surprises', 'Week of surprises'), DAILY_MANY),
  'daily-3': a(t('Rendez-vous quotidien', 'Daily date'), DAILY_MANY),
  'daily-4': a(t('Cent matins', 'A hundred mornings'), DAILY_MANY),
  'daily-5': a(t('Une année de cadeaux', 'A year of gifts'), DAILY_MANY),

  'streak-1': a(t('Petite flamme', 'Little flame'), STREAK),
  'streak-2': a(t('Semaine complète', 'Full week'), STREAK),
  'streak-3': a(t('Deux semaines', 'Two weeks'), STREAK),
  'streak-4': a(t('Un mois de douceur', 'A month of calm'), STREAK),
  'streak-5': a(t('Flamme fidèle', 'Faithful flame'), STREAK),
  'streak-6': a(t('Cent jours', 'A hundred days'), STREAK),
  'streak-7': a(t('Braises éternelles', 'Everlasting embers'), STREAK),
  'streak-8': a(t('Tour du soleil', 'Around the sun'), STREAK),

  'level-1': a(t('Premiers pas', 'First steps'), LEVEL),
  'level-2': a(t('En chemin', 'On the way'), LEVEL),
  'level-3': a(t('Belle lancée', 'Good momentum'), LEVEL),
  'level-4': a(t('Regard d’artiste', 'Artist’s eye'), LEVEL),
  'level-5': a(t('À mi-chemin des étoiles', 'Halfway to the stars'), LEVEL),
  'level-6': a(t('Sommet paisible', 'Peaceful summit'), LEVEL),
  'level-7': a(t('Niveau cent', 'Level one hundred'), LEVEL),

  'quests-daily-1': a(t('Petites missions', 'Little missions'), QUESTS_DAILY),
  'quests-daily-2': a(t('Habitudes douces', 'Gentle habits'), QUESTS_DAILY),
  'quests-daily-3': a(t('Rituel du jour', 'Daily ritual'), QUESTS_DAILY),
  'quests-daily-4': a(t('Sérénité quotidienne', 'Everyday serenity'), QUESTS_DAILY),
  'quests-weekly-1': a(t('Belles semaines', 'Lovely weeks'), QUESTS_WEEKLY),
  'quests-weekly-2': a(t('Saisons remplies', 'Full seasons'), QUESTS_WEEKLY),
  'quests-weekly-3': a(t('Une année de semaines', 'A year of weeks'), QUESTS_WEEKLY),

  'playtime-1': a(
    t('Une heure pour soi', 'An hour to yourself'),
    t('Colorie 1 heure au total', 'Color for 1 hour in total'),
  ),
  'playtime-2': a(
    t('Dix heures de calme', 'Ten calm hours'),
    t('Colorie 10 heures au total', 'Color for 10 hours in total'),
  ),
  'playtime-3': a(
    t('Cinquante heures de douceur', 'Fifty gentle hours'),
    t('Colorie 50 heures au total', 'Color for 50 hours in total'),
  ),
  'playtime-4': a(
    t('Cent heures de sérénité', 'A hundred serene hours'),
    t('Colorie 100 heures au total', 'Color for 100 hours in total'),
  ),

  'collections-1': a(t('Première collection', 'First collection'), COLLECTION_ONE),
  'collections-2': a(t('Cabinet de curiosités', 'Cabinet of curiosities'), COLLECTIONS),
  'collections-3': a(t('Bibliothèque de couleurs', 'Library of colors'), COLLECTIONS),
  'collections-4': a(t('Grande encyclopédie', 'Great encyclopedia'), COLLECTIONS),

  'events-1': a(t('Air de fête', 'Festive air'), EVENT_ONE),
  'events-2': a(t('Au fil des saisons', 'Through the seasons'), EVENT_MANY),
  'events-3': a(t('Calendrier enchanté', 'Enchanted calendar'), EVENT_MANY),

  'categories-1': a(t('Curiosité', 'Curiosity'), CATEGORIES),
  'categories-2': a(t('Grand voyage', 'Grand tour'), CATEGORIES),
  'categories-3': a(t('Tour du monde', 'Around the world'), CATEGORIES),
  'categories-4': a(t('Tous les horizons', 'Every horizon'), CATEGORIES),

  'days-1': a(t('Une semaine de couleurs', 'A week of colors'), DAYS),
  'days-2': a(t('Habitude colorée', 'Colorful habit'), DAYS),
  'days-3': a(t('Cent journées colorées', 'A hundred colorful days'), DAYS),
  'days-4': a(t('Année en couleurs', 'Year in color'), DAYS),

  'gallery-1': a(
    t('Vernissage', 'Opening night'),
    t('Accroche {n} œuvres dans ta galerie', 'Hang {n} artworks in your gallery'),
  ),

  'discover-photo': a(
    t('Photo magique', 'Photo magic'),
    t('Transforme une photo en œuvre', 'Turn a photo into an artwork'),
  ),
  'discover-creation': a(
    t('Page blanche', 'Blank page'),
    t('Crée une œuvre dans l’atelier', 'Create an artwork in the studio'),
  ),
  'discover-share': a(t('Cadeau partagé', 'Shared gift'), t('Partage une œuvre', 'Share an artwork')),
  'discover-timelapse': a(
    t('Retour en arrière', 'Rewind'),
    t('Regarde le timelapse d’une œuvre', 'Watch the timelapse of an artwork'),
  ),
  'discover-gallery': a(
    t('Premier accrochage', 'First hanging'),
    t('Accroche une œuvre dans ta galerie', 'Hang an artwork in your gallery'),
  ),
  'discover-bucket': a(
    t('Coup de pot', 'Bucket list'),
    t('Utilise le pot de peinture', 'Use the paint bucket'),
  ),
  'discover-wand': a(t('Abracadabra', 'Abracadabra'), t('Utilise la baguette magique', 'Use the magic wand')),
  'discover-loupe': a(
    t('Œil de lynx', 'Eagle eye'),
    t('Utilise la loupe pour trouver une case', 'Use the magnifier to find a cell'),
  ),
  'discover-chest': a(t('Trésor caché', 'Hidden treasure'), t('Ouvre un coffre', 'Open a chest')),
  'discover-quest': a(
    t('Mission accomplie', 'Mission accomplished'),
    t('Termine une quête du jour', 'Complete a daily quest'),
  ),
  'discover-weekly': a(
    t('Belle semaine', 'Good week'),
    t('Termine une quête de la semaine', 'Complete a weekly quest'),
  ),
  'discover-freeze': a(
    t('Joker bienvenu', 'Welcome freeze'),
    t('Un joker a protégé ta série', 'A freeze protected your streak'),
  ),
  'discover-wallpaper': a(
    t('Fond de rêve', 'Dream wallpaper'),
    t('Mets une œuvre en fond d’écran', 'Set an artwork as your wallpaper'),
  ),
  'discover-export': a(
    t('Haute définition', 'High definition'),
    t('Exporte une œuvre en image HD', 'Export an artwork as an HD image'),
  ),
  'discover-video': a(
    t('Premier film', 'First film'),
    t('Exporte un timelapse en vidéo', 'Export a timelapse video'),
  ),
  'discover-shared': a(
    t('Colis surprise', 'Surprise parcel'),
    t('Importe une œuvre qu’on t’a partagée', 'Import an artwork someone shared with you'),
  ),
  'discover-qr': a(
    t('Message codé', 'Coded message'),
    t('Crée le code QR d’une œuvre', 'Create an artwork’s QR code'),
  ),
  'discover-wall': a(
    t('Nouvelle salle', 'New room'),
    t('Crée un deuxième mur dans ta galerie', 'Create a second wall in your gallery'),
  ),
  'discover-frame': a(
    t('Changement de cadre', 'Change of frame'),
    t('Change le cadre d’une œuvre', 'Change an artwork’s frame'),
  ),
  'discover-ambience': a(
    t('Ambiance feutrée', 'Cozy atmosphere'),
    t('Écoute une ambiance sonore', 'Play an ambient sound'),
  ),
  'discover-daily-gift': a(
    t('Paquet du jour', 'Today’s parcel'),
    t('Ouvre le cadeau de l’œuvre du jour', 'Open the daily artwork gift'),
  ),
  'discover-modes': a(
    t('Quatre talents', 'Four talents'),
    t('Débloque les quatre modes', 'Unlock all four modes'),
  ),
  'discover-own-artwork': a(
    t('Fait main', 'Handmade'),
    t('Termine une œuvre que tu as créée', 'Complete an artwork you created'),
  ),
  'discover-all-modes': a(
    t('Touche-à-tout', 'Jack of all trades'),
    t('Termine une œuvre dans chacun des quatre modes', 'Complete an artwork in each of the four modes'),
  ),
  'discover-event-collection': a(
    t('Collection de saison', 'Seasonal collection'),
    t('Termine la collection d’un événement de saison', 'Complete a seasonal event collection'),
  ),

  'secret-nightOwl': a(
    t('Oiseau de nuit', 'Night owl'),
    t('Colorie entre minuit et 4 h du matin', 'Color between midnight and 4 a.m.'),
    t('Quand la maison dort…', 'When the house is asleep…'),
  ),
  'secret-earlyBird': a(
    t('Lève-tôt', 'Early bird'),
    t('Colorie entre 5 h et 7 h du matin', 'Color between 5 and 7 a.m.'),
    t('Avant le chant du coq…', 'Before the rooster crows…'),
  ),
  'secret-noUndo': a(
    t('Sans retour', 'No looking back'),
    t(
      'Termine une œuvre d’au moins 2 500 cases sans jamais annuler',
      'Complete an artwork of at least 2,500 cells without ever undoing',
    ),
    t('Avancer sans jamais revenir…', 'Only ever forward…'),
  ),
  'secret-flawless': a(
    t('Sans fausse note', 'Pitch perfect'),
    t(
      'Termine une œuvre d’au moins 2 500 cases sans une seule erreur de couleur',
      'Complete an artwork of at least 2,500 cells without a single wrong color',
    ),
    t('Pas une seule fausse couleur…', 'Not a single wrong color…'),
  ),
  'secret-marathon': a(
    t('Long voyage', 'Long journey'),
    t('Colorie 2 heures dans la même journée', 'Color for 2 hours in a single day'),
    t('Quand on ne voit pas le temps passer…', 'When time flies by…'),
  ),
  'secret-minimalist': a(
    t('Épure', 'Pared back'),
    t('Termine une œuvre de 4 couleurs ou moins', 'Complete an artwork with 4 colors or fewer'),
    t('Moins, c’est plus…', 'Less is more…'),
  ),
  'secret-rainbow': a(
    t('Tous les arcs-en-ciel', 'Every rainbow'),
    t('Termine une œuvre d’au moins 48 couleurs', 'Complete an artwork with at least 48 colors'),
    t('Plus de couleurs qu’un ciel d’orage…', 'More colors than a stormy sky…'),
  ),
  'secret-allModes': a(
    t('Quatre vies', 'Four lives'),
    t('Termine la même œuvre dans les quatre modes', 'Complete the same artwork in all four modes'),
    t('Une même image, quatre matières…', 'One picture, four materials…'),
  ),
  'secret-newYear': a(
    t('Premier jour de l’an', 'New Year’s colors'),
    t('Colorie un 1er janvier', 'Color on January 1st'),
    t('Le premier jour d’une page blanche…', 'The first day of a blank page…'),
  ),
  'secret-patience': a(
    t('Patience récompensée', 'Patience rewarded'),
    t(
      'Termine une œuvre commencée il y a plus de 30 jours',
      'Complete an artwork started more than 30 days earlier',
    ),
    t('Certaines œuvres prennent leur temps…', 'Some works take their time…'),
  ),
  'secret-fullMoon': a(
    t('Clair de lune', 'Moonlight'),
    t('Colorie un jour de pleine lune', 'Color on a full moon day'),
    t('Quand la lune est toute ronde…', 'When the moon is perfectly round…'),
  ),
  'secret-friday13': a(
    t('Porte-bonheur', 'Lucky charm'),
    t('Colorie un vendredi 13', 'Color on a Friday the 13th'),
    t('Un jour que certains redoutent…', 'A day some people dread…'),
  ),
  'secret-leapDay': a(
    t('Jour bonus', 'Bonus day'),
    t('Colorie un 29 février', 'Color on February 29th'),
    t('Un jour qui ne vient que tous les quatre ans…', 'A day that only comes every four years…'),
  ),
  'secret-anniversary': a(
    t('Joyeux anniversaire', 'Happy anniversary'),
    t('Colorie un an après ta première visite', 'Color one year after your first visit'),
    t('Une bougie pour Tessel…', 'One candle for Tessel…'),
  ),
  'secret-purist': a(
    t('À main levée', 'Freehand'),
    t(
      'Termine une œuvre d’au moins 40 000 cases sans aucun outil',
      'Complete an artwork of at least 40,000 cells without any tool',
    ),
    t('Rien que toi et tes couleurs…', 'Just you and your colors…'),
  ),
};
