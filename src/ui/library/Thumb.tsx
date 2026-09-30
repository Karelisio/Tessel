import { useEffect, useRef } from 'react';
import './library.css';
import { useCompletedArtworks } from '@/app/queries';
import { TRANSPARENT, type Grid } from '@/content/grid';
import { loadGrid } from '@/content/library';
import { useSettings } from '@/store/settings';
import { drawVeil } from './veil';

interface ThumbProps {
  /** Œuvre de la bibliothèque (grille facile), ou `load` pour une grille calculée (œuvre du jour). */
  id: string;
  load?: () => Promise<Grid>;
  size?: number;
}

/**
 * Vignette d'une œuvre : sa grille dessinée case par case, chargée quand elle devient visible.
 * Tant qu'elle n'a jamais été terminée, elle reste floutée (sauf réglage « Dévoiler les œuvres »).
 */
export function Thumb({ id, load, size = 96 }: ThumbProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reveal = useSettings((s) => s.revealArt);
  const completed = useCompletedArtworks();
  const veiled = !reveal && !completed?.has(id);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let alive = true;
    const draw = () => {
      void (load ? load() : loadGrid(id, 'easy')).then((g) => {
        if (!alive) return;
        if (veiled) {
          drawVeil(el, g);
          return;
        }
        // format carré : les œuvres en paysage ou en portrait sont centrées
        const side = Math.max(g.width, g.height);
        el.width = side;
        el.height = side;
        const ctx = el.getContext('2d');
        if (!ctx) return;
        const img = ctx.createImageData(g.width, g.height);
        for (let i = 0; i < g.cells.length; i++) {
          const c = g.cells[i] ?? TRANSPARENT;
          if (c === TRANSPARENT) continue;
          const [r, gg, b] = g.palette[c] ?? [0, 0, 0];
          img.data.set([r, gg, b, 255], i * 4);
        }
        ctx.putImageData(img, Math.floor((side - g.width) / 2), Math.floor((side - g.height) / 2));
      });
    };
    const io = new IntersectionObserver((list) => {
      if (list.some((e) => e.isIntersecting)) {
        io.disconnect();
        draw();
      }
    });
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [id, load, veiled]);
  return (
    <canvas
      ref={canvas}
      className="thumb"
      data-veiled={veiled || undefined}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
