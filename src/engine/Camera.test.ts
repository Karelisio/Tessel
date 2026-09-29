import { describe, expect, it } from 'vitest';
import { Camera } from './Camera';

function makeCamera(): Camera {
  const cam = new Camera();
  cam.setGrid(150, 150);
  cam.setViewport({ width: 400, height: 800, insetTop: 50, insetBottom: 150 });
  return cam;
}

function run(cam: Camera, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) cam.update(1 / 60);
}

describe('Camera', () => {
  it('ajuste la grille à la zone visible et la centre', () => {
    const cam = makeCamera();
    expect(cam.scale).toBeCloseTo((400 * 0.94) / 150);
    const [cx, cy] = cam.viewCenterCell();
    expect(cx).toBeCloseTo(75);
    expect(cy).toBeCloseTo(75);
  });

  it('garde le point focal fixe pendant le zoom', () => {
    const cam = makeCamera();
    const before = cam.screenToCell(120, 300);
    cam.zoomAt(120, 300, 3);
    const after = cam.screenToCell(120, 300);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });

  it('revient dans les limites après un dézoom excessif', () => {
    const cam = makeCamera();
    cam.beginInteraction();
    cam.zoomAt(200, 400, 0.3);
    expect(cam.scale).toBeLessThan(cam.minScale);
    cam.endInteraction(0, 0, 200, 400);
    run(cam, 2);
    expect(cam.scale).toBeCloseTo(cam.minScale, 3);
    expect(cam.isAnimating).toBe(false);
  });

  it("amortit l'inertie et rebondit sur les bords", () => {
    const cam = makeCamera();
    cam.zoomAt(200, 400, 10);
    cam.beginInteraction();
    cam.endInteraction(8000, 0);
    run(cam, 4);
    expect(cam.isAnimating).toBe(false);
    // le bord gauche de la grille ne dépasse pas la marge autorisée
    expect(cam.tx).toBeLessThanOrEqual(400 * 0.18 + 1);
  });

  it('vole vers une case avec un ressort', () => {
    const cam = makeCamera();
    cam.flyTo(10, 20, 40);
    run(cam, 3);
    expect(cam.scale).toBeCloseTo(40, 2);
    const [cx, cy] = cam.viewCenterCell();
    expect(cx).toBeCloseTo(10, 1);
    expect(cy).toBeCloseTo(20, 1);
  });
});
