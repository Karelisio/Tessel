import { describe, expect, it } from 'vitest';
import { sunsetLake } from '@/content/generators/sunsetLake';
import { Bitset, PlaceResult, Progress } from '@/content/progress';
import { AutoSaver } from './AutoSaver';
import { Op } from './codecs';
import { migrate } from './migrations';
import { ProgressStore, replay } from './ProgressStore';
import { createTestDb } from './testing';

async function setup() {
  const db = await createTestDb();
  await migrate(db);
  let t = 1000;
  let n = 0;
  const store = new ProgressStore(
    db,
    () => t,
    () => `p${++n}`,
  );
  return { db, store, advance: (ms: number) => (t += ms) };
}

describe('ProgressStore', () => {
  it('crée un projet avec une grille figée et le retrouve', async () => {
    const { store } = await setup();
    const grid = sunsetLake(48, 48, 1);
    const meta = await store.create({ artworkId: 'sunset', source: 'library', mode: 'pixel', grid });
    expect(meta.total).toBe(48 * 48);
    expect(await store.findActive('sunset', 'pixel')).toMatchObject({ id: meta.id });
    expect(await store.findActive('sunset', 'diamond')).toBeUndefined();
    const loaded = await store.load(meta.id);
    expect(loaded.grid.cells).toEqual(grid.cells);
    expect(loaded.history).toEqual([]);
  });

  it('rejoue le journal : poses, annulations et ordre pour le timelapse', async () => {
    const { store } = await setup();
    const grid = sunsetLake(48, 48, 1);
    const { id } = await store.create({ artworkId: 'a', source: 'library', mode: 'pixel', grid });
    await store.append(
      id,
      [
        { op: Op.Place, index: 5 },
        { op: Op.Place, index: 6 },
        { op: Op.Place, index: 7 },
      ],
      3,
      1500,
    );
    await store.append(id, [{ op: Op.Unplace, index: 7 }], -1, 0);
    await store.append(id, [{ op: Op.Place, index: 100 }], 1, 200);
    const loaded = await store.load(id);
    expect(loaded.history).toEqual([5, 6, 100]);
    expect(loaded.filled.get(7)).toBe(false);
    expect(loaded.meta.filled).toBe(3);
    expect(loaded.meta.timeMs).toBe(1700);
  });

  it('corrige un compteur de cases incohérent au chargement', async () => {
    const { store, db } = await setup();
    const { id } = await store.create({
      artworkId: 'a',
      source: 'library',
      mode: 'pixel',
      grid: sunsetLake(48, 48, 1),
    });
    await store.append(id, [{ op: Op.Place, index: 1 }], 1, 0);
    await db.run('UPDATE projects SET filled = 42 WHERE id = ?', [id]);
    expect((await store.load(id)).meta.filled).toBe(1);
  });

  it('remet une partie à zéro et marque la fin', async () => {
    const { store } = await setup();
    const { id } = await store.create({
      artworkId: 'a',
      source: 'library',
      mode: 'pixel',
      grid: sunsetLake(48, 48, 1),
    });
    await store.append(id, [{ op: Op.Place, index: 1 }], 1, 0);
    await store.bump(id, 'undos');
    await store.bump(id, 'tools', 2);
    expect((await store.get(id))?.tools).toBe(2);
    await store.complete(id);
    expect(await store.findActive('a', 'pixel')).toBeUndefined();
    expect(await store.completedModes('a')).toEqual(['pixel']);
    await store.reset(id);
    const loaded = await store.load(id);
    expect(loaded.history).toEqual([]);
    expect(loaded.meta.completedAt).toBeNull();
    expect([loaded.meta.undos, loaded.meta.errors, loaded.meta.tools]).toEqual([0, 0, 0]);
    expect(await store.completedModes('a')).toEqual([]);
  });

  it('replay ignore les index hors grille et les doublons', () => {
    const { filled, history } = replay(10, [
      [
        { op: Op.Place, index: 3 },
        { op: Op.Place, index: 3 },
        { op: Op.Place, index: 99 },
        { op: Op.Unplace, index: 4 },
      ],
    ]);
    expect(history).toEqual([3]);
    expect(filled.get(3)).toBe(true);
  });
});

describe('AutoSaver', () => {
  it('écrit par lots de 64 poses et au plus tard après le délai', async () => {
    const { store, db } = await setup();
    const grid = sunsetLake(48, 48, 1);
    const { id } = await store.create({ artworkId: 'a', source: 'library', mode: 'pixel', grid });
    const progress = new Progress(grid);
    const timer: { fire: (() => void) | null } = { fire: null };
    const saver = new AutoSaver(store, id, () => progress.filled, {
      setTimer: (fn) => {
        timer.fire = fn;
        return 1;
      },
      clearTimer: () => {
        timer.fire = null;
      },
    });
    for (let i = 0; i < 64; i++) {
      progress.place(i, grid.cells[i] ?? 0);
      saver.record(Op.Place, i);
    }
    await saver.flush();
    expect(await db.query('SELECT seq FROM journal')).toHaveLength(1);

    progress.place(64, grid.cells[64] ?? 0);
    saver.record(Op.Place, 64);
    expect(timer.fire).not.toBeNull();
    timer.fire?.();
    await saver.flush();
    const rows = await db.query('SELECT seq FROM journal');
    expect(rows).toHaveLength(2);
    expect((await store.load(id)).history).toHaveLength(65);
  });

  it('reconstruit exactement la partie après une série de poses et d’annulations', async () => {
    const { store } = await setup();
    const grid = sunsetLake(64, 64, 1);
    const { id } = await store.create({ artworkId: 'a', source: 'library', mode: 'pixel', grid });
    const progress = new Progress(grid);
    const saver = new AutoSaver(store, id, () => progress.filled, { maxOps: 7 });
    const order: number[] = [];
    for (let i = 0; i < 500; i++) {
      const idx = (i * 37) % grid.cells.length;
      if (progress.place(idx, grid.cells[idx] ?? 0) === PlaceResult.Placed) {
        saver.record(Op.Place, idx);
        order.push(idx);
      }
      if (i % 50 === 49) {
        const last = order.pop();
        if (last !== undefined && progress.unplace(last)) saver.record(Op.Unplace, last);
      }
    }
    await saver.dispose();
    const loaded = await store.load(id);
    expect(loaded.history).toEqual(order);
    expect(loaded.filled.bytes).toEqual(progress.filled.bytes);
    expect(loaded.meta.filled).toBe(progress.total - progress.left);
  });

  it('conserve le lot en cas d’échec d’écriture et le réécrit ensuite', async () => {
    const { store } = await setup();
    const grid = sunsetLake(48, 48, 1);
    const { id } = await store.create({ artworkId: 'a', source: 'library', mode: 'pixel', grid });
    const bits = new Bitset(grid.cells.length);
    let failing = true;
    const flaky = Object.create(store) as ProgressStore;
    flaky.append = (...args) => (failing ? Promise.reject(new Error('disque plein')) : store.append(...args));
    const errors: unknown[] = [];
    const saver = new AutoSaver(flaky, id, () => bits);
    saver.onError = (e) => errors.push(e);
    saver.record(Op.Place, 1);
    await saver.flush();
    expect(errors).toHaveLength(1);
    expect(saver.pending).toBe(1);
    failing = false;
    await saver.flush();
    expect((await store.load(id)).history).toEqual([1]);
  });
});
