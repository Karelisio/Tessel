import { useEffect, useRef, useState } from 'react';
import { TRANSPARENT } from '@/content/grid';
import type { Engine } from '@/engine/Engine';
import type { Game } from '@/engine/Game';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { usePlayStore } from '@/store/play';
import { themeColor } from '@/theme/applyTheme';

/** Plus grand côté de la minicarte (px CSS). */
const SIDE = 104;
/** La minicarte apparaît au-delà de ce zoom (× vue d'ensemble). */
const SHOW_ZOOM = 1.7;
const PAPER = [250, 247, 243] as const;

interface Arrow {
  x: number;
  y: number;
  angle: number;
  count: number;
}

/** Zone visible en cases (sous la barre du haut, au-dessus de la palette). */
function visibleCells(engine: Engine): [number, number, number, number] {
  const cam = engine.camera;
  const vp = cam.viewport;
  const [x0, y0] = cam.screenToCell(0, vp.insetTop);
  const [x1, y1] = cam.screenToCell(vp.width, vp.height - vp.insetBottom);
  return [x0, y0, x1, y1];
}

/**
 * Minicarte (œuvre entière, avancement, cadre de la vue) et radar : les cases restantes de la couleur
 * choisie y clignotent, et une flèche au bord de l'écran montre la plus proche quand aucune n'est visible.
 * Tout se dessine hors rendu React (abonnements caméra et partie).
 */
