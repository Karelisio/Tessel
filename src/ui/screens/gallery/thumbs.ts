import { useEffect, useState } from 'react';
import { artworkThumb } from '@/render/exports';

/**
 * Chargement progressif des miniatures : le premier rendu d'une œuvre coûte ~0,3 s, on les sert donc
 * à deux au plus, celles qui sont à l'écran d'abord, puis le reste en arrière-plan.
 */

export interface ThumbSpec {
  id: string;
  updatedAt: number;
  frame: string | null;
  size: number;
}

const keyOf = (s: ThumbSpec) => `${s.id}/${String(s.updatedAt)}/${s.frame ?? ''}/${String(s.size)}`;

const done = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

interface Job {
  key: string;
  priority: number;
  start: () => void;
}
const waiting: Job[] = [];
const LIMIT = 2;
let active = 0;

function pump(): void {
  while (active < LIMIT && waiting.length > 0) {
    // tri stable : à priorité égale, premier arrivé, premier servi
    waiting.sort((a, b) => a.priority - b.priority);
    const job = waiting.shift();
    if (!job) break;
    active++;
    job.start();
  }
}

/** Demande une miniature (priorité 0 : à l'écran, 1 : préchargement). */
export function requestThumb(spec: ThumbSpec, priority = 0): Promise<string> {
  const key = keyOf(spec);
  const hit = done.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  const flying = inflight.get(key);
  if (flying) {
    const queued = waiting.find((j) => j.key === key);
    if (queued && priority < queued.priority) queued.priority = priority;
    return flying;
  }
  const promise = new Promise<string>((resolve, reject) => {
    waiting.push({
      key,
      priority,
      start: () => {
        artworkThumb(spec.id, { size: spec.size, frame: spec.frame }).then(
          (url) => {
            done.set(key, url);
            inflight.delete(key);
            active--;
            resolve(url);
            pump();
          },
          (e: unknown) => {
            inflight.delete(key);
            active--;
            reject(e instanceof Error ? e : new Error(String(e)));
            pump();
          },
        );
      },
    });
  });
  inflight.set(key, promise);
  pump();
  return promise;
}

/** Précharge en arrière-plan (les échecs sont ignorés : la carte réessaiera en s'affichant). */
export function prefetchThumbs(specs: readonly ThumbSpec[]): void {
  for (const s of specs) requestThumb(s, 1).catch(() => undefined);
}

export interface ThumbState {
  url: string | null;
  failed: boolean;
}

/**
 * Miniature d'une partie. `wanted` : demandée seulement quand la carte est (presque) visible.
 * Quand le cadre ou la partie change, l'ancienne image reste affichée jusqu'à l'arrivée de la nouvelle.
 */
export function useThumb(spec: ThumbSpec, wanted: boolean): ThumbState {
  const { id, updatedAt, frame, size } = spec;
  const key = keyOf({ id, updatedAt, frame, size });
  const cached = done.get(key) ?? null;
  const [got, setGot] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!wanted || done.has(key)) return;
    let alive = true;
    requestThumb({ id, updatedAt, frame, size }, 0).then(
      (url) => {
        if (alive) setGot(url);
      },
      () => {
        if (alive) setFailedKey(key);
      },
    );
    return () => {
      alive = false;
    };
  }, [wanted, key, id, updatedAt, frame, size]);
  return { url: cached ?? got, failed: cached === null && failedKey === key };
}

/** Vrai dès que l'élément approche de l'écran (ne repasse jamais à faux). À brancher en `ref={setElement}`. */
export function useSeen(rootMargin = '320px'): [(el: Element | null) => void, boolean] {
  const [element, setElement] = useState<Element | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!element || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setSeen(true);
      },
      { rootMargin },
    );
    io.observe(element);
    return () => {
      io.disconnect();
    };
  }, [element, seen, rootMargin]);
  return [setElement, seen];
}
