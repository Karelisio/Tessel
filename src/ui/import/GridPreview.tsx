import { useLayoutEffect, useRef } from 'react';
import { TRANSPARENT, type Grid } from '@/content/grid';

/** Taille maximale du canevas (px) : borne la mémoire sur les très grands écrans. */
const MAX_BACKING = 2048;

interface GridPreviewProps {
  grid: Grid;
  /** Espace disponible (px CSS) : la grille y est ajustée sans déformation. */
  maxW: number;
  maxH: number;
}

/**
 * Aperçu de la grille convertie : une case = un bloc net (sans lissage). Les cases transparentes
 * laissent voir le damier clair du fond du canevas.
 */
export function GridPreview({ grid, maxW, maxH }: GridPreviewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scale = Math.min(maxW / grid.width, maxH / grid.height);
  const cssW = Math.max(1, Math.floor(grid.width * scale));
  const cssH = Math.max(1, Math.floor(grid.height * scale));
  const dpr = window.devicePixelRatio || 1;
  const backW = Math.min(MAX_BACKING, Math.max(1, Math.round(cssW * dpr)));
  const backH = Math.min(MAX_BACKING, Math.max(1, Math.round(cssH * dpr)));

  useLayoutEffect(() => {
    const target = canvas.current;
    const ctx = target?.getContext('2d');
    if (!target || !ctx) return;
    // une case = un pixel sur un canevas intermédiaire, agrandi ensuite au plus proche
    const cells = document.createElement('canvas');
    cells.width = grid.width;
    cells.height = grid.height;
    const cellsCtx = cells.getContext('2d');
    if (!cellsCtx) return;
    const image = cellsCtx.createImageData(grid.width, grid.height);
    const px = image.data;
    for (let i = 0; i < grid.cells.length; i++) {
      const index = grid.cells[i] ?? TRANSPARENT;
      const rgb = index === TRANSPARENT ? undefined : grid.palette[index];
      if (!rgb) continue; // alpha 0 : la case reste transparente
      px[i * 4] = rgb[0];
      px[i * 4 + 1] = rgb[1];
      px[i * 4 + 2] = rgb[2];
      px[i * 4 + 3] = 255;
    }
    cellsCtx.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, backW, backH);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cells, 0, 0, backW, backH);
  }, [grid, backW, backH]);

  return (
    <canvas
      ref={canvas}
      className="imp-preview"
      width={backW}
      height={backH}
      style={{ width: cssW, height: cssH }}
      role="img"
      aria-label={`Aperçu de la grille, ${grid.width} sur ${grid.height} cases`}
    />
  );
}
