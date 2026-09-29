import { APP_CONFIG } from '@/config/app';
import { format, parse, compareParsed } from './semver';

/** Nature d'un échec de mise à jour, traduite en message doux par l'interface. */
export type UpdateErrorKind =
  'network' | 'rateLimit' | 'invalid' | 'noChecksum' | 'corrupt' | 'io' | 'install' | 'unavailable';

export class UpdateError extends Error {
  constructor(
    readonly kind: UpdateErrorKind,
    message?: string,
  ) {
    super(message ?? kind);
    this.name = 'UpdateError';
  }
}

export interface ReleaseAsset {
  name: string;
  /** `browser_download_url` (https). */
  url: string;
  /** URL de l'API pour cet asset, si fournie. */
  apiUrl: string | null;
  size: number;
  /** Empreinte publiée par GitHub (`sha256:<hex>`), si présente. */
  digest: string | null;
}

export interface Release {
  tag: string;
  /** Version canonique (sans `v` ni build). */
  version: string;
  name: string;
  /** Notes de version en Markdown. */
  body: string;
  prerelease: boolean;
  /** Page de la release (repli navigateur). */
  htmlUrl: string;
  publishedAt: string | null;
  apk: ReleaseAsset;
  sha256File: ReleaseAsset | null;
}

const { owner, repo } = APP_CONFIG.github;
const API = `https://api.github.com/repos/${owner}/${repo}`;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_CHECKSUM_CHARS = 4096;

export const releasesUrl = (includePrereleases: boolean): string =>
  includePrereleases ? `${API}/releases?per_page=10` : `${API}/releases/latest`;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

function httpsUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    return new URL(s).protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
}

function parseAsset(raw: unknown): ReleaseAsset | null {
  if (!isRecord(raw)) return null;
  const name = str(raw.name);
  const url = httpsUrl(raw.browser_download_url);
  if (!name || !url) return null;
  const size = typeof raw.size === 'number' && Number.isFinite(raw.size) && raw.size > 0 ? raw.size : 0;
  const digest = str(raw.digest);
  return {
    name,
    url,
    apiUrl: httpsUrl(raw.url),
    size,
    digest: digest && /^sha256:/i.test(digest) ? digest : null,
  };
}

/** Lit une release de l'API GitHub ; null si brouillon, tag illisible ou APK absent. */
export function parseRelease(raw: unknown): Release | null {
  if (!isRecord(raw) || raw.draft === true) return null;
  const tag = str(raw.tag_name);
  const semver = tag ? parse(tag) : null;
  if (!tag || !semver) return null;
  const assets = (Array.isArray(raw.assets) ? (raw.assets as unknown[]) : [])
    .map(parseAsset)
    .filter((a): a is ReleaseAsset => a !== null);
  const version = format(semver);
  const apk =
    assets.find((a) => a.name === `tessel-v${version}.apk`) ??
    assets.find((a) => /^tessel-v.+\.apk$/i.test(a.name));
  if (!apk) return null;
  const sha256File = assets.find((a) => a.name === `${apk.name}.sha256`) ?? null;
  return {
    tag,
    version,
    name: str(raw.name)?.trim() || `Tessel ${version}`,
    body: str(raw.body) ?? '',
    prerelease: raw.prerelease === true || semver.pre.length > 0,
    htmlUrl:
      httpsUrl(raw.html_url) ?? `https://github.com/${owner}/${repo}/releases/tag/${encodeURIComponent(tag)}`,
    publishedAt: str(raw.published_at),
    apk,
    sha256File,
  };
}

/**
 * Choisit la release à proposer parmi la réponse de `/releases/latest` (un objet) ou de `/releases` (une liste) :
 * jamais de brouillon, pré-versions seulement si demandé, la version la plus haute l'emporte
 * (à égalité, la première de la liste, donc la plus récente).
 */
