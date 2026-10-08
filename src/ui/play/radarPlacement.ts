/** Rectangle en px CSS (coordonnées de l'écran de jeu). */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Emprise de la flèche autour de son centre : pastille de 40 px, compteur en dessous. */
export const ARROW_EXTENT = { left: 22, right: 22, top: 22, bottom: 38 } as const;

/** Pas de recherche le long du pourtour (px). */
const STEP = 2;

/** Point du pourtour de `area` atteint depuis `origin` dans la direction `angle`. */
function rayToBorder(area: Box, origin: readonly [number, number], angle: number): [number, number] {
  const [ox, oy] = origin;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tx = cos > 1e-9 ? (area.right - ox) / cos : cos < -1e-9 ? (area.left - ox) / cos : Infinity;
  const ty = sin > 1e-9 ? (area.bottom - oy) / sin : sin < -1e-9 ? (area.top - oy) / sin : Infinity;
  const s = Math.max(0, Math.min(tx, ty));
  return [
    Math.min(area.right, Math.max(area.left, ox + cos * s)),
    Math.min(area.bottom, Math.max(area.top, oy + sin * s)),
  ];
}

/** Pourtour parcouru dans le sens horaire depuis le coin haut gauche. */
function perimeterPoint(area: Box, s: number): [number, number] {
  const w = area.right - area.left;
  const h = area.bottom - area.top;
  const per = 2 * (w + h);
  let d = ((s % per) + per) % per;
  if (d <= w) return [area.left + d, area.top];
  d -= w;
  if (d <= h) return [area.right, area.top + d];
  d -= h;
  if (d <= w) return [area.right - d, area.bottom];
  d -= w;
  return [area.left, area.bottom - d];
}

function perimeterParam(area: Box, [x, y]: readonly [number, number]): number {
  const w = area.right - area.left;
  const h = area.bottom - area.top;
  const dTop = Math.abs(y - area.top);
  const dRight = Math.abs(x - area.right);
  const dBottom = Math.abs(y - area.bottom);
  const dLeft = Math.abs(x - area.left);
  const m = Math.min(dTop, dRight, dBottom, dLeft);
  if (m === dTop) return x - area.left;
  if (m === dRight) return w + (y - area.top);
  if (m === dBottom) return w + h + (area.right - x);
  return 2 * w + h + (area.bottom - y);
}

/** La flèche centrée en (x, y) toucherait-elle l'obstacle ? */
function collides(x: number, y: number, o: Box, margin: number): boolean {
  return (
    x + ARROW_EXTENT.right + margin > o.left &&
    x - ARROW_EXTENT.left - margin < o.right &&
    y + ARROW_EXTENT.bottom + margin > o.top &&
    y - ARROW_EXTENT.top - margin < o.bottom
  );
}

/**
 * Position de la flèche du radar : sur le pourtour `area` (que parcourt son centre), au plus près du
 * point visé depuis `origin` dans la direction `angle`, mais jamais sous un obstacle (minicarte,
 * outils…) : elle glisse le long du bord jusqu'à la première place libre.
 * Si tout le pourtour est masqué, le point visé est rendu tel quel.
 */
export function placeArrow(
  area: Box,
  origin: readonly [number, number],
  angle: number,
  obstacles: readonly Box[],
  margin = 6,
): [number, number] {
  const ideal = rayToBorder(area, origin, angle);
  const w = area.right - area.left;
  const h = area.bottom - area.top;
  if (w <= 0 || h <= 0 || obstacles.length === 0) return ideal;
  const free = ([x, y]: readonly [number, number]) => !obstacles.some((o) => collides(x, y, o, margin));
  if (free(ideal)) return ideal;
  const per = 2 * (w + h);
  const s0 = perimeterParam(area, ideal);
  for (let d = STEP; d <= per / 2; d += STEP) {
    const a = perimeterPoint(area, s0 + d);
    const b = perimeterPoint(area, s0 - d);
    // à égalité, le côté le plus proche de la direction visée
    const da = Math.hypot(a[0] - ideal[0], a[1] - ideal[1]);
    const db = Math.hypot(b[0] - ideal[0], b[1] - ideal[1]);
    const [first, second] = da <= db ? [a, b] : [b, a];
    if (free(first)) return first;
    if (free(second)) return second;
  }
  return ideal;
}
