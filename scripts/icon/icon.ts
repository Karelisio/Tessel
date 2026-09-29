/**
 * Icône de Tessel : un cœur de tesselles, moitié pixels (aplats), moitié diamants taillés qui brillent.
 * Génère les SVG sources (assets/icon/) : icône complète, avant-plan et fond adaptatifs, monochrome.
 */

/** Cœur 11 × 10. */
const HEART = [
  '..XX...XX..',
  '.XXXX.XXXX.',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  '.XXXXXXXXX.',
  '..XXXXXXX..',
  '...XXXXX...',
  '....XXX....',
  '.....X.....',
];
const COLS = 11;
const ROWS = HEART.length;

/** Dégradé doux du haut-gauche (pêche) vers le bas-droite (lilas), en passant par le rose. */
const STOPS: [number, [number, number, number]][] = [
  [0, [252, 196, 164]],
  [0.35, [246, 150, 170]],
  [0.7, [226, 128, 176]],
  [1, [176, 138, 214]],
];

function mix(a: number, b: number, k: number): number {
  return Math.round(a + (b - a) * k);
}

function colorAt(x: number, y: number): [number, number, number] {
  const k = Math.min(1, Math.max(0, (x / (COLS - 1)) * 0.55 + (y / (ROWS - 1)) * 0.45));
  for (let i = 1; i < STOPS.length; i++) {
    const [k1, c1] = STOPS[i] ?? [1, [0, 0, 0]];
    const [k0, c0] = STOPS[i - 1] ?? [0, [0, 0, 0]];
    if (k <= k1) {
      const t = (k - k0) / (k1 - k0);
      return [mix(c0[0], c1[0], t), mix(c0[1], c1[1], t), mix(c0[2], c1[2], t)];
    }
  }
  return STOPS[STOPS.length - 1]?.[1] ?? [0, 0, 0];
}

const rgb = ([r, g, b]: [number, number, number], k = 1) =>
  `rgb(${String(Math.min(255, Math.round(r * k)))},${String(Math.min(255, Math.round(g * k)))},${String(Math.min(255, Math.round(b * k)))})`;

/** Tesselles du cœur dans un carré de `size` unités centré en (cx, cy). */
function heartTiles(cx: number, cy: number, width: number, mono: string | null): string {
  const cell = width / COLS;
  const gap = cell * 0.1;
  const s = cell - gap;
  const x0 = cx - width / 2;
  const y0 = cy - (cell * ROWS) / 2 - cell * 0.2;
  const out: string[] = [];
  HEART.forEach((row, y) => {
    Array.from(row).forEach((ch, x) => {
      if (ch !== 'X') return;
      const px = x0 + x * cell + gap / 2;
      const py = y0 + y * cell + gap / 2;
      const r = s * 0.16;
      if (mono) {
        out.push(
          `<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" rx="${r.toFixed(2)}" fill="${mono}"/>`,
        );
        return;
      }
      const c = colorAt(x, y);
      // partie droite (et la pointe) : diamants taillés ; partie gauche : pixels à plat
      const diamond = x + y * 0.35 > 6.2;
      if (!diamond) {
        out.push(
          `<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" rx="${r.toFixed(2)}" fill="${rgb(c)}"/>`,
          // léger biseau lumineux en haut
          `<rect x="${(px + s * 0.12).toFixed(2)}" y="${(py + s * 0.1).toFixed(2)}" width="${(s * 0.76).toFixed(2)}" height="${(s * 0.14).toFixed(2)}" rx="${(s * 0.07).toFixed(2)}" fill="#fff" opacity="0.22"/>`,
        );
        return;
      }
      const m = s / 2;
      const ccx = px + m;
      const ccy = py + m;
      const tb = s * 0.22; // demi-côté de la table
      const P = (dx: number, dy: number) => `${(ccx + dx).toFixed(2)},${(ccy + dy).toFixed(2)}`;
      const facets: [string, number][] = [
        [`${P(-m, -m)} ${P(m, -m)} ${P(tb, -tb)} ${P(-tb, -tb)}`, 1.22],
        [`${P(m, -m)} ${P(m, m)} ${P(tb, tb)} ${P(tb, -tb)}`, 0.86],
        [`${P(m, m)} ${P(-m, m)} ${P(-tb, tb)} ${P(tb, tb)}`, 0.72],
        [`${P(-m, m)} ${P(-m, -m)} ${P(-tb, -tb)} ${P(-tb, tb)}`, 1.08],
      ];
      out.push(
        `<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" rx="${r.toFixed(2)}" fill="${rgb(c, 0.9)}"/>`,
      );
      for (const [pts, k] of facets) out.push(`<polygon points="${pts}" fill="${rgb(c, k)}"/>`);
      out.push(
        `<rect x="${(ccx - tb).toFixed(2)}" y="${(ccy - tb).toFixed(2)}" width="${(tb * 2).toFixed(2)}" height="${(tb * 2).toFixed(2)}" fill="${rgb(c, 1.12)}"/>`,
      );
      out.push(
        `<circle cx="${(ccx - tb * 0.4).toFixed(2)}" cy="${(ccy - tb * 0.45).toFixed(2)}" r="${(tb * 0.35).toFixed(2)}" fill="#fff" opacity="0.55"/>`,
      );
    });
  });
  if (!mono) {
    // deux éclats de lumière sur les diamants
    const star = (sx: number, sy: number, k: number) => {
      const a = cell * 0.55 * k;
      const b = cell * 0.09 * k;
      return `<path d="M${String(sx)} ${String(sy - a)} L${String(sx + b)} ${String(sy - b)} L${String(sx + a)} ${String(sy)} L${String(sx + b)} ${String(sy + b)} L${String(sx)} ${String(sy + a)} L${String(sx - b)} ${String(sy + b)} L${String(sx - a)} ${String(sy)} L${String(sx - b)} ${String(sy - b)} Z" fill="#fff"/>`;
    };
    out.push(star(x0 + cell * 8.6, y0 + cell * 1.4, 1), star(x0 + cell * 9.9, y0 + cell * 4.3, 0.6));
  }
  return out.join('');
}

const BG = `<defs><radialGradient id="bg" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="#FFF8F1"/><stop offset="0.6" stop-color="#FBEDEA"/><stop offset="1" stop-color="#F4DCE4"/></radialGradient></defs><rect width="108" height="108" fill="url(#bg)"/>`;

const svg = (body: string, size = 108) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(size)} ${String(size)}" width="${String(size)}" height="${String(size)}">${body}</svg>`;

/** Icônes sources (unités : grille adaptative Android de 108 dp, zone sûre de 66 dp au centre). */
export const ICONS = {
  /** Avant-plan adaptatif (le cœur tient dans la zone sûre). */
  foreground: svg(
    `<g filter="drop-shadow(0 1.2px 1.2px rgba(120,60,80,0.18))">${heartTiles(54, 55, 58, null)}</g>`,
  ),
  background: svg(BG),
  /** Icône complète (anciennes versions d'Android, magasin, README). */
  full: svg(`${BG}<g>${heartTiles(54, 55, 66, null)}</g>`),
  /** Icône thématique Android 13+ (une seule couleur). */
  monochrome: svg(heartTiles(54, 55, 58, '#000')),
  /** Petite icône des notifications (silhouette blanche). */
  notification: svg(heartTiles(54, 54, 92, '#fff')),
} as const;
