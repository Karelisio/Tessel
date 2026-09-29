import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import jpeg from 'jpeg-js';

/**
 * Import des œuvres du domaine public (CC0) : lit `assets/art/public-domain.json`, vérifie la licence via
 * l'API du musée, télécharge chaque image (1600 px max) dans `assets/art/sources/cache/` puis réécrit
 * `assets/art/CREDITS.md`. Idempotent : une image déjà présente n'est pas retéléchargée.
 * Usage : npx tsx --tsconfig tsconfig.app.json scripts/art/import-pd.ts
 */

export type Museum = 'aic' | 'met';

export interface PdCredit {
  artist: string;
  title: string;
  date: string;
  museum: string;
  url: string;
  license: string;
}

export interface PdEntry {
  id: string;
  category: string;
  title: { fr: string; en: string };
  museum: Museum;
  objectId: number;
  credit: PdCredit;
}

/** Ce que l'API du musée déclare pour un objet. */
export interface MuseumObject {
  id: number;
  title: string;
  artist: string;
  date: string;
  publicDomain: boolean;
  imageUrl: string | null;
  pageUrl: string;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const LIST_FILE = join(ROOT, 'assets/art/public-domain.json');
export const CACHE_DIR = join(ROOT, 'assets/art/sources/cache');
const CREDITS_FILE = join(ROOT, 'assets/art/CREDITS.md');

export const USER_AGENT = 'Tessel-art-import/1.0 (open-source coloring game)';
export const MAX_SIDE = 1600;
const AIC_API = 'https://api.artic.edu/api/v1/artworks';
const MET_API = 'https://collectionapi.metmuseum.org/public/collection/v1/objects';

export const CATEGORIES: readonly { key: string; label: string }[] = [
  { key: 'chefs-doeuvre', label: 'Chefs-d’œuvre' },
  { key: 'japon', label: 'Japon' },
  { key: 'fleurs', label: 'Fleurs' },
  { key: 'oiseaux', label: 'Oiseaux' },
  { key: 'paysages', label: 'Paysages' },
  { key: 'mer', label: 'Mer' },
  { key: 'insectes', label: 'Insectes' },
  { key: 'architecture', label: 'Architecture' },
];

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// Réseau : une requête à la fois, espacées, avec un nouvel essai si le CDN renvoie une page HTML.

export class Throttle {
  private last = 0;
  constructor(readonly minMs: number) {}
  async wait(): Promise<void> {
    const gap = this.last + this.minMs - Date.now();
    if (gap > 0) await sleep(gap);
    this.last = Date.now();
  }
}

export type Expect = 'json' | 'jpeg';

export interface Fetcher {
  throttle: Throttle;
  /** Pause avant le second essai quand le serveur répond par une page de contrôle HTML. */
  retryPauseMs: number;
}

function isJpeg(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8;
}

function looksLikeHtml(buf: Buffer): boolean {
  return /^\s*<(!doctype|html|head|body)/i.test(buf.subarray(0, 64).toString('latin1'));
}

function headersFor(url: string): Record<string, string> {
  const h: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (new URL(url).hostname.endsWith('artic.edu')) h['AIC-User-Agent'] = USER_AGENT;
  return h;
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Télécharge `url` ; deux essais au plus (le second après une pause) si la réponse n'est pas du JSON/JPEG. */
export async function fetchBuffer(f: Fetcher, url: string, expect: Expect): Promise<Buffer> {
  let lastError = new Error(`échec : ${url}`);
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(f.retryPauseMs);
    await f.throttle.wait();
    try {
      const res = await fetch(url, { headers: headersFor(url), signal: AbortSignal.timeout(45_000) });
      const buf = Buffer.from(await res.arrayBuffer());
      if (res.status === 404) throw new HttpError(`HTTP 404 : ${url}`, 404);
      const challenge = looksLikeHtml(buf) || res.status === 429 || res.status >= 500;
      if (challenge) {
        lastError = new HttpError(`page de contrôle ou erreur HTTP ${res.status} : ${url}`, res.status);
        continue;
      }
      if (!res.ok) throw new HttpError(`HTTP ${res.status} : ${url}`, res.status);
      if (expect === 'jpeg' && !isJpeg(buf)) {
        lastError = new HttpError(`réponse qui n'est pas un JPEG : ${url}`, res.status);
        continue;
      }
      if (expect === 'json') {
        try {
          JSON.parse(buf.toString('utf8'));
        } catch {
          lastError = new HttpError(`réponse qui n'est pas du JSON : ${url}`, res.status);
          continue;
        }
      }
      return buf;
    } catch (e) {
      if (e instanceof HttpError && e.status !== 403) throw e;
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError;
}

export async function fetchJson(f: Fetcher, url: string): Promise<unknown> {
  return JSON.parse((await fetchBuffer(f, url, 'json')).toString('utf8')) as unknown;
}

// ---------------------------------------------------------------------------------------------
// Lecture défensive du JSON des API.

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
export const str = (o: Record<string, unknown>, k: string): string => {
  const v = o[k];
  return typeof v === 'string' ? v : '';
};
export const num = (o: Record<string, unknown>, k: string): number => {
  const v = o[k];
  return typeof v === 'number' ? v : 0;
};
export const bool = (o: Record<string, unknown>, k: string): boolean => o[k] === true;

export const aicPage = (id: number): string => `https://www.artic.edu/artworks/${id}`;

/** Image IIIF de l'AIC de `width` px de large (843 est la taille conseillée, la plus fiable côté serveur). */
export const aicImageUrl = (imageId: string, width = MAX_SIDE): string =>
  `https://www.artic.edu/iiif/2/${imageId}/full/${width},/0/default.jpg`;

export const aicFieldsQuery = 'fields=id,title,artist_display,date_display,image_id,is_public_domain';

export function aicToObject(d: Record<string, unknown>): MuseumObject {
  const imageId = str(d, 'image_id');
  return {
    id: num(d, 'id'),
    title: str(d, 'title'),
    artist: str(d, 'artist_display'),
    date: str(d, 'date_display'),
    publicDomain: bool(d, 'is_public_domain'),
    imageUrl: imageId ? aicImageUrl(imageId) : null,
    pageUrl: aicPage(num(d, 'id')),
  };
}

export function metToObject(d: Record<string, unknown>): MuseumObject {
  return {
    id: num(d, 'objectID'),
    title: str(d, 'title'),
    artist: str(d, 'artistDisplayName'),
    date: str(d, 'objectDate'),
    publicDomain: bool(d, 'isPublicDomain'),
    imageUrl: str(d, 'primaryImage') || null,
    pageUrl: str(d, 'objectURL'),
  };
}

export async function fetchObject(f: Fetcher, museum: Museum, id: number): Promise<MuseumObject> {
  if (museum === 'aic') {
    const json = await fetchJson(f, `${AIC_API}/${id}?${aicFieldsQuery}`);
    const data = isRecord(json) ? json['data'] : null;
    if (!isRecord(data)) throw new Error(`AIC ${id} : réponse inattendue`);
    return aicToObject(data);
  }
  const json = await fetchJson(f, `${MET_API}/${id}`);
  if (!isRecord(json)) throw new Error(`Met ${id} : réponse inattendue`);
  return metToObject(json);
}

// ---------------------------------------------------------------------------------------------
// JPEG : décodage, réduction (le Met ne sert que l'original), réencodage.

export interface Decoded {
  width: number;
  height: number;
  data: Uint8Array;
}

export function decodeJpeg(buf: Buffer): Decoded {
  const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 3072 });
  return { width: img.width, height: img.height, data: img.data };
}

/** Réduction par moyenne de boîte (bonne qualité pour des réductions importantes). */
export function downscale(img: Decoded, maxSide: number): Decoded {
  const k = maxSide / Math.max(img.width, img.height);
  if (k >= 1) return img;
  const width = Math.max(1, Math.round(img.width * k));
  const height = Math.max(1, Math.round(img.height * k));
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor((y * img.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / height));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * img.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / width));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++)
        for (let sx = x0; sx < x1; sx++) {
          const o = (sy * img.width + sx) * 4;
          r += img.data[o] ?? 0;
          g += img.data[o + 1] ?? 0;
          b += img.data[o + 2] ?? 0;
          n++;
        }
      const o = (y * width + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  }
  return { width, height, data: out };
}

