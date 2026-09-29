import { describe, expect, it } from 'vitest';
import { CATALOG, unlockKind } from '@/meta/catalog';
import { TEXTURES, textureSpec } from './textures';

describe('matières', () => {
  it('chaque matière du catalogue a un rendu', () => {
    const keys = CATALOG.map((i) => i.key).filter((k) => unlockKind(k) === 'texture');
    expect(keys.length).toBe(TEXTURES.length);
    for (const k of keys)
      expect(
        TEXTURES.some((t) => t.key === k),
        k,
      ).toBe(true);
  });

  it('retombe sur la matière de base du mode', () => {
    expect(textureSpec('diamond', 'texture:pixel-kraft').key).toBe('texture:diamond-rond');
    expect(textureSpec('mosaic', undefined).variant).toBe(0);
  });
});
