import { describe, expect, it } from 'vitest';
import type { AudioEngine } from '@/audio/AudioEngine';
import type { HapticsEngine } from '@/audio/haptics';
import { createGrid, TRANSPARENT } from '@/content/grid';
import { Bitset } from '@/content/progress';
import type { ParticleFx } from '@/fx/Particles';
import { MODES } from '@/modes';
import { Camera } from './Camera';
import type { FeedbackEvent } from './feedback';
import { Game } from './Game';
import type { GridRenderer } from './GridRenderer';

/** Rendu factice : garde l'état affiché de chaque case. */
class FakeRenderer {
  readonly shown: Uint8Array;
  shakes = 0;
  animated = 0;
  constructor(size: number) {
    this.shown = new Uint8Array(size);
  }
  setMode(): void {}
  setSelected(): void {}
  setNumberScale(): void {}
  setFinale(): void {}
  startWave(): void {}
  clearAll(): void {
    this.shown.fill(0);
  }
  setCell(i: number, state: number): void {
    this.shown[i] = state;
  }
  animatePlace(i: number): void {
    this.animated++;
    this.shown[i] = 2;
  }
  animateShake(): void {
    this.shakes++;
  }
  activeAnimations(): number {
    return 0;
  }
}

const noop = () => undefined;
const particles = { n: (k: number) => k, emitWorld: noop, emitScreen: noop } as unknown as ParticleFx;
const audio = { play: noop, unlock: () => Promise.resolve() } as unknown as AudioEngine;
const haptics = { pulse: noop, soft: noop, success: noop } as unknown as HapticsEngine;

/**
 * 8×4 : deux zones de couleur 0 séparées par une colonne de couleur 1,
 * dernière ligne de couleur 2, un coin transparent.
 *   0 0 0 1 0 0 0 0
 *   0 0 0 1 0 0 0 0
 *   0 0 0 1 0 0 0 0
 *   2 2 2 2 2 2 2 T
 */
function setup() {
  const w = 8;
  const h = 4;
  const cells = new Uint8Array(w * h);
  for (let y = 0; y < 3; y++) cells[y * w + 3] = 1;
  for (let x = 0; x < w; x++) cells[3 * w + x] = 2;
  cells[3 * w + 7] = TRANSPARENT;
  const grid = createGrid(
    w,
    h,
    [
      [200, 80, 80],
      [80, 200, 80],
      [80, 80, 200],
    ],
    cells,
  );
  const camera = new Camera();
  camera.setGrid(w, h);
  camera.setViewport({ width: 400, height: 400, insetTop: 0, insetBottom: 0 });
  const renderer = new FakeRenderer(w * h);
  const game = new Game(
    grid,
    MODES.pixel,
    camera,
    renderer as unknown as GridRenderer,
    particles,
    audio,
    haptics,
  );
  const events: FeedbackEvent[] = [];
  game.feedback.on((e) => events.push(e));
  const ops: number[] = [];
  game.onOp = (_op, i) => ops.push(i);
  let time = 0;
  const run = (seconds: number) => {
    for (let k = 0; k < Math.round(seconds * 60); k++) game.tick((time += 1 / 60));
  };
  return { game, grid, camera, renderer, events, ops, run };
}

describe('outils', () => {
  it('pot : remplit la seule zone contiguë touchée, en vague, annulable d’un coup', () => {
    const { game, events, ops, run, renderer } = setup();
    const n = game.fillRegionAt(0);
    expect(n).toBe(9);
    expect(game.revealing).toBe(true);
    run(2);
    expect(game.revealing).toBe(false);
    expect(ops).toHaveLength(9);
    expect(game.placementOrder[0]).toBe(0);
    // l'autre zone de la même couleur n'est pas touchée
    expect(game.progress.filled.get(4)).toBe(false);
    expect(renderer.shown[1]).toBe(2);
    expect(events.some((e) => e.type === 'colorComplete')).toBe(false);
    game.undo();
    expect(game.progress.filled.get(0)).toBe(false);
    expect(game.progress.left).toBe(game.progress.total);
  });

  it('pot armé : un tap à vide laisse l’outil armé, un bon tap remplit et le désarme', () => {
    const { game, camera, run, renderer } = setup();
    const used: [string, number][] = [];
    game.onToolUsed = (tool, cells) => used.push([tool, cells]);
    game.armBucket(true);
    expect(game.canPaintAt(...camera.cellToScreen(0.5, 0.5))).toBe(false);
    game.fillRegionAt(4);
    run(2);
    // zone déjà remplie : refus doux
    expect(game.onTap(...camera.cellToScreen(4.5, 0.5))).toBe(true);
    expect(renderer.shakes).toBe(1);
    expect(game.armedTool).toBe('bucket');
    game.onTap(...camera.cellToScreen(3.5, 1.5));
    expect(game.armedTool).toBeNull();
    expect(used).toEqual([['bucket', 3]]);
    run(2);
    expect(game.progress.remaining[1]).toBe(0);
  });

  it('baguette : termine la couleur et déclenche la couleur terminée', () => {
    const { game, events, run } = setup();
    game.selectColor(2);
    expect(game.useWand()).toBe(7);
    run(2);
    expect(game.progress.remaining[2]).toBe(0);
    expect(events.filter((e) => e.type === 'colorComplete')).toHaveLength(1);
  });

  it('baguette puis fin : l’œuvre terminée lance la cinématique', () => {
    const { game, run, events } = setup();
    for (let c = 0; c < 3; c++) {
      game.selectColor(c);
      game.useWand();
      run(2);
    }
    expect(game.progress.complete).toBe(true);
    expect(events.some((e) => e.type === 'artworkComplete')).toBe(true);
    run(1);
    expect(game.phase).not.toBe('playing');
    expect(game.useWand()).toBe(0);
  });

  it('loupe : vole vers la case restante la plus proche, rien si tout est posé', () => {
    const { game, camera, run } = setup();
    game.selectColor(1);
    game.fillRegionAt(3);
    run(2);
    game.selectColor(1);
    expect(game.useLoupe()).toBe(true);
    run(2);
    const [cx, cy] = camera.viewCenterCell();
    // couleur 1 terminée : la loupe passe à une autre couleur restante
    expect(game.selected).not.toBe(1);
    const i = Math.floor(cy) * 8 + Math.floor(cx);
    expect(game.progress.filled.get(i)).toBe(false);
  });
});

describe('relecture de la création', () => {
  it('rouverte depuis la galerie : la relecture dure, même avant la première frame de la partie', () => {
    const { game, grid } = setup();
    const filled = new Bitset(grid.cells.length);
    const history: number[] = [];
    grid.cells.forEach((c, i) => {
      if (c === TRANSPARENT) return;
      filled.set(i);
      history.push(i);
    });
    game.restore(filled, history);
    expect(game.phase).toBe('finished');
    // partie tout juste chargée : aucune frame reçue, alors que le moteur tourne depuis 2 min
    game.playTimelapse();
    game.tick(120);
    expect(game.phase).toBe('timelapse');
    game.tick(122);
    expect(game.phase).toBe('timelapse');
    game.tick(133);
    expect(game.phase).toBe('finished');
  });
});