/** JPEG de sortie : celui du musée s'il tient déjà dans MAX_SIDE, sinon une version réduite. */
export function fitJpeg(buf: Buffer, maxSide = MAX_SIDE): { buf: Buffer; width: number; height: number } {
  const img = decodeJpeg(buf);
  if (Math.max(img.width, img.height) <= maxSide) return { buf, width: img.width, height: img.height };
  const small = downscale(img, maxSide);
  const enc = jpeg.encode({ data: small.data, width: small.width, height: small.height }, 90);
  return { buf: enc.data, width: small.width, height: small.height };
}

async function downloadImage(f: Fetcher, museum: Museum, obj: MuseumObject): Promise<Buffer> {
  if (!obj.imageUrl) throw new Error('pas d’image publiée');
  let raw: Buffer;
  try {
    raw = await fetchBuffer(f, obj.imageUrl, 'jpeg');
  } catch (e) {
    // IIIF de l'AIC : le serveur refuse parfois la taille demandée (source plus petite, 500), on retombe sur 843 px.
    if (museum !== 'aic') throw e;
    const imageId = /\/iiif\/2\/([^/]+)\//.exec(obj.imageUrl)?.[1];
    if (!imageId) throw e;
    raw = await fetchBuffer(f, aicImageUrl(imageId, 843), 'jpeg');
  }
  return fitJpeg(raw).buf;
}

