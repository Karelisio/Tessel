import { describe, expect, it } from 'vitest';
import { TRANSPARENT } from '@/content/grid';
import { createDoc, flatten, fromGrid, parseDoc, serializeDoc, toGrid } from './document';
import { Editor, line } from './Editor';
import { PALETTES, paletteColors } from './palettes';
import { CATALOG, unlockKind } from '@/meta/catalog';

const palette = paletteColors('palette:classique');
const at = (e: Editor, x: number, y: number, layer = e.active) =>
  e.doc.layers[layer]?.cells[y * e.doc.width + x] ?? -1;

describe('éditeur de pixel art', () => {
  it('trace un trait continu, annule et rétablit', () => {
    const e = new Editor(createDoc(16, 16, palette));
    e.setColor(4);
    e.begin(0, 0);
    e.move(5, 0);
    e.end();
    for (let x = 0; x <= 5; x++) expect(at(e, x, 0)).toBe(5);
    expect(at(e, 6, 0)).toBe(0);
    e.undo();
    expect(at(e, 3, 0)).toBe(0);
    e.redo();
    expect(at(e, 3, 0)).toBe(5);
  });

  it('applique la symétrie et la gomme', () => {
    const e = new Editor(createDoc(10, 10, palette));
    e.setSymmetry('xy');
    e.begin(1, 2);
    e.end();
    expect([at(e, 1, 2), at(e, 8, 2), at(e, 1, 7), at(e, 8, 7)]).toEqual([1, 1, 1, 1]);
    e.setTool('eraser');
    e.begin(8, 7);
    e.end();
    expect(at(e, 1, 2)).toBe(0);
  });

  it('remplit une zone fermée sans déborder', () => {
    const e = new Editor(createDoc(8, 8, palette));
    e.setColor(0);
    // cadre 5×5
    e.begin(1, 1);
    e.move(5, 1);
    e.move(5, 5);
    e.move(1, 5);
    e.move(1, 1);
    e.end();
    e.setColor(2);
    e.setTool('bucket');
    e.begin(3, 3);
    expect(at(e, 3, 3)).toBe(3);
    expect(at(e, 0, 0)).toBe(0);
    expect(at(e, 1, 3)).toBe(1);
    e.undo();
    expect(at(e, 3, 3)).toBe(0);
  });

  it('pipette sur l’image aplatie puis retour à l’outil précédent', () => {
    const e = new Editor(createDoc(8, 8, palette));
    e.setColor(6);
    e.begin(2, 2);
    e.end();
    e.setColor(0);
    e.setTool('eyedropper');
    e.begin(2, 2);
    expect(e.color).toBe(6);
    expect(e.tool).toBe('pencil');
  });

  it('gère les calques (ajout, ordre, fusion, annulation)', () => {
    const e = new Editor(createDoc(8, 8, palette));
    e.begin(0, 0);
    e.end();
    expect(e.addLayer('Dessus')).toBe(true);
    expect(e.active).toBe(1);
    e.setColor(3);
    e.begin(0, 0);
    e.end();
    expect(flatten(e.doc)[0]).toBe(4);
    e.toggleVisible(1);
    expect(flatten(e.doc)[0]).toBe(1);
    e.toggleVisible(1);
    e.mergeDown(1);
    expect(e.doc.layers).toHaveLength(1);
    expect(at(e, 0, 0, 0)).toBe(4);
    e.undo();
    expect(e.doc.layers).toHaveLength(2);
    e.undo();
    e.undo();
    expect(e.doc.layers).toHaveLength(1);
  });

  it('change de palette en gardant le dessin', () => {
    const e = new Editor(createDoc(4, 4, palette));
    e.setColor(4);
    e.begin(0, 0);
    e.end();
    e.applyPalette(paletteColors('palette:pastel'));
    expect(e.doc.palette).toHaveLength(16);
    expect(at(e, 0, 0)).toBeGreaterThan(0);
  });

  it('devient une œuvre jouable (palette réduite, fond transparent)', () => {
    const e = new Editor(createDoc(8, 8, palette));
    e.setColor(9);
    e.begin(1, 1);
    e.move(3, 1);
    e.end();
    e.setColor(2);
    e.begin(1, 2);
    e.end();
    const g = toGrid(e.doc);
    expect(g.palette).toEqual([palette[2], palette[9]]);
    expect(g.cells[8 + 1]).toBe(1);
    expect(g.cells[16 + 1]).toBe(0);
    expect(g.cells[0]).toBe(TRANSPARENT);
    const back = fromGrid(g);
    expect(flatten(back)[9]).toBe(2);
    expect(() => toGrid(createDoc(8, 8, palette))).toThrow();
  });

  it('se sérialise sans perte', () => {
    const e = new Editor(createDoc(12, 9, palette));
    e.begin(3, 4);
    e.move(8, 7);
    e.end();
    e.addLayer('B');
    const d = parseDoc(serializeDoc(e.doc));
    expect(d.width).toBe(12);
    expect(d.layers.map((l) => l.name)).toEqual(e.doc.layers.map((l) => l.name));
    expect(Array.from(flatten(d))).toEqual(Array.from(flatten(e.doc)));
  });

  it('trace des lignes de Bresenham', () => {
    expect(line(0, 0, 3, 1)).toHaveLength(4);
    expect(line(2, 2, 2, 2)).toEqual([[2, 2]]);
  });

  it('chaque palette du catalogue a ses couleurs', () => {
    for (const k of CATALOG.map((i) => i.key).filter((k) => unlockKind(k) === 'palette'))
      expect(PALETTES[k], k).toHaveLength(16);
  });
});
