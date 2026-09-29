import type { Rgb } from '@/content/grid';

export interface Hsl {
  /** 0–360 */
  h: number;
  /** 0–100 */
  s: number;
  /** 0–100 */
  l: number;
}

export function rgbToHsl([r, g, b]: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = Math.max(0, Math.min(1, s / 100));
  const ln = Math.max(0, Math.min(1, l / 100));
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = ln - c / 2;
  const to = (v: number) => Math.round(Math.max(0, Math.min(1, v + m)) * 255);
  return [to(r1), to(g1), to(b1)];
}

export const css = ([r, g, b]: Rgb): string => `rgb(${String(r)}, ${String(g)}, ${String(b)})`;

/** Couleur d'écriture lisible sur un fond donné. */
export function inkOn([r, g, b]: Rgb): string {
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? 'rgba(40, 30, 40, 0.78)' : 'rgba(255, 255, 255, 0.92)';
}

/** Dégradé CSS (pour les curseurs de teinte, saturation, luminosité). */
export function hueGradient(s: number, l: number): string {
  const stops = [0, 60, 120, 180, 240, 300, 360].map((h) => css(hslToRgb({ h, s, l }))).join(', ');
  return `linear-gradient(90deg, ${stops})`;
}
