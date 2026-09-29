/**
 * Construit la bibliothèque : grilles de chaque œuvre dans les 4 difficultés (public/art/grids/…)
 * et l'index public/art/library.json. Sources : illustrations SVG, générateurs, domaine public.
 * npx tsx --tsconfig tsconfig.app.json scripts/art/build-library.ts [préfixe d'identifiant]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { isCategoryId, type CategoryId } from '../../src/content/categories';
import { eventById } from '../../src/content/events';
import { GENERATORS } from '../../src/content/generators';
import { TRANSPARENT, type Grid } from '../../src/content/grid';
import {
  DIFFICULTIES,
  DIFFICULTY_SPEC,
  type ArtworkCredit,
  type Difficulty,
  type LibraryEntry,
  type LibraryIndex,
  type VariantInfo,
} from '../../src/content/library/types';
import { gridSizeFor } from '../../src/convert/resample';
import { encodeGrid } from '../../src/db/codecs';
import type { I18nText } from '../../src/i18n/text';
import { paintingToGrid, svgToGrid } from './convert-art';
import { SvgRasterizer, svgColors, type Raster } from './svg';

const ROOT = 'assets/art';
const OUT = 'public/art';
const only = process.argv[2] ?? '';

type Titles = Record<string, I18nText>;
interface Job {
  id: string;
  title: I18nText;
  category: CategoryId;
  kind: LibraryEntry['kind'];
  event?: string;
  credit?: ArtworkCredit;
  make(d: Difficulty): Promise<Grid> | Grid;
}

const jobs: Job[] = [];
const raster = await SvgRasterizer.open();

function svgJobs(dir: string, category: CategoryId, idPrefix: string, event?: string): void {
  const titles = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as Titles;
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.svg'))
    .sort()) {
    const slug = file.slice(0, -4);
    const title = titles[slug];
    if (!title) throw new Error(`Titre manquant : ${dir}/${slug}`);
    const svg = readFileSync(join(dir, file), 'utf8');
    let cached: Raster | null = null;
    jobs.push({
      id: `${idPrefix}/${slug}`,
      title,
      category,
      kind: 'svg',
      ...(event !== undefined && { event }),
      make: async (d) => {
        cached ??= await raster.render(svg, 1344);
        return svgToGrid(cached, d, svgColors(svg));
      },
    });
  }
}

// illustrations
for (const cat of readdirSync(join(ROOT, 'svg')).sort()) {
  if (cat === 'events') continue;
  if (!isCategoryId(cat)) throw new Error(`Catégorie inconnue : ${cat}`);
  svgJobs(join(ROOT, 'svg', cat), cat, cat);
}
const eventsDir = join(ROOT, 'svg', 'events');
if (existsSync(eventsDir)) {
  for (const ev of readdirSync(eventsDir).sort()) {
    if (!eventById(ev)) throw new Error(`Événement inconnu : ${ev}`);
    if (!existsSync(join(eventsDir, ev, 'meta.json'))) {
      console.warn(`⚠ événement sans meta.json, ignoré : ${ev}`);
      continue;
    }
    svgJobs(join(eventsDir, ev), 'saisons', `evenements/${ev}`, ev);
  }
}

// générateurs
const generated = JSON.parse(readFileSync(join(ROOT, 'generated.json'), 'utf8')) as {
  id: string;
  generator: string;
  seed: number;
  title: I18nText;
}[];
for (const g of generated) {
  const gen = GENERATORS[g.generator];
  if (!gen) throw new Error(`Générateur inconnu : ${g.generator}`);
  const category = g.id.split('/')[0] ?? '';
  if (!isCategoryId(category)) throw new Error(`Catégorie inconnue : ${g.id}`);
  jobs.push({
    id: g.id,
    title: g.title,
    category,
    kind: 'generator',
    make: (d) => {
      const long = DIFFICULTY_SPEC[d].long;
      const { width, height } = gridSizeFor(1 / gen.aspect, long);
      return gen.render(width, height, g.seed);
    },
  });
}

// domaine public
const pdFile = join(ROOT, 'public-domain.json');
if (existsSync(pdFile)) {
  const pd = JSON.parse(readFileSync(pdFile, 'utf8')) as {
    id: string;
    category: string;
    title: I18nText;
    credit: ArtworkCredit;
  }[];
  for (const p of pd) {
    if (!isCategoryId(p.category)) throw new Error(`Catégorie inconnue : ${p.id}`);
    const src = join(ROOT, 'sources', 'cache', `${p.id.replaceAll('/', '__')}.jpg`);
    if (!existsSync(src)) {
      console.warn(`⚠ source absente (lancer scripts/art/import-pd.ts) : ${p.id}`);
      continue;
    }
    let cached: Raster | null = null;
    jobs.push({
      id: p.id,
      title: p.title,
      category: p.category,
      kind: 'publicdomain',
      credit: p.credit,
      make: (d) => {
        if (!cached) {
          const img = jpeg.decode(readFileSync(src), { useTArray: true, maxMemoryUsageInMB: 1024 });
          cached = { pixels: img.data, width: img.width, height: img.height };
        }
        return paintingToGrid(cached, d);
      },
    });
  }
}

const ids = new Set<string>();
for (const j of jobs) {
  if (ids.has(j.id)) throw new Error(`Identifiant en double : ${j.id}`);
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)+$/.test(j.id)) throw new Error(`Identifiant invalide : ${j.id}`);
  ids.add(j.id);
}

// l'index est toujours réécrit en entier ; les grilles ne sont recalculées que pour le préfixe demandé
const previous = existsSync(join(OUT, 'library.json'))
  ? new Map(
      (JSON.parse(readFileSync(join(OUT, 'library.json'), 'utf8')) as LibraryIndex).artworks.map((a) => [
        a.id,
        a,
      ]),
    )
  : new Map<string, LibraryEntry>();
const entries: LibraryEntry[] = [];
let bytes = 0;
for (const j of jobs) {
  const old = previous.get(j.id);
  if (only && !j.id.startsWith(only) && old) {
    entries.push({ ...old, title: j.title, category: j.category });
    continue;
  }
  const dir = join(OUT, 'grids', j.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const variants = {} as Record<Difficulty, VariantInfo>;
  for (const d of DIFFICULTIES) {
    const g = await j.make(d);
    const data = encodeGrid(g);
    bytes += data.length;
    writeFileSync(join(dir, `${d}.tgrid`), data);
    let cells = 0;
    for (const c of g.cells) if (c !== TRANSPARENT) cells++;
    variants[d] = { width: g.width, height: g.height, colors: g.palette.length, cells };
  }
  entries.push({
    id: j.id,
    title: j.title,
    category: j.category,
    kind: j.kind,
    variants,
    ...(j.credit && { credit: j.credit }),
    ...(j.event !== undefined && { event: j.event }),
  });
  console.log(
    `${j.id} · ${DIFFICULTIES.map((d) => `${variants[d].width}×${variants[d].height}/${variants[d].colors}c`).join(' ')}`,
  );
}
await raster.close();
const index: LibraryIndex = { version: 1, artworks: entries };
writeFileSync(join(OUT, 'library.json'), `${JSON.stringify(index)}\n`);
const byKind = (k: string) => entries.filter((e) => e.kind === k).length;
console.log(
  `\n${entries.length} œuvres (svg ${byKind('svg')}, générées ${byKind('generator')}, domaine public ${byKind('publicdomain')}) · ${(bytes / 1024).toFixed(0)} Kio écrits`,
);
