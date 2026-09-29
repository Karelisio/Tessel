import type { OpenRequest } from '@/store/nav';

/**
 * Origine d'une transition partagée : la vignette (canvas `.thumb`) contenue dans `el` (ou `el` lui-même).
 * À passer à `useNav().open(ref, { origin: originOf(e.currentTarget) })`.
 */
export function originOf(el: Element | null): OpenRequest['origin'] {
  if (!el) return undefined;
  const thumb = el instanceof HTMLCanvasElement ? el : el.querySelector('canvas.thumb');
  const target = thumb ?? el;
  let image: string | null = null;
  if (thumb instanceof HTMLCanvasElement) {
    try {
      image = thumb.toDataURL();
    } catch {
      image = null;
    }
  }
  return { rect: target.getBoundingClientRect(), image };
}
