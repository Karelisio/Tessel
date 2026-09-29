import { describe, expect, it } from 'vitest';
import { traverseCells } from './raster';

function collect(x0: number, y0: number, x1: number, y1: number): string[] {
  const out: string[] = [];
  traverseCells(x0, y0, x1, y1, (x, y) => {
    out.push(`${x},${y}`);
  });
  return out;
}

describe('traverseCells', () => {
  it('visite une seule case pour un segment immobile', () => {
    expect(collect(2.5, 3.5, 2.6, 3.2)).toEqual(['2,3']);
  });

  it('parcourt une ligne horizontale sans trou', () => {
    expect(collect(0.5, 0.5, 4.5, 0.5)).toEqual(['0,0', '1,0', '2,0', '3,0', '4,0']);
  });

  it('suit une diagonale en cases 4-connexes, dans les deux sens', () => {
    const fwd = collect(0.2, 0.1, 3.8, 3.9);
    expect(fwd[0]).toBe('0,0');
    expect(fwd[fwd.length - 1]).toBe('3,3');
    expect(fwd.length).toBe(7);
    const back = collect(3.8, 3.9, 0.2, 0.1);
    expect(back[back.length - 1]).toBe('0,0');
  });

  it('peut être interrompu', () => {
    let n = 0;
    traverseCells(0.5, 0.5, 9.5, 0.5, () => ++n < 3);
    expect(n).toBe(3);
  });
});
