import { useEffect, useRef } from 'react';
import './library.css';
import { useProjectPreview } from '@/app/queries';
import { TRANSPARENT } from '@/content/grid';

/**
 * Miniature d'une partie : cases posées en couleur, cases restantes en version pâle
 * (on voit l'avancement d'un coup d'œil).
 */
export function ProjectThumb({ id, size = 96 }: { id: string; size?: number }) {
  const preview = useProjectPreview(id);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el || !preview) return;
    const { grid: g, filled } = preview;
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
      // case restante : couleur très éclaircie, comme sur la grille de jeu vue de loin
      const k = filled.get(i) ? 0 : 0.78;
      img.data.set([r + (255 - r) * k, gg + (255 - gg) * k, b + (255 - b) * k, 255], i * 4);
    }
    ctx.putImageData(img, Math.floor((side - g.width) / 2), Math.floor((side - g.height) / 2));
  }, [preview]);
  return <canvas ref={canvas} className="thumb" style={{ width: size, height: size }} aria-hidden />;
}
