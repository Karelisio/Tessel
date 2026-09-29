import { PNG } from 'pngjs';
import { TRANSPARENT, type Grid } from '../../src/content/grid';
import type { Raster } from './svg';

/** Planche contact : une ligne par œuvre, des vignettes carrées de `tile` px. */
export class Sheet {
  readonly png: PNG;
  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly tile = 280,
    readonly gap = 8,
  ) {
    this.png = new PNG({ width: cols * (tile + gap) + gap, height: rows * (tile + gap) + gap });
    this.png.data.fill(255);
  }

  private put(x: number, y: number, rgb: readonly [number, number, number]): void {
    const o = (y * this.png.width + x) * 4;
    this.png.data[o] = rgb[0];
    this.png.data[o + 1] = rgb[1];
    this.png.data[o + 2] = rgb[2];
    this.png.data[o + 3] = 255;
  }

  private origin(col: number, row: number): [number, number] {
    return [this.gap + col * (this.tile + this.gap), this.gap + row * (this.tile + this.gap)];
  }

  grid(col: number, row: number, g: Grid): void {
    const [ox, oy] = this.origin(col, row);
    const s = Math.min(this.tile / g.width, this.tile / g.height);
    const offX = ox + Math.floor((this.tile - g.width * s) / 2);
    const offY = oy + Math.floor((this.tile - g.height * s) / 2);
    for (let y = 0; y < Math.floor(g.height * s); y++)
      for (let x = 0; x < Math.floor(g.width * s); x++) {
        const c = g.cells[Math.floor(y / s) * g.width + Math.floor(x / s)] ?? TRANSPARENT;
        const k = (Math.floor(x / 7) + Math.floor(y / 7)) % 2 ? 228 : 246;
        this.put(offX + x, offY + y, c === TRANSPARENT ? [k, k, k] : (g.palette[c] ?? [255, 0, 255]));
      }
  }

  image(col: number, row: number, r: Raster): void {
    const [ox, oy] = this.origin(col, row);
    const s = Math.min(this.tile / r.width, this.tile / r.height);
    const w = Math.floor(r.width * s);
    const h = Math.floor(r.height * s);
    const offX = ox + Math.floor((this.tile - w) / 2);
    const offY = oy + Math.floor((this.tile - h) / 2);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = (Math.floor(y / s) * r.width + Math.floor(x / s)) * 4;
        const a = (r.pixels[o + 3] ?? 0) / 255;
        const k = (Math.floor(x / 7) + Math.floor(y / 7)) % 2 ? 228 : 246;
        const mix = (v: number) => Math.round(v * a + k * (1 - a));
        this.put(offX + x, offY + y, [
          mix(r.pixels[o] ?? 0),
          mix(r.pixels[o + 1] ?? 0),
          mix(r.pixels[o + 2] ?? 0),
        ]);
      }
  }

  encode(): Buffer {
    return PNG.sync.write(this.png);
  }
}
