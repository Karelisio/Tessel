import { describe, expect, it } from 'vitest';
import { CATALOG, unlockKind } from '@/meta/catalog';
import { FRAMES, frameSpec } from './frames';

describe('cadres', () => {
  it('chaque cadre du catalogue a un rendu', () => {
    const keys = CATALOG.map((i) => i.key).filter((k) => unlockKind(k) === 'frame');
    expect(keys.length).toBeGreaterThan(30);
    for (const k of keys) expect(FRAMES[k], k).toBeDefined();
  });

  it('retombe sur le cadre du mode', () => {
    expect(frameSpec(null, 1)).toBe(FRAMES['frame:or']);
    expect(frameSpec('frame:inconnu', 2)).toBe(FRAMES['frame:chene']);
  });
});
