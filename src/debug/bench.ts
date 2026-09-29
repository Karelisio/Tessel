import type { Engine } from '@/engine/Engine';
import type { PerfStats } from '@/engine/PerfMonitor';

export interface BenchResult {
  phase: string;
  stats: PerfStats;
}

function frames(n: number, each: (k: number) => void): Promise<void> {
  return new Promise((resolve) => {
    let k = 0;
    const tick = () => {
      each(k);
      if (++k >= n) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Benchmark scripté (zoom, déplacement, glissé de peinture, repos avec reflets) :
 * mesure les temps de frame et le coût JS par frame via le PerfMonitor du moteur.
 */
export async function runBench(engine: Engine, framesPerPhase = 180): Promise<BenchResult[]> {
  const game = engine.game;
  if (!game) return [];
  const cam = engine.camera;
  const [vw, vh] = [cam.viewport.width, cam.viewport.height];
  const results: BenchResult[] = [];
  const phase = async (name: string, each: (k: number) => void) => {
    await frames(10, () => undefined);
    engine.perf.reset();
    await frames(framesPerPhase, (k) => {
      each(k);
      engine.invalidate(); // chaque frame de mesure doit réellement dessiner
    });
    results.push({ phase: name, stats: engine.perf.stats() });
  };

  cam.fit();
  await phase('zoom', (k) => {
    cam.beginInteraction();
    cam.zoomAt(vw / 2, vh / 2, k % 120 < 60 ? 1.035 : 1 / 1.035);
  });
  cam.endInteraction();
  cam.flyTo(75, 75, 30);
  await frames(90, () => undefined);
  await phase('pan', (k) => {
    cam.beginInteraction();
    cam.panBy(Math.cos(k / 20) * 9, Math.sin(k / 27) * 7);
  });
  cam.endInteraction();

  // glissé : on sélectionne la couleur la plus présente et on peint ses cases en serpentin
  const counts = game.snapshot().remaining;
  const color = counts.indexOf(Math.max(...counts));
  game.selectColor(color);
  const targets: number[] = [];
  for (let i = 0; i < game.grid.cells.length && targets.length < framesPerPhase * 2; i++) {
    if (game.grid.cells[i] === color && !game.progress.filled.get(i)) targets.push(i);
  }
  const w = game.grid.width;
  await phase('paint', (k) => {
    for (let j = 0; j < 2; j++) {
      const i = targets[k * 2 + j];
      if (i === undefined) continue;
      cam.centerOn((i % w) + 0.5, Math.floor(i / w) + 0.5);
      game.placeIndex(i, true);
    }
  });

  await phase('redraw', () => undefined);
  return results;
}
