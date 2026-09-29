import { writeFileSync } from 'node:fs';
import { fetchObject, Throttle, type Museum } from './import-pd';

const L: [string, Museum, number, string, string][] = [
  ['chefs-doeuvre/van-gogh-iris', 'met', 436528, 'Les Iris', 'Irises'],
  ['chefs-doeuvre/van-gogh-tournesols', 'met', 436524, 'Les Tournesols', 'Sunflowers'],
  ['chefs-doeuvre/van-gogh-chambre-arles', 'aic', 28560, 'La Chambre à Arles', 'The Bedroom'],
  ['chefs-doeuvre/van-gogh-raisins-citrons', 'aic', 64957, 'Raisins, citrons, poires et pommes', 'Grapes, Lemons, Pears, and Apples'],
  ['chefs-doeuvre/caillebotte-rue-de-paris', 'aic', 20684, 'Rue de Paris, temps de pluie', 'Paris Street; Rainy Day'],
  ['chefs-doeuvre/seurat-grande-jatte', 'aic', 27992, 'Un dimanche après-midi à l’île de la Grande Jatte', 'A Sunday on La Grande Jatte'],
  ['chefs-doeuvre/cezanne-panier-de-pommes', 'aic', 111436, 'Le Panier de pommes', 'The Basket of Apples'],
  ['chefs-doeuvre/cezanne-pommes-primevères', 'met', 435882, 'Nature morte aux pommes et au pot de primevères', 'Still Life with Apples and a Pot of Primroses'],
  ['chefs-doeuvre/renoir-deux-soeurs', 'aic', 14655, 'Deux sœurs (Sur la terrasse)', 'Two Sisters (On the Terrace)'],
  ['chefs-doeuvre/renoir-fruits-du-midi', 'aic', 16629, 'Fruits du Midi', 'Fruits of the Midi'],
  ['chefs-doeuvre/monet-nympheas', 'aic', 16568, 'Les Nymphéas', 'Water Lilies'],
  ['chefs-doeuvre/cezanne-baie-de-marseille', 'aic', 16487, 'La Baie de Marseille vue de l’Estaque', 'The Bay of Marseille, Seen from L’Estaque'],
  ['japon/hokusai-grande-vague', 'aic', 24645, 'La Grande Vague', 'The Great Wave'],
  ['japon/hokusai-fuji-rouge', 'aic', 87005, 'Le Fuji rouge', 'Red Fuji'],
  ['japon/hokusai-orage-sous-le-sommet', 'aic', 87008, 'Orage sous le sommet', 'Shower Below the Summit'],
  ['japon/hokusai-kajikazawa', 'aic', 18969, 'Le Pêcheur de Kajikazawa', 'Kajikazawa in Kai Province'],
  ['japon/hiroshige-rizieres-asakusa', 'aic', 13192, 'Les Rizières d’Asakusa', 'Asakusa Rice Fields'],
  ['japon/hiroshige-kuwana', 'aic', 18329, 'Le Bac de Kuwana', 'Kuwana: Ferryboat at Shichiri Crossing'],
  ['japon/hokusai-chrysantheme-taon', 'aic', 25110, 'Chrysanthème et taon', 'Chrysanthemum and Horsefly'],
  ['japon/hiroshige-shirasuka', 'aic', 18307, 'La Côte de Shiomi à Shirasuka', 'Shirasuka: Shiomi Slope'],
  ['fleurs/renoir-chrysanthemes', 'aic', 16617, 'Chrysanthèmes', 'Chrysanthemums'],
  ['fleurs/van-gogh-lauriers-roses', 'met', 436530, 'Lauriers-roses', 'Oleanders'],
  ['fleurs/redoute-couronne-imperiale', 'met', 762064, 'La Couronne impériale', 'Crown Imperial'],
  ['fleurs/redoute-rose', 'met', 762055, 'La Rose de l’impératrice Joséphine', 'Empress Josephine Rose'],
  ['oiseaux/hiroshige-geai-hibiscus', 'met', 55235, 'Hibiscus et geai', 'Hibiscus and Jay'],
  ['oiseaux/hiroshige-loriot-ketmie', 'met', 56796, 'Loriot sur une tige de ketmie', 'Black-Naped Oriole on a Stem of Rose Mallow'],
  ['oiseaux/hiroshige-huitriers', 'aic', 19026, 'Les Huîtriers', 'Oystercatchers'],
  ['oiseaux/hiroshige-faisan-pins', 'met', 56592, 'Faisan et pins sur une colline enneigée', 'Pheasant and Pine-trees on Snowy Hillside'],
  ['paysages/van-gogh-cyprès', 'met', 437980, 'Les Cyprès', 'Cypresses'],
  ['paysages/inness-apres-lavers', 'aic', 64715, 'Après l’averse d’été', 'After a Summer Shower'],
  ['paysages/sisley-seine-port-marly', 'aic', 16633, 'La Seine à Port-Marly, tas de sable', 'The Seine at Port-Marly, Piles of Sand'],
  ['paysages/signac-andelys', 'aic', 122130, 'Les Andelys, côte d’Aval', 'Les Andelys, Côte d’Aval'],
  ['mer/monet-falaise-pourville', 'aic', 14620, 'La Promenade de la falaise à Pourville', 'Cliff Walk at Pourville'],
  ['mer/homer-voile-rentree', 'aic', 16831, 'Voile ferlée', 'Stowing Sail'],
  ['mer/hokusai-bateaux-choshi', 'aic', 100627, 'Bateaux de pêche à Choshi', 'Fishing Boats at Choshi'],
  ['insectes/henstenburgh-sauterelles', 'aic', 74103, 'Deux sauterelles', 'Two Grasshoppers'],
  ['insectes/shunman-papillons', 'met', 54043, 'Papillons', 'Butterflies'],
  ['architecture/cezanne-maison-fissuree', 'met', 435874, 'La Maison aux murs fissurés', 'The House with the Cracked Walls'],
  ['architecture/monet-maison-argenteuil', 'aic', 16554, 'La Maison de l’artiste à Argenteuil', 'The Artist’s House at Argenteuil'],
  ['architecture/sisley-marly-le-roi', 'met', 437682, 'Vue de Marly-le-Roi depuis Coeur-Volant', 'View of Marly-le-Roi from Coeur-Volant'],
];

const f = { throttle: new Throttle(700), retryPauseMs: 6000 };
const out: unknown[] = [];
for (const [id, museum, objectId, fr, en] of L) {
  const o = await fetchObject(f, museum, objectId);
  const artist = (o.artist.split('\n')[0] ?? '').replace(/\s*\(.*$/, '').replace(/[^\u0000-ɏ]+/g, '').replace(/\s+/g, ' ').trim();
  console.log(id, '|', o.publicDomain, '|', artist, '|', o.title.slice(0, 60), '|', o.date, '|', o.imageUrl ? 'img' : 'NOIMG');
  out.push({
    id, category: id.split('/')[0], title: { fr, en }, museum, objectId,
    credit: { artist, title: o.title, date: o.date, museum: museum === 'aic' ? 'Art Institute of Chicago' : 'The Metropolitan Museum of Art', url: o.pageUrl, license: 'CC0' },
  });
}
writeFileSync('assets/art/public-domain.json', JSON.stringify(out, null, 2) + '\n');
