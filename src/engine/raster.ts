/**
 * Parcourt toutes les cases traversées par le segment (x0,y0)→(x1,y1) en coordonnées de cases
 * (algorithme d'Amanatides-Woo) : un glissé rapide ne saute jamais de case.
 * Le callback reçoit chaque case une fois, dans l'ordre ; il peut renvoyer false pour arrêter.
 */
export function traverseCells(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  visit: (cx: number, cy: number) => boolean | undefined,
): void {
  let cx = Math.floor(x0);
  let cy = Math.floor(y0);
  const ex = Math.floor(x1);
  const ey = Math.floor(y1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
  let tMaxX = stepX > 0 ? (cx + 1 - x0) / dx : stepX < 0 ? (x0 - cx) / -dx : Infinity;
  let tMaxY = stepY > 0 ? (cy + 1 - y0) / dy : stepY < 0 ? (y0 - cy) / -dy : Infinity;
  const maxSteps = Math.abs(ex - cx) + Math.abs(ey - cy) + 1;
  if (visit(cx, cy) === false) return;
  for (let i = 0; i < maxSteps && (cx !== ex || cy !== ey); i++) {
    if (tMaxX < tMaxY) {
      cx += stepX;
      tMaxX += tDeltaX;
    } else {
      cy += stepY;
      tMaxY += tDeltaY;
    }
    if (visit(cx, cy) === false) return;
  }
}
