import type { CropRect } from '@/convert/resample';
import { clamp } from './math';

/** Rectangle de recadrage normalisé (0–1) par rapport à la photo entière. */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CropHandle = 'nw' | 'ne' | 'sw' | 'se';

export const FULL_CROP: NormRect = { x: 0, y: 0, w: 1, h: 1 };

export type FormatId = 'free' | 'square' | '4:3' | '3:4';

/** Préréglages de format : rapport largeur / hauteur en pixels (`null` = libre). */
export const FORMATS: readonly { id: FormatId; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Libre', ratio: null },
  { id: 'square', label: 'Carré', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
];

/**
 * Rapport largeur / hauteur d'un rectangle normalisé pour un format donné en pixels :
 * la photo n'étant pas carrée, 1 unité horizontale ne vaut pas 1 unité verticale.
 */
export function normalizedRatio(pixelRatio: number, srcW: number, srcH: number): number {
  return (pixelRatio * srcH) / srcW;
}

/** Format (largeur / hauteur en pixels) d'un recadrage sur une photo de `srcW × srcH`. */
export function cropAspect(r: NormRect, srcW: number, srcH: number): number {
  return (r.w * srcW) / (r.h * srcH);
}

/** Recadrage normalisé → pixels de la photo réduite (ce qu'attend la conversion). */
export function toCropRect(r: NormRect, srcW: number, srcH: number): CropRect {
  return { x: r.x * srcW, y: r.y * srcH, w: r.w * srcW, h: r.h * srcH };
}

/** Plus grand rectangle de rapport `aspect` (largeur / hauteur) qui tient dans `maxW × maxH`. */
export function fitInside(aspect: number, maxW: number, maxH: number): { w: number; h: number } {
  if (!(aspect > 0) || maxW <= 0 || maxH <= 0) return { w: 0, h: 0 };
  const w = Math.min(maxW, maxH * aspect);
  return { w, h: w / aspect };
}

/** Déplace le rectangle sans jamais le sortir de la photo. */
export function moveRect(r: NormRect, dx: number, dy: number): NormRect {
  return { ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) };
}

export interface ResizeLimits {
  /** Rapport largeur / hauteur normalisé imposé, ou `null` si le format est libre. */
  ratio: number | null;
  /** Tailles minimales (normalisées). */
  minW: number;
  minH: number;
}

/**
 * Redimensionne depuis un coin : le coin opposé reste fixe, le coin saisi suit le doigt.
 * Avec un format imposé, le coin est projeté sur la diagonale du format (mouvement fluide
 * quelle que soit la direction du doigt). Le rectangle reste toujours dans la photo.
 */
export function resizeRect(
  start: NormRect,
  handle: CropHandle,
  dx: number,
  dy: number,
  { ratio, minW, minH }: ResizeLimits,
): NormRect {
  const west = handle === 'nw' || handle === 'sw';
  const north = handle === 'nw' || handle === 'ne';
  const anchorX = west ? start.x + start.w : start.x;
  const anchorY = north ? start.y + start.h : start.y;
  const cornerX = (west ? start.x : start.x + start.w) + dx;
  const cornerY = (north ? start.y : start.y + start.h) + dy;
  // dimensions souhaitées, comptées depuis le coin fixe vers le coin saisi
  const wantW = (west ? anchorX - cornerX : cornerX - anchorX) || 0;
  const wantH = (north ? anchorY - cornerY : cornerY - anchorY) || 0;
  // place disponible dans la photo depuis le coin fixe
  const maxW = west ? anchorX : 1 - anchorX;
  const maxH = north ? anchorY : 1 - anchorY;

  let w: number;
  let h: number;
  if (ratio === null) {
    w = clamp(wantW, Math.min(minW, maxW), maxW);
    h = clamp(wantH, Math.min(minH, maxH), maxH);
  } else {
    const t = (Math.max(0, wantW) * ratio + Math.max(0, wantH)) / (ratio * ratio + 1);
    const hi = Math.min(maxW / ratio, maxH);
    const lo = Math.min(Math.max(minW / ratio, minH), hi);
    h = clamp(t, lo, hi);
    w = h * ratio;
  }
  return { x: west ? anchorX - w : anchorX, y: north ? anchorY - h : anchorY, w, h };
}

/**
 * Impose un format en gardant la surface et le centre du recadrage courant :
 * le cadrage choisi n'est pas perdu quand on change de préréglage.
 * Le rectangle est réduit s'il ne tient pas dans la photo, puis recalé dans ses bords.
 */
export function fitRatio(r: NormRect, ratio: number): NormRect {
  const h0 = Math.sqrt((r.w * r.h) / ratio);
  const k = Math.min(1, 1 / (h0 * ratio), 1 / h0);
  const h = h0 * k;
  const w = h * ratio;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
}
