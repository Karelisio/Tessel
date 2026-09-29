import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_IDS, getCategory, isCategoryId } from './categories';

describe('catégories', () => {
  it('identifiants uniques, alignés sur le type', () => {
    expect(new Set(CATEGORY_IDS).size).toBe(CATEGORIES.length);
    expect(CATEGORIES).toHaveLength(16);
    for (const id of CATEGORY_IDS) expect(getCategory(id).id).toBe(id);
    expect(isCategoryId('fleurs')).toBe(true);
    expect(isCategoryId('licornes')).toBe(false);
  });
});
