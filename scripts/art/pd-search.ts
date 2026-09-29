import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  aicFieldsQuery,
  aicImageUrl,
  aicToObject,
  cachePath,
  decodeJpeg,
  fetchBuffer,
  fetchJson,
  isRecord,
  loadList,
  metToObject,
  str,
  Throttle,
  USER_AGENT,
  type Fetcher,
  type Museum,
  type MuseumObject,
} from './import-pd';
import { paintingToGrid } from './convert-art';
import { Sheet } from './sheet';
import type { Raster } from './svg';

/**
 * Aide au choix des œuvres du domaine public : cherche des candidats par mot-clé chez un musée et écrit une
 * planche contact (original + grille moyenne, numérotés) pour les comparer d'un coup d'œil.
 *
 *   tsx scripts/art/pd-search.ts search <aic|met> <mots-clés> [--limit 20] [--page 1] [--out planche.png]
 *                                [--list] [--artist] [--dept <id Met>] [--cols 3]
 *   tsx scripts/art/pd-search.ts ids <aic:16568|met:436535> ... [--out planche.png]
 *   tsx scripts/art/pd-search.ts final [--out planche.png]     (œuvres de public-domain.json, depuis le cache)
 *
 * `--list` n'affiche que les métadonnées (aucune image téléchargée). Les vignettes sont mises en cache dans le
 * dossier temporaire du système. Tsx : `npx tsx --tsconfig tsconfig.app.json scripts/art/pd-search.ts …`.
 */

const AIC_SEARCH = 'https://api.artic.edu/api/v1/artworks/search';
const MET_SEARCH = 'https://collectionapi.metmuseum.org/public/collection/v1/search';
const THUMB_DIR = join(tmpdir(), 'tessel-pd-candidates');

interface Candidate {
  key: string;
  label: string;
  thumbUrl: string | null;
}

interface Options {
  positional: string[];
  flags: Map<string, string>;
}

function parseArgs(argv: readonly string[]): Options {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (!a.startsWith('--')) positional.push(a);
    else if (a === '--list' || a === '--artist') flags.set(a.slice(2), '1');
    else flags.set(a.slice(2), argv[++i] ?? '');
  }
  return { positional, flags };
}

const describe = (o: MuseumObject): string => `${o.title} — ${o.artist.split('\n')[0] ?? ''} (${o.date})`;

async function searchAic(f: Fetcher, q: string, limit: number, page: number): Promise<Candidate[]> {
  const url =
    `${AIC_SEARCH}?q=${encodeURIComponent(q)}&query[term][is_public_domain]=true&${aicFieldsQuery}` +
    `&limit=${limit}&page=${page}`;
  const json = await fetchJson(f, url);
  const data = isRecord(json) && Array.isArray(json['data']) ? (json['data'] as unknown[]) : [];
  const out: Candidate[] = [];
  for (const d of data) {
    if (!isRecord(d)) continue;
    const o = aicToObject(d);
    if (!o.publicDomain || !o.imageUrl) continue;
    const imageId = str(d, 'image_id');
    out.push({ key: `aic:${o.id}`, label: describe(o), thumbUrl: aicImageUrl(imageId, 843) });
  }
  return out;
}

async function metCandidate(f: Fetcher, id: number): Promise<Candidate | null> {
  const json = await fetchJson(f, `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
  if (!isRecord(json)) return null;
  const o = metToObject(json);
  if (!o.publicDomain) return null;
  const small = str(json, 'primaryImageSmall') || o.imageUrl;
  return { key: `met:${id}`, label: describe(o), thumbUrl: small };
}

async function searchMet(
  f: Fetcher,
  q: string,
  limit: number,
  page: number,
  opts: Options,
): Promise<Candidate[]> {
  // L'API du Met ignore les filtres placés après `q` : il doit rester le dernier paramètre.
  let url = `${MET_SEARCH}?hasImages=true&isPublicDomain=true`;
  if (opts.flags.has('artist')) url += '&artistOrCulture=true';
  const dept = opts.flags.get('dept');
  if (dept) url += `&departmentId=${encodeURIComponent(dept)}`;
  url += `&q=${encodeURIComponent(q)}`;
  const json = await fetchJson(f, url);
  const ids = isRecord(json) && Array.isArray(json['objectIDs']) ? (json['objectIDs'] as unknown[]) : [];
  console.log(`Met : ${ids.length} résultat(s) pour « ${q} »`);
  const out: Candidate[] = [];
  for (const id of ids.slice((page - 1) * limit, page * limit)) {
    if (typeof id !== 'number') continue;
    try {
      const c = await metCandidate(f, id);
      if (c?.thumbUrl) out.push(c);
    } catch (e) {
      console.warn(`met:${id} ignoré (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  return out;
}

async function loadRaster(f: Fetcher, url: string, key: string): Promise<Raster | null> {
  mkdirSync(THUMB_DIR, { recursive: true });
  const file = join(
    THUMB_DIR,
    `${key.replace(':', '_')}-${Buffer.from(url).toString('base64url').slice(-12)}.jpg`,
  );
  try {
    const buf = existsSync(file) ? readFileSync(file) : await fetchBuffer(f, url, 'jpeg');
    if (!existsSync(file)) writeFileSync(file, buf);
    const img = decodeJpeg(buf);
    return { pixels: img.data, width: img.width, height: img.height };
  } catch (e) {
    console.warn(`${key} : image indisponible (${e instanceof Error ? e.message : String(e)})`);
    return null;
  }
}

// Petite police 3×5 pour numéroter les vignettes (Sheet ne dessine pas de texte).
const DIGITS: Record<string, string> = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001001001001',
  '8': '111101111101111',
  '9': '111101111001111',
};

function drawNumber(sheet: Sheet, x: number, y: number, n: number, scale = 4): void {
  const text = String(n);
  const w = text.length * 4 * scale + scale;
  const h = 5 * scale + 2 * scale;
  const { png } = sheet;
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const o = ((y + yy) * png.width + x + xx) * 4;
      png.data.set([255, 255, 255, 255], o);
    }
  Array.from(text).forEach((ch, ci) => {
    const bits = DIGITS[ch] ?? '';
    for (let by = 0; by < 5; by++)
      for (let bx = 0; bx < 3; bx++) {
        if (bits[by * 3 + bx] !== '1') continue;
        for (let sy = 0; sy < scale; sy++)
          for (let sx = 0; sx < scale; sx++) {
            const px = x + scale + (ci * 4 + bx) * scale + sx;
            const py = y + scale + by * scale + sy;
            png.data.set([200, 0, 0, 255], (py * png.width + px) * 4);
          }
      }
  });
}

