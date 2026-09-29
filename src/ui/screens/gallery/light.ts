import { Tilt } from '@/engine/Tilt';
import { useNav } from '@/store/nav';

/**
 * Éclairage du mur. Un seul contrôleur pilote, sans passer par React (pas de rendu à chaque image) :
 *  - le halo qui glisse avec le défilement (et l'inclinaison du téléphone) ;
 *  - l'ombre portée de chaque cadre, qui s'allonge à mesure qu'il s'éloigne du halo (`--sx`, `--sy`, `--sb`) ;
 *  - les reflets des œuvres en diamant (`--tx`, `--ty`, entre -1 et 1) selon l'inclinaison.
 */

const frames = new Set<HTMLElement>();
const glints = new Set<HTMLElement>();
let tx = 0;
let ty = 0;
let dirty = true;
let kick: () => void = () => undefined;

/** Repère de la lumière au repos dans `Tilt` (voir engine/Tilt.ts). */
const REST_X = -0.32;
const REST_Y = -0.42;
const RANGE = 0.6;

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/** Cadre dont l'ombre suit la lumière. */
export function trackFrame(el: HTMLElement): () => void {
  frames.add(el);
  dirty = true;
  kick();
  return () => {
    frames.delete(el);
  };
}

/** Reflets à piloter par l'inclinaison. */
export function trackGlint(el: HTMLElement): () => void {
  glints.add(el);
  el.style.setProperty('--tx', tx.toFixed(3));
  el.style.setProperty('--ty', ty.toFixed(3));
  kick();
  return () => {
    glints.delete(el);
  };
}

export interface LightTargets {
  /** Zone visible du mur (défilement). */
  scroller: HTMLElement;
  /** Disque de lumière (déplacé par `transform`). */
  halo: HTMLElement;
  /** Sans capteur : oscillation lente automatique (désactivée si « Réduire les animations »). */
  idle: boolean;
}

export function attachLight({ scroller, halo, idle }: LightTargets): () => void {
  const tilt = new Tilt();
  void tilt.start();
  let raf = 0;
  let last = 0;
  const haloSize = halo.offsetWidth || 520;

  const frame = (now: number) => {
    raf = 0;
    const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
    last = now;
    const hidden = document.hidden || useNav.getState().playing;
    let moved = dirty;
    dirty = false;
    if (!hidden && glints.size > 0 && tilt.update(dt, idle)) {
      tx = clamp((tilt.light[0] - REST_X) / RANGE);
      ty = clamp((tilt.light[1] - REST_Y) / RANGE);
      const sx = tx.toFixed(3);
      const sy = ty.toFixed(3);
      for (const g of glints) {
        g.style.setProperty('--tx', sx);
        g.style.setProperty('--ty', sy);
      }
      moved = true;
    }
    if (moved && !hidden) place();
    if (glints.size > 0) {
      raf = requestAnimationFrame(frame);
    } else last = 0;
  };

  const place = () => {
    const vw = scroller.clientWidth;
    const vh = scroller.clientHeight;
    const s = scroller.scrollTop;
    // le halo dérive lentement au fil du défilement, et se penche avec le téléphone
    const hx = vw * (0.5 + 0.24 * Math.cos(s / 820)) + tx * vw * 0.14;
    const hy = vh * (0.42 + 0.2 * Math.sin(s / 610)) + ty * vh * 0.08;
    halo.style.transform = `translate3d(${(hx - haloSize / 2).toFixed(1)}px, ${(hy - haloSize / 2).toFixed(1)}px, 0)`;
    const box = scroller.getBoundingClientRect();
    const rects: [HTMLElement, DOMRect][] = [];
    for (const el of frames) {
      const r = el.getBoundingClientRect();
      if (r.bottom < box.top - 240 || r.top > box.bottom + 240) continue;
      rects.push([el, r]);
    }
    for (const [el, r] of rects) {
      const dx = r.left + r.width / 2 - box.left - hx;
      const dy = r.top + r.height / 2 - box.top - hy;
      const dist = Math.hypot(dx, dy) || 1;
      const far = Math.min(1, dist / 520);
      const len = 3 + far * 11;
      // l'ombre part à l'opposé de la lumière, avec une pente vers le bas (la lumière vient d'en haut)
      el.style.setProperty('--sx', `${((dx / dist) * len * 0.9).toFixed(2)}px`);
      el.style.setProperty('--sy', `${((dy / dist) * len * 0.6 + 5 + far * 3).toFixed(2)}px`);
      el.style.setProperty('--sb', `${(9 + far * 9).toFixed(1)}px`);
      el.style.setProperty('--sa', (0.34 - far * 0.08).toFixed(2));
    }
  };

  kick = () => {
    if (raf === 0) raf = requestAnimationFrame(frame);
  };
  const onScroll = () => {
    dirty = true;
    kick();
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });
  const resize = new ResizeObserver(onScroll);
  resize.observe(scroller);
  onScroll();

  return () => {
    scroller.removeEventListener('scroll', onScroll);
    resize.disconnect();
    if (raf !== 0) cancelAnimationFrame(raf);
    tilt.stop();
    kick = () => undefined;
  };
}
