import type { Engine } from '@/engine/Engine';
import type { ManualClock } from '@/engine/Clock';
import { CellState } from '@/engine/GridRenderer';

/**
 * Scénarios de démonstration joués image par image avec une horloge manuelle (60 i/s) :
 * la vidéo est fluide quelle que soit la vitesse de la machine qui la produit.
 */
export interface CaptureApi {
  frames: number;
  frame(i: number): void;
}

type Action = (e: Engine) => void;

function screenOf(e: Engine, i: number): [number, number] {
  const w = e.game?.grid.width ?? 1;
  return e.camera.cellToScreen((i % w) + 0.5, Math.floor(i / w) + 0.5);
}

/** Cases de la couleur donnée dans un rectangle, non posées, ordonnées ligne par ligne. */
function cellsOf(e: Engine, color: number, x0: number, y0: number, x1: number, y1: number): number[] {
  const g = e.game;
  if (!g) return [];
  const out: number[] = [];
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = y * g.grid.width + x;
      if (g.grid.cells[i] === color && !g.progress.filled.get(i)) out.push(i);
    }
  return out;
}

/** Remplit instantanément (hors caméra) toutes les cases d'une couleur sauf `keep`. */
function prefill(e: Engine, color: number, keep: number[]): void {
  const g = e.game;
  const r = e.renderer;
  if (!g || !r) return;
  const keepSet = new Set(keep);
  for (let i = 0; i < g.grid.cells.length; i++) {
    if (g.grid.cells[i] !== color || keepSet.has(i)) continue;
    if (g.progress.place(i, color) === 0) r.setCell(i, CellState.Filled);
  }
  g.onChange();
}

/** Rectangle de cases visible à l'écran (hors barres d'interface). */
function visibleRect(e: Engine): [number, number, number, number] {
  const vp = e.camera.viewport;
  const [x0, y0] = e.camera.screenToCell(0, vp.insetTop + 10);
  const [x1, y1] = e.camera.screenToCell(vp.width, vp.height - vp.insetBottom - 10);
  return [Math.ceil(x0), Math.ceil(y0), Math.floor(x1), Math.floor(y1)];
}

function build(e: Engine): Map<number, Action[]> {
  const t = new Map<number, Action[]>();
  const at = (f: number, a: Action) => {
    t.set(f, [...(t.get(f) ?? []), a]);
  };
  const g = e.game;
  if (!g) return t;

  // 1. Vue d'ensemble puis vol vers les nuages
  at(0, (en) => {
    en.camera.fit();
  });
  at(20, (en) => {
    en.camera.flyTo(68, 31, 30);
  });

  // 2. Taps successifs sur la couleur des nuages clairs
  const cloud = 2;
  at(70, () => {
    g.selectColor(cloud);
  });
  let taps: number[] = [];
  at(71, (en) => {
    const [x0, y0, x1, y1] = visibleRect(en);
    const vis = cellsOf(en, cloud, x0, y0, x1, y1);
    taps = [0.2, 0.4, 0.6, 0.8].map((q) => vis[Math.floor(vis.length * q)] ?? -1).filter((i) => i >= 0);
  });
  [90, 104, 118, 132].forEach((f, k) => {
    at(f, (en) => {
      const i = taps[k];
      if (i === undefined) return;
      const [sx, sy] = screenOf(en, i);
      g.onTap(sx, sy);
    });
  });

  // 3. Erreur : tremblement sans punition
  at(150, (en) => {
    const [x0, y0, x1, y1] = visibleRect(en);
    const vis = cellsOf(en, 3, x0, y0, x1, y1).concat(cellsOf(en, 1, x0, y0, x1, y1));
    const wrong = vis[Math.floor(vis.length / 2)];
    if (wrong === undefined) return;
    const [sx, sy] = screenOf(en, wrong);
    g.onTap(sx, sy);
  });

  // 4. Glissé sur une rangée : traînée lumineuse + mélodie montante
  let row: number[] = [];
  at(175, (en) => {
    const [x0, y0, x1, y1] = visibleRect(en);
    const all = cellsOf(en, cloud, x0, y0, x1, y1);
    // la plus longue suite horizontale contiguë
    let best: number[] = [];
    let cur: number[] = [];
    for (const i of all) {
      const prev = cur[cur.length - 1];
      if (prev !== undefined && i === prev + 1) cur.push(i);
      else cur = [i];
      if (cur.length > best.length) best = [...cur];
    }
    row = best;
    const first = row[0];
    if (first === undefined) return;
    const [sx, sy] = screenOf(en, first);
    g.onPaintStart(sx, sy);
  });
  for (let k = 1; k <= 40; k++) {
    at(175 + k, (en) => {
      const first = row[0];
      const last = row[row.length - 1];
      if (first === undefined || last === undefined) return;
      const [x0, y0] = screenOf(en, first);
      const [x1] = screenOf(en, last);
      const p = k / 40;
      g.onPaintMove(x0 + (x1 - x0) * p, y0 + Math.sin(p * Math.PI) * 4);
    });
  }
  at(216, () => {
    g.onPaintEnd();
  });

  // 5. Couleur terminée : les collines (on pré-remplit tout sauf 3 cases visibles)
  const hills = 11;
  let lastCells: number[] = [];
  at(250, (en) => {
    const cells = cellsOf(en, hills, 0, 0, 150, 150);
    const mid = cells[Math.floor(cells.length / 4)] ?? 0;
    const w = en.game?.grid.width ?? 1;
    en.camera.flyTo(mid % w, Math.floor(mid / w), 20);
  });
  at(300, (en) => {
    g.selectColor(hills);
    const cells = cellsOf(en, hills, 0, 0, 150, 150);
    const k = Math.floor(cells.length / 4);
    lastCells = cells.slice(k, k + 3);
    prefill(en, hills, lastCells);
  });
  [325, 338, 351].forEach((f, k) => {
    at(f, (en) => {
      const i = lastCells[k];
      if (i === undefined) return;
      const [sx, sy] = screenOf(en, i);
      g.onTap(sx, sy);
    });
  });

  // 6. Dézoom doux
  at(470, (en) => {
    en.camera.flyTo(75, 75, en.camera.fitScale);
  });
  return t;
}

export function installCapture(engine: Engine, clock: ManualClock): CaptureApi {
  let timeline: Map<number, Action[]> | null = null;
  return {
    frames: 560,
    frame(i: number) {
      timeline ??= build(engine);
      for (const a of timeline.get(i) ?? []) a(engine);
      clock.advance(1000 / 60);
      engine.invalidate();
      engine.step();
    },
  };
}
