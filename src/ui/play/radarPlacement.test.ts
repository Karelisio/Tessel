import { describe, expect, it } from 'vitest';
import { ARROW_EXTENT, placeArrow, type Box } from './radarPlacement';

// téléphone 412 × 892 : barre du haut et palette exclues, flèche à 34 px des bords
const AREA: Box = { left: 34, top: 134, right: 378, bottom: 708 };
const ORIGIN: [number, number] = [206, 421];
const DOCK: Box = { left: 350, top: 586, right: 400, bottom: 760 };
const MAP: Box = { left: 293, top: 72, right: 400, bottom: 179 };

const hits = ([x, y]: [number, number], o: Box) =>
  x + ARROW_EXTENT.right > o.left &&
  x - ARROW_EXTENT.left < o.right &&
  y + ARROW_EXTENT.bottom > o.top &&
  y - ARROW_EXTENT.top < o.bottom;

const onBorder = ([x, y]: [number, number]) =>
  Math.abs(x - AREA.left) < 1e-6 ||
  Math.abs(x - AREA.right) < 1e-6 ||
  Math.abs(y - AREA.top) < 1e-6 ||
  Math.abs(y - AREA.bottom) < 1e-6;

describe('placement de la flèche du radar', () => {
  it('sans obstacle : sur le bord, dans la direction visée', () => {
    expect(placeArrow(AREA, ORIGIN, 0, [])).toEqual([378, 421]);
    const [x, y] = placeArrow(AREA, ORIGIN, -Math.PI / 2, []);
    expect(x).toBeCloseTo(206);
    expect(y).toBeCloseTo(134);
  });

  it('perles en bas à droite : la flèche sort de sous les outils, au plus près', () => {
    const angle = Math.atan2(AREA.bottom - ORIGIN[1], AREA.right - ORIGIN[0]);
    const p = placeArrow(AREA, ORIGIN, angle, [DOCK, MAP]);
    expect(onBorder(p)).toBe(true);
    expect(hits(p, DOCK)).toBe(false);
    expect(hits(p, MAP)).toBe(false);
    // glisse le long du bas (le plus court), reste dans le coin
    expect(p[1]).toBeCloseTo(AREA.bottom);
    expect(p[0]).toBeGreaterThan(300);
  });

  it('perles en haut à droite : la flèche passe sous la minicarte', () => {
    const angle = Math.atan2(AREA.top - ORIGIN[1], AREA.right - ORIGIN[0]);
    const p = placeArrow(AREA, ORIGIN, angle, [DOCK, MAP]);
    expect(onBorder(p)).toBe(true);
    expect(hits(p, MAP)).toBe(false);
    expect(hits(p, DOCK)).toBe(false);
  });

  it('perles à droite, à hauteur des outils : au-dessus ou au-dessous du dock', () => {
    const angle = Math.atan2(660 - ORIGIN[1], AREA.right - ORIGIN[0]);
    const p = placeArrow(AREA, ORIGIN, angle, [DOCK]);
    expect(hits(p, DOCK)).toBe(false);
    expect(onBorder(p)).toBe(true);
  });

  it('pourtour entièrement masqué : point visé inchangé', () => {
    const wall: Box = { left: -1000, top: -1000, right: 2000, bottom: 2000 };
    expect(placeArrow(AREA, ORIGIN, 0, [wall])).toEqual([378, 421]);
  });
});
