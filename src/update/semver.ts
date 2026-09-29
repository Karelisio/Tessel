/** Versions sémantiques 2.0 (https://semver.org) : lecture et comparaison, sans dépendance. */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  /** Identifiants de pré-version : nombres ou chaînes (`1.0.0-beta.2` → `['beta', 2]`). */
  pre: readonly (string | number)[];
  /** Métadonnées de build (ignorées à la comparaison). */
  build: readonly string[];
}

const NUMERIC = '(0|[1-9]\\d*)';
const PRE_ID = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)';
const BUILD_ID = '[0-9A-Za-z-]+';
const PATTERN = new RegExp(
  `^${NUMERIC}\\.${NUMERIC}\\.${NUMERIC}(?:-(${PRE_ID}(?:\\.${PRE_ID})*))?(?:\\+(${BUILD_ID}(?:\\.${BUILD_ID})*))?$`,
);

function toNumber(text: string): number | null {
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Lit une version (`1.2.3`, `v1.2.3-beta.1+build.5`). Espaces et préfixe `v`/`V` tolérés.
 * Renvoie null si le texte n'est pas une version sémantique valide.
 */
export function parse(input: string): SemVer | null {
  const text = input.trim().replace(/^[vV]/, '');
  const m = PATTERN.exec(text);
  if (!m) return null;
  const major = toNumber(m[1] ?? '');
  const minor = toNumber(m[2] ?? '');
  const patch = toNumber(m[3] ?? '');
  if (major === null || minor === null || patch === null) return null;
  const pre: (string | number)[] = [];
  for (const id of m[4] ? m[4].split('.') : []) {
    if (/^\d+$/.test(id)) {
      const n = toNumber(id);
      if (n === null) return null;
      pre.push(n);
    } else pre.push(id);
  }
  return { major, minor, patch, pre, build: m[5] ? m[5].split('.') : [] };
}

/** Compare deux identifiants de pré-version : nombres avant chaînes, nombres par valeur, chaînes en ASCII. */
function compareIdentifier(a: string | number, b: string | number): number {
  const an = typeof a === 'number';
  const bn = typeof b === 'number';
  if (an && bn) return a === b ? 0 : a < b ? -1 : 1;
  if (an) return -1;
  if (bn) return 1;
  return a === b ? 0 : a < b ? -1 : 1;
}

/** Ordre de précédence de semver 2.0 : négatif si a < b, 0 si égales, positif si a > b. */
export function compareParsed(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  // une version sans pré-version passe devant celle qui en a une
  if (a.pre.length === 0 && b.pre.length === 0) return 0;
  if (a.pre.length === 0) return 1;
  if (b.pre.length === 0) return -1;
  const n = Math.min(a.pre.length, b.pre.length);
  for (let i = 0; i < n; i++) {
    const c = compareIdentifier(a.pre[i] ?? 0, b.pre[i] ?? 0);
    if (c !== 0) return c;
  }
  // à préfixe égal, le jeu d'identifiants le plus long l'emporte
  return a.pre.length === b.pre.length ? 0 : a.pre.length < b.pre.length ? -1 : 1;
}

/** Compare deux textes de version ; une version illisible est considérée plus ancienne que toute autre. */
export function compare(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (pa && pb) return compareParsed(pa, pb);
  if (!pa && !pb) return 0;
  return pa ? 1 : -1;
}

/** Vrai si `candidate` est strictement plus récente que `installed` (les deux doivent être lisibles). */
export function isNewer(candidate: string, installed: string): boolean {
  const pc = parse(candidate);
  const pi = parse(installed);
  return pc !== null && pi !== null && compareParsed(pc, pi) > 0;
}

/** Forme canonique sans préfixe `v` ni métadonnées de build (`v1.2.3+b` → `1.2.3`). */
export function format(v: SemVer): string {
  return `${String(v.major)}.${String(v.minor)}.${String(v.patch)}${v.pre.length ? `-${v.pre.join('.')}` : ''}`;
}

export function isPrerelease(v: SemVer): boolean {
  return v.pre.length > 0;
}
