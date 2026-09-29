import type { CategoryId } from '../categories';
import type { Grid } from '../grid';
import { mandala } from './mandala';
import {
  aurora,
  dunes,
  fields,
  forest,
  galaxy,
  mountains,
  nebula,
  planet,
  seascape,
  seasonTree,
  starryNight,
} from './nature';
import { argyle, hexagons, julia, phyllotaxis, quilt, seigaiha, stars, truchet } from './patterns';
import { sunsetLake } from './sunsetLake';

export interface GeneratorDef {
  readonly id: string;
  readonly category: CategoryId;
  /** Hauteur / largeur. */
  readonly aspect: number;
  render(width: number, height: number, seed: number): Grid;
}

const def = (id: string, category: CategoryId, render: GeneratorDef['render'], aspect = 1): GeneratorDef => ({
  id,
  category,
  aspect,
  render,
});

/** Générateurs procéduraux (déterministes) : bibliothèque et œuvre du jour. */
export const GENERATORS: Readonly<Record<string, GeneratorDef>> = {
  mandala: def('mandala', 'mandalas', mandala),
  'sunset-lake': def('sunset-lake', 'paysages', sunsetLake),
  quilt: def('quilt', 'motifs', quilt),
  seigaiha: def('seigaiha', 'japon', seigaiha),
  truchet: def('truchet', 'motifs', truchet),
  stars: def('stars', 'motifs', stars),
  hexagons: def('hexagons', 'motifs', hexagons),
  argyle: def('argyle', 'motifs', argyle),
  phyllotaxis: def('phyllotaxis', 'fleurs', phyllotaxis),
  julia: def('julia', 'motifs', julia),
  mountains: def('mountains', 'paysages', mountains, 0.75),
  dunes: def('dunes', 'paysages', dunes, 0.75),
  fields: def('fields', 'paysages', fields, 0.75),
  forest: def('forest', 'paysages', forest, 0.75),
  seascape: def('seascape', 'mer', seascape, 0.75),
  planet: def('planet', 'espace', planet),
  nebula: def('nebula', 'espace', nebula),
  galaxy: def('galaxy', 'espace', galaxy),
  'starry-night': def('starry-night', 'nuit', starryNight, 0.75),
  aurora: def('aurora', 'nuit', aurora, 0.75),
  'season-tree': def('season-tree', 'saisons', seasonTree, 1.25),
};
