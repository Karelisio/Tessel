import { useEffect, useRef } from 'react';
import './library.css';
import { useProjectPreview } from '@/app/queries';
import { TRANSPARENT } from '@/content/grid';
import { useSettings } from '@/store/settings';

/** Case restante quand l'œuvre est voilée : un gris neutre, sans rien dévoiler. */
const HIDDEN: readonly [number, number, number] = [222, 220, 216];

/**
 * Miniature d'une partie : cases posées en couleur, cases restantes en gris neutre (l'œuvre se
 * dévoile au fil des poses), ou en version pâle de leur couleur avec « Dévoiler les œuvres ».
 */
export function ProjectThumb({ id, size = 96 }: { id: string; size?: number }) {
  const preview = useProjectPreview(id);
  const reveal = useSettings((s) => s.revealArt);
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
      if (filled.get(i)) img.data.set([r, gg, b, 255], i * 4);
      else if (!reveal) img.data.set([...HIDDEN, 255], i * 4);
      // case restante dévoilée : couleur très éclaircie, comme sur la grille de jeu vue de loin
      else img.data.set([r + (255 - r) * 0.78, gg + (255 - gg) * 0.78, b + (255 - b) * 0.78, 255], i * 4);
    }
    ctx.putImageData(img, Math.floor((side - g.width) / 2), Math.floor((side - g.height) / 2));
  }, [preview, reveal]);
  return <canvas ref={canvas} className="thumb" style={{ width: size, height: size }} aria-hidden />;
}