export function Minimap({ engine, game, left }: { engine: Engine; game: Game; left: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const radar = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [arrow, setArrow] = useState<Arrow | null>(null);
  const { width: gw, height: gh } = game.grid;
  const k = SIDE / Math.max(gw, gh);
  const w = Math.max(24, Math.round(gw * k));
  const h = Math.max(24, Math.round(gh * k));

  useEffect(() => {
    const el = root.current;
    const bc = base.current?.getContext('2d');
    const rc = radar.current?.getContext('2d');
    if (!el || !bc || !rc) return;
    const { grid } = game;
    const img = bc.createImageData(gw, gh);
    let shown = false;

    const drawBase = () => {
      const filled = game.progress.filled;
      const d = img.data;
      for (let i = 0; i < grid.cells.length; i++) {
        const c = grid.cells[i] ?? TRANSPARENT;
        const o = i * 4;
        if (c === TRANSPARENT) {
          d[o + 3] = 0;
          continue;
        }
        const [r, g, b] = grid.palette[c] ?? [0, 0, 0];
        const m = filled.get(i) ? 1 : 0.26;
        d[o] = PAPER[0] + (r - PAPER[0]) * m;
        d[o + 1] = PAPER[1] + (g - PAPER[1]) * m;
        d[o + 2] = PAPER[2] + (b - PAPER[2]) * m;
        d[o + 3] = 255;
      }
      bc.putImageData(img, 0, 0);
    };

    /** Cases restantes de la couleur choisie ; renvoie la flèche vers la plus proche hors de la vue. */
    const drawRadar = () => {
      const selected = usePlayStore.getState().snapshot?.selected ?? -1;
      const filled = game.progress.filled;
      const scale = 2;
      rc.clearRect(0, 0, w * scale, h * scale);
      rc.fillStyle = themeColor('--primary') || '#c0577a';
      const [x0, y0, x1, y1] = visibleCells(engine);
      const [cx, cy] = engine.camera.viewCenterCell();
      let visible = 0;
      let count = 0;
      let best = Infinity;
      let bx = 0;
      let by = 0;
      const dot = Math.max(1.6, k * scale * 0.7);
      for (let i = 0; i < grid.cells.length; i++) {
        if (grid.cells[i] !== selected || filled.get(i)) continue;
        const x = i % gw;
        const y = (i - x) / gw;
        count++;
        rc.fillRect((x + 0.5) * k * scale - dot / 2, (y + 0.5) * k * scale - dot / 2, dot, dot);
        if (x + 1 > x0 && x < x1 && y + 1 > y0 && y < y1) visible++;
        else {
          const dd = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
          if (dd < best) {
            best = dd;
            bx = x + 0.5;
            by = y + 0.5;
          }
        }
      }
      if (!shown || visible > 0 || count === 0) return null;
      // flèche posée sur le bord de la zone visible, dans la direction de la case
      const vp = engine.camera.viewport;
      const [sx, sy] = engine.camera.cellToScreen(bx, by);
      const [ox, oy] = engine.camera.viewCenter();
      const angle = Math.atan2(sy - oy, sx - ox);
      const hw = vp.width / 2 - 34;
      const hh = (vp.height - vp.insetTop - vp.insetBottom) / 2 - 34;
      const s = Math.min(
        hw / Math.max(1e-6, Math.abs(Math.cos(angle))),
        hh / Math.max(1e-6, Math.abs(Math.sin(angle))),
      );
      return { x: ox + Math.cos(angle) * s, y: oy + Math.sin(angle) * s, angle, count };
    };

    const placeFrame = () => {
      const f = frame.current;
      if (!f) return;
      const [x0, y0, x1, y1] = visibleCells(engine);
      const l = Math.max(0, x0) * k;
      const tp = Math.max(0, y0) * k;
      const r = Math.min(gw, x1) * k;
      const b = Math.min(gh, y1) * k;
      f.style.transform = `translate(${l.toFixed(1)}px, ${tp.toFixed(1)}px)`;
      f.style.width = `${Math.max(4, r - l).toFixed(1)}px`;
      f.style.height = `${Math.max(4, b - tp).toFixed(1)}px`;
    };

    let radarTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRadar = (delay: number) => {
      if (radarTimer) return;
      radarTimer = setTimeout(() => {
        radarTimer = null;
        setArrow(drawRadar());
      }, delay);
    };

    const onCamera = () => {
      const cam = engine.camera;
      const next = cam.scale > cam.fitScale * SHOW_ZOOM;
      if (next !== shown) {
        shown = next;
        el.dataset.shown = String(next);
      }
      if (shown) placeFrame();
      scheduleRadar(140);
    };

    let baseTimer: ReturnType<typeof setTimeout> | null = null;
    const offPlay = usePlayStore.subscribe((s, p) => {
      if (s.snapshot === p.snapshot) return;
      scheduleRadar(60);
      baseTimer ??= setTimeout(() => {
        baseTimer = null;
        drawBase();
      }, 250);
    });
    const offCamera = engine.onCamera(onCamera);
    drawBase();
    onCamera();
    return () => {
      offPlay();
      offCamera();
      if (radarTimer) clearTimeout(radarTimer);
      if (baseTimer) clearTimeout(baseTimer);
    };
  }, [engine, game, gw, gh, k, w, h]);

  /** Glisser sur la minicarte déplace la vue. */
  const drag = (e: React.PointerEvent<HTMLDivElement>, phase: 'down' | 'move' | 'up') => {
    const cam = engine.camera;
    if (phase === 'up') {
      cam.endInteraction();
      engine.invalidate();
      return;
    }
    if (phase === 'move' && !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    if (phase === 'down') {
      e.currentTarget.setPointerCapture(e.pointerId);
      cam.beginInteraction();
    }
    const r = e.currentTarget.getBoundingClientRect();
    cam.centerOn(((e.clientX - r.left) / r.width) * gw, ((e.clientY - r.top) / r.height) * gh);
    engine.invalidate();
  };

  return (
    <>
      <div
        ref={root}
        className="minimap"
        data-shown="false"
        data-left={left}
        style={{ width: w, height: h }}
        role="img"
        aria-label={tr(t('Minicarte de l’œuvre', 'Artwork minimap'))}
        onPointerDown={(e) => {
          drag(e, 'down');
        }}
        onPointerMove={(e) => {
          drag(e, 'move');
        }}
        onPointerUp={(e) => {
          drag(e, 'up');
        }}
        onPointerCancel={(e) => {
          drag(e, 'up');
        }}
      >
        <canvas ref={base} width={gw} height={gh} className="minimap__base" />
        <canvas ref={radar} width={w * 2} height={h * 2} className="minimap__radar" />
        <div ref={frame} className="minimap__frame" />
      </div>
      {arrow && (
        <div
          className="radar-arrow"
          style={{ transform: `translate(${arrow.x.toFixed(1)}px, ${arrow.y.toFixed(1)}px)` }}
          aria-hidden
        >
          <span style={{ transform: `rotate(${arrow.angle.toFixed(3)}rad)` }} className="radar-arrow__icon">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M5 4l15 8-15 8 4-8z" fill="currentColor" />
            </svg>
          </span>
          <small>{arrow.count}</small>
        </div>
      )}
    </>
  );
}