export function pickRelease(raw: unknown, includePrereleases: boolean): Release | null {
  const list = Array.isArray(raw) ? (raw as unknown[]) : [raw];
  let best: Release | null = null;
  for (const item of list) {
    const release = parseRelease(item);
    if (!release || (release.prerelease && !includePrereleases)) continue;
    if (!best) {
      best = release;
      continue;
    }
    const a = parse(release.version);
    const b = parse(best.version);
    if (a && b && compareParsed(a, b) > 0) best = release;
  }
  return best;
}

/**
 * Lit le contenu d'un fichier `.sha256` : `<hex>  nom`, `<hex> *nom`, ou juste `<hex>`.
 * Si `fileName` est donné et que plusieurs lignes nomment des fichiers, celle du fichier est choisie.
 * Renvoie l'empreinte en minuscules, ou null.
 */
export function parseSha256(text: string, fileName?: string): string | null {
  const entries: { hash: string; name: string | null }[] = [];
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = /^\s*([0-9a-fA-F]{64})(?:\s+\*?(.+?))?\s*$/.exec(line);
    if (m?.[1]) entries.push({ hash: m[1].toLowerCase(), name: m[2] ?? null });
  }
  if (fileName) {
    const named = entries.find((e) => e.name !== null && e.name.split(/[\\/]/).pop() === fileName);
    if (named) return named.hash;
    // des lignes nomment d'autres fichiers uniquement : pas d'empreinte fiable pour celui-ci
    if (entries.length > 0 && entries.every((e) => e.name !== null)) return null;
  }
  return entries[0]?.hash ?? null;
}

function signal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;
}

async function request(url: string, accept: string | null, fetchImpl: typeof fetch): Promise<Response> {
  const sig = signal();
  try {
    return await fetchImpl(url, {
      method: 'GET',
      ...(accept && { headers: { Accept: accept } }),
      // aucune donnée personnelle : ni cookies, ni référent
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      ...(sig && { signal: sig }),
    });
  } catch {
    throw new UpdateError('network');
  }
}

/**
 * Interroge l'API GitHub Releases. Renvoie la release à proposer, ou null s'il n'y en a aucune.
 * Seule l'URL de la requête est envoyée, avec l'en-tête `Accept`.
 */
export async function fetchLatestRelease(
  includePrereleases: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<Release | null> {
  const res = await request(releasesUrl(includePrereleases), 'application/vnd.github+json', fetchImpl);
  if (res.status === 404) return null;
  if (res.status === 403 || res.status === 429) throw new UpdateError('rateLimit');
  if (!res.ok) throw new UpdateError('network', `HTTP ${String(res.status)}`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new UpdateError('invalid');
  }
  return pickRelease(json, includePrereleases);
}

async function tryText(url: string, accept: string | null, fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const res = await request(url, accept, fetchImpl);
    if (!res.ok) return null;
    const text = await res.text();
    return text.length <= MAX_CHECKSUM_CHARS ? text : null;
  } catch {
    return null;
  }
}

/**
 * Empreinte SHA-256 de l'APK : d'abord le fichier `.sha256` de la release, sinon l'empreinte publiée
 * par GitHub pour l'asset. Lève `noChecksum` si aucune source n'est exploitable (on ne télécharge jamais sans).
 */
export async function fetchSha256(release: Release, fetchImpl: typeof fetch = fetch): Promise<string> {
  const file = release.sha256File;
  if (file) {
    const direct = await tryText(file.url, null, fetchImpl);
    const viaApi =
      direct === null && file.apiUrl
        ? await tryText(file.apiUrl, 'application/octet-stream', fetchImpl)
        : null;
    const hash = parseSha256(direct ?? viaApi ?? '', release.apk.name);
    if (hash) return hash;
  }
  const digest = release.apk.digest ? /^sha256:([0-9a-fA-F]{64})$/i.exec(release.apk.digest)?.[1] : undefined;
  if (digest) return digest.toLowerCase();
  throw new UpdateError('noChecksum');
}
