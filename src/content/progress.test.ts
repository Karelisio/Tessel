import { describe, expect, it } from 'vitest';
import { TRANSPARENT, createGrid } from './grid';
import { Bitset, PlaceResult, Progress } from './progress';

const grid = createGrid(
  3,
  2,
  [
    [255, 0, 0],
    [0, 0, 255],
  ],
  new Uint8Array([0, 0, 1, TRANSPARENT, 1, 0]),
);

describe('Progress', () => {
  it('compte les cases par couleur en ignorant les transparentes', () => {
    const p = new Progress(grid);
    expect([...p.remaining]).toEqual([3, 2]);
    expect(p.left).toBe(5);
    expect(p.total).toBe(5);
  });

  it('pose, refuse les erreurs et annule', () => {
    const p = new Progress(grid);
    expect(p.place(0, 1)).toBe(PlaceResult.WrongColor);
    expect(p.place(3, 0)).toBe(PlaceResult.Transparent);
    expect(p.place(0, 0)).toBe(PlaceResult.Placed);
    expect(p.place(0, 0)).toBe(PlaceResult.AlreadyFilled);
    expect(p.remaining[0]).toBe(2);
    expect(p.unplace(0)).toBe(true);
    expect(p.unplace(0)).toBe(false);
    expect(p.remaining[0]).toBe(3);
  });

  it('se reconstruit depuis un bitset et détecte la fin', () => {
    const bits = new Bitset(6);
    for (const i of [0, 1, 2, 4]) bits.set(i);
    const p = new Progress(grid, bits);
    expect(p.left).toBe(1);
    expect(p.place(5, 0)).toBe(PlaceResult.Placed);
    expect(p.complete).toBe(true);
  });
});
