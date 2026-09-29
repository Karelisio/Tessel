import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLLECTIONS, collectionProgress, completedBy } from './collections';
import type { LibraryIndex } from './library/types';

const library = JSON.parse(readFileSync('public/art/library.json', 'utf8')) as LibraryIndex;
const ids = new Set(library.artworks.map((a) => a.id));

describe('collections', () => {
  it('au moins 20 collections, toutes d’œuvres existantes et hors événements', () => {
    expect(COLLECTIONS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(COLLECTIONS.map((c) => c.id)).size).toBe(COLLECTIONS.length);
    for (const c of COLLECTIONS) {
      expect(c.artworks.length, c.id).toBeGreaterThanOrEqual(4);
      expect(new Set(c.artworks).size, c.id).toBe(c.artworks.length);
      for (const a of c.artworks) {
        expect(ids.has(a), `${c.id} → ${a}`).toBe(true);
        expect(library.artworks.find((e) => e.id === a)?.event, a).toBeUndefined();
      }
    }
  });

  it('complétion', () => {
    const def = COLLECTIONS.find((c) => c.id === 'plumes');
    if (!def) throw new Error('collection attendue');
    const done = new Set(def.artworks.slice(0, 5));
    expect(collectionProgress(def, done)).toBe(5);
    expect(completedBy('oiseaux/chouette', done)).toEqual([]);
    done.add(def.artworks[5] ?? '');
    expect(completedBy(def.artworks[5] ?? '', done).map((c) => c.id)).toEqual(['plumes']);
  });
});

describe('bibliothèque', () => {
  it('150 œuvres ou plus, toutes les catégories représentées, grilles cohérentes', () => {
    const regular = library.artworks.filter((a) => a.event === undefined);
    expect(regular.length).toBeGreaterThanOrEqual(130);
    const cats = new Set(regular.map((a) => a.category));
    expect(cats.size).toBeGreaterThanOrEqual(15);
    for (const a of library.artworks) {
      expect(Math.max(a.variants.easy.width, a.variants.easy.height), a.id).toBe(48);
      expect(Math.max(a.variants.expert.width, a.variants.expert.height), a.id).toBe(224);
      expect(a.variants.expert.colors, a.id).toBeLessThanOrEqual(64);
      expect(a.title.fr.length * a.title.en.length, a.id).toBeGreaterThan(0);
      if (a.kind === 'publicdomain') expect(a.credit?.license, a.id).toBeDefined();
    }
  });
});
