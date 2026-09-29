import TinySDF from '@mapbox/tiny-sdf';
import { BufferImageSource } from 'pixi.js';
import { DIGIT_SLOTS } from './shaders/common';

const SLOT = 64;

export const NUMBER_FONT = "'Nunito Variable', Nunito, system-ui, Roboto, sans-serif";

/**
 * Atlas SDF des chiffres 0–9 (une case de 64 px par chiffre), généré au lancement :
 * numéros nets à tous les niveaux de zoom, avec la police de l'interface.
 */
export function createDigitAtlas(fontFamily = NUMBER_FONT): BufferImageSource {
  const sdf = new TinySDF({
    fontSize: 46,
    buffer: 8,
    radius: 10,
    cutoff: 0.25,
    fontFamily,
    fontWeight: '800',
  });
  const width = SLOT * DIGIT_SLOTS;
  const data = new Uint8Array(width * SLOT * 4);
  for (let d = 0; d < DIGIT_SLOTS; d++) {
    const g = sdf.draw(String(d));
    // centre la boîte englobante du glyphe dans sa case
    const ox = Math.round(d * SLOT + (SLOT - g.width) / 2);
    const oy = Math.round((SLOT - g.height) / 2);
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        const tx = ox + x;
        const ty = oy + y;
        if (tx < d * SLOT || tx >= (d + 1) * SLOT || ty < 0 || ty >= SLOT) continue;
        const v = g.data[y * g.width + x] ?? 0;
        const o = (ty * width + tx) * 4;
        data[o] = v;
        data[o + 1] = v;
        data[o + 2] = v;
        data[o + 3] = v;
      }
    }
  }
  return new BufferImageSource({
    resource: data,
    width,
    height: SLOT,
    format: 'rgba8unorm',
    scaleMode: 'linear',
    alphaMode: 'no-premultiply-alpha',
  });
}