/** Planche : `perRow` œuvres par ligne, chacune = original + grille moyenne (96). Numérotée à partir de 1. */
function writeSheet(items: readonly { raster: Raster }[], perRow: number, tile: number, out: string): void {
  const rows = Math.ceil(items.length / perRow);
  const sheet = new Sheet(perRow * 2, rows, tile, 6);
  items.forEach((it, i) => {
    const col = (i % perRow) * 2;
    const row = Math.floor(i / perRow);
    sheet.image(col, row, it.raster);
    sheet.grid(col + 1, row, paintingToGrid(it.raster, 'medium'));
    drawNumber(sheet, 6 + col * (tile + 6), 6 + row * (tile + 6), i + 1);
  });
  writeFileSync(out, sheet.encode());
}

async function renderCandidates(f: Fetcher, cands: readonly Candidate[], opts: Options): Promise<void> {
  const out = opts.flags.get('out') ?? join(tmpdir(), 'pd-candidates.png');
  const perRow = Number(opts.flags.get('cols') ?? 3);
  const items: { raster: Raster }[] = [];
  const shown: Candidate[] = [];
  for (const c of cands) {
    if (!c.thumbUrl) continue;
    const raster = await loadRaster(f, c.thumbUrl, c.key);
    if (!raster) continue;
    items.push({ raster });
    shown.push(c);
  }
  shown.forEach((c, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${c.key.padEnd(10)} ${c.label}`);
  });
  if (items.length === 0) {
    console.log('aucune image à afficher');
    return;
  }
  writeSheet(items, perRow, 300, out);
  console.log(`planche : ${out}`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const [cmd, ...rest] = opts.positional;
  const f: Fetcher = { throttle: new Throttle(700), retryPauseMs: 8000 };
  const limit = Number(opts.flags.get('limit') ?? 20);
  const page = Number(opts.flags.get('page') ?? 1);

  if (cmd === 'search') {
    const [museum, ...words] = rest;
    if ((museum !== 'aic' && museum !== 'met') || words.length === 0)
      throw new Error('usage : search <aic|met> <mots-clés> [options]');
    const q = words.join(' ');
    const cands =
      museum === 'aic' ? await searchAic(f, q, limit, page) : await searchMet(f, q, limit, page, opts);
    if (opts.flags.has('list')) {
      for (const c of cands) console.log(`${c.key.padEnd(10)} ${c.label}`);
      return;
    }
    return renderCandidates(f, cands, opts);
  }

  if (cmd === 'ids') {
    const cands: Candidate[] = [];
    for (const spec of rest) {
      const [m, idText] = spec.split(':');
      const id = Number(idText);
      if ((m !== 'aic' && m !== 'met') || !Number.isInteger(id))
        throw new Error(`identifiant invalide : ${spec}`);
      const museum: Museum = m;
      if (museum === 'met') {
        const c = await metCandidate(f, id);
        if (c) cands.push(c);
        continue;
      }
      const json = await fetchJson(f, `https://api.artic.edu/api/v1/artworks/${id}?${aicFieldsQuery}`);
      const data = isRecord(json) ? json['data'] : null;
      if (!isRecord(data)) continue;
      const o = aicToObject(data);
      cands.push({
        key: spec,
        label: describe(o),
        thumbUrl: o.imageUrl ? aicImageUrl(str(data, 'image_id'), 843) : null,
      });
    }
    return renderCandidates(f, cands, opts);
  }

  if (cmd === 'final') {
    const out = opts.flags.get('out') ?? join(tmpdir(), 'pd-final.png');
    const perRow = Number(opts.flags.get('cols') ?? 4);
    const items: { raster: Raster }[] = [];
    for (const e of loadList()) {
      const file = cachePath(e.id);
      if (!existsSync(file)) {
        console.warn(`${e.id} : absent du cache (lancer import-pd.ts)`);
        continue;
      }
      const img = decodeJpeg(readFileSync(file));
      items.push({ raster: { pixels: img.data, width: img.width, height: img.height } });
      console.log(
        `${String(items.length).padStart(2)}. ${e.id.padEnd(34)} ${e.credit.artist} — ${e.title.fr}`,
      );
    }
    writeSheet(items, perRow, 230, out);
    console.log(`planche : ${out}`);
    return;
  }

  console.log(
    `usage : search <aic|met> <mots-clés> | ids <musée:id>… | final   (User-Agent : ${USER_AGENT})`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
