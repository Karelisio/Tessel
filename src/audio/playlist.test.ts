import { describe, expect, it } from 'vitest';
import { lapEnd, nextQueue } from './playlist';

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe('file de lecture', () => {
  it('ordre du catalogue : repart après la piste en cours', () => {
    expect(nextQueue(['a', 'b', 'c'], 'b', false)).toEqual(['c', 'a', 'b']);
    expect(nextQueue(['a', 'b', 'c'], 'c', false)).toEqual(['a', 'b', 'c']);
    expect(nextQueue(['a', 'b', 'c'], null, false)).toEqual(['a', 'b', 'c']);
    // piste en cours décochée : on reprend au début de la sélection
    expect(nextQueue(['a', 'c'], 'b', false)).toEqual(['a', 'c']);
  });

  it('aléatoire : toutes les pistes, jamais la même deux fois de suite', () => {
    for (let k = 0; k < 50; k++) {
      const q = nextQueue(['a', 'b', 'c', 'd'], 'a', true, seq([k / 50, 0.3, 0.9, 0.1]));
      expect([...q].sort()).toEqual(['a', 'b', 'c', 'd']);
      expect(q[0]).not.toBe('a');
    }
  });

  it('une seule piste ou aucune', () => {
    expect(nextQueue(['a'], 'a', true)).toEqual(['a']);
    expect(nextQueue([], null, true)).toEqual([]);
  });
});

describe('relais en fin de tour', () => {
  it('jamais avant la fin du premier tour', () => {
    expect(lapEnd(10, 120, 11, 9)).toBe(130);
  });

  it('fin de tour assez lointaine pour le fondu, sinon la suivante', () => {
    expect(lapEnd(0, 120, 100, 9)).toBe(120);
    expect(lapEnd(0, 120, 115, 9)).toBe(240);
    expect(lapEnd(0, 120, 239, 9)).toBe(360);
  });
});
