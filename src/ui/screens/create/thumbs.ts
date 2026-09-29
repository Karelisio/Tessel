import { getServices } from '@/app/services';
import type { CreationMeta } from '@/create/CreationStore';
import { docRgba, type Pixels } from './render';

const cache = new Map<string, Pixels>();

/** Pixels d'une création pour sa vignette (mis en cache tant qu'elle n'est pas modifiée). */
export async function creationPixels(meta: CreationMeta): Promise<Pixels | null> {
  const key = `${meta.id}:${String(meta.updatedAt)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { creations } = await getServices();
  const c = await creations.get(meta.id);
  if (!c) return null;
  const pixels = { w: c.doc.width, h: c.doc.height, rgba: docRgba(c.doc) };
  cache.set(key, pixels);
  return pixels;
}