// ---------------------------------------------------------------------------------------------
// Liste, cache, crédits.

export const cachePath = (id: string): string => join(CACHE_DIR, `${id.replaceAll('/', '__')}.jpg`);

export function loadList(file = LIST_FILE): PdEntry[] {
  const json: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(json)) throw new Error(`${file} : un tableau est attendu`);
  const ids = new Set<string>();
  return json.map((raw: unknown, i) => {
    if (!isRecord(raw)) throw new Error(`entrée ${i} invalide`);
    const e = raw as unknown as PdEntry;
    const bad = (why: string): Error => new Error(`entrée ${i} (${e.id}) : ${why}`);
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(e.id))
      throw bad('id attendu <catégorie>/<slug> en kebab-case ASCII');
    if (e.id.split('/')[0] !== e.category) throw bad('la catégorie ne correspond pas à l’id');
    if (!CATEGORIES.some((c) => c.key === e.category)) throw bad('catégorie inconnue');
    const museum: string = e.museum;
    if (museum !== 'aic' && museum !== 'met') throw bad('musée inconnu');
    if (!Number.isInteger(e.objectId)) throw bad('objectId invalide');
    if (!e.title.fr || !e.title.en) throw bad('titres fr/en requis');
    if (e.credit.license !== 'CC0') throw bad('licence attendue : CC0');
    if (ids.has(e.id)) throw bad('id en double');
    ids.add(e.id);
    return e;
  });
}

const mdCell = (s: string): string => s.replaceAll('|', '\\|').replaceAll('\n', ' ');

export function renderCredits(entries: readonly PdEntry[]): string {
  const out: string[] = [
    '# Crédits — œuvres du domaine public',
    '',
    'Œuvres du domaine public mises à disposition en CC0 (ouverture des collections) par les musées ci-dessous.',
    'Fichier généré par `scripts/art/import-pd.ts` à partir de `assets/art/public-domain.json` : ne pas modifier à la main.',
    '',
  ];
  for (const cat of CATEGORIES) {
    const items = entries.filter((e) => e.category === cat.key);
    if (items.length === 0) continue;
    out.push(
      `## ${cat.label}`,
      '',
      '| Titre | Artiste | Date | Musée | Licence |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const e of items) {
      const c = e.credit;
      const title = `[${mdCell(e.title.fr)} / ${mdCell(e.title.en)}](${c.url})`;
      out.push(`| ${title} | ${mdCell(c.artist)} | ${mdCell(c.date)} | ${mdCell(c.museum)} | ${c.license} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function main(): Promise<void> {
  const entries = loadList();
  const fetcher: Fetcher = { throttle: new Throttle(1500), retryPauseMs: 8000 };
  mkdirSync(CACHE_DIR, { recursive: true });
  const verified: PdEntry[] = [];
  const failures: string[] = [];
  let downloaded = 0;

  for (const [i, e] of entries.entries()) {
    const tag = `[${i + 1}/${entries.length}] ${e.id}`;
    try {
      const obj = await fetchObject(fetcher, e.museum, e.objectId);
      if (!obj.publicDomain) throw new Error('l’API ne déclare pas l’œuvre dans le domaine public');
      if (norm(obj.title) !== norm(e.credit.title) && !norm(obj.title).includes(norm(e.credit.title)))
        console.warn(`${tag} : titre différent chez le musée (« ${obj.title} » ≠ « ${e.credit.title} »)`);
      if (obj.pageUrl && obj.pageUrl !== e.credit.url)
        console.warn(`${tag} : url différente chez le musée (${obj.pageUrl} ≠ ${e.credit.url})`);
      const file = cachePath(e.id);
      if (existsSync(file)) {
        console.log(`${tag} : déjà en cache, licence vérifiée`);
      } else {
        writeFileSync(file, await downloadImage(fetcher, e.museum, obj));
        downloaded++;
        console.log(`${tag} : téléchargé`);
      }
      verified.push(e);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${e.id} : ${msg}`);
      console.error(`${tag} : ÉCHEC — ${msg}`);
    }
  }

  writeFileSync(CREDITS_FILE, renderCredits(verified));
  console.log(
    `\n${verified.length}/${entries.length} œuvres vérifiées, ${downloaded} téléchargée(s) ; crédits : ${CREDITS_FILE}`,
  );
  if (failures.length > 0) {
    console.error(`\nÉchecs (${failures.length}) :\n${failures.map((f) => `  - ${f}`).join('\n')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  });
}
