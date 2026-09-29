import { chromium, type Browser, type Page } from 'playwright-core';
import { PNG } from 'pngjs';
import type { Rgb } from '../../src/content/grid';
import { CHROME } from '../dev/browser';

export interface Raster {
  pixels: Uint8Array;
  width: number;
  height: number;
}

/** Rendu d'illustrations SVG en pixels via Chromium (antialiasing du navigateur, identique à l'appareil). */
export class SvgRasterizer {
  private constructor(
    private readonly browser: Browser,
    private readonly page: Page,
  ) {}

  static async open(): Promise<SvgRasterizer> {
    const browser = await chromium.launch({ executablePath: CHROME });
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    return new SvgRasterizer(browser, page);
  }

  async render(svg: string, longSide = 960): Promise<Raster> {
    const [vw, vh] = viewBoxSize(svg);
    const scale = longSide / Math.max(vw, vh);
    const width = Math.round(vw * scale);
    const height = Math.round(vh * scale);
    await this.page.setViewportSize({ width, height });
    const sized = svg.replace(/<svg\b/, `<svg width="${width}" height="${height}"`);
    await this.page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`,
    );
    const buf = await this.page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width, height } });
    const png = PNG.sync.read(buf);
    return { pixels: new Uint8Array(png.data), width: png.width, height: png.height };
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}

export function viewBoxSize(svg: string): [number, number] {
  const m = /viewBox\s*=\s*"\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);
  if (!m) throw new Error('SVG sans viewBox');
  return [Number(m[1]), Number(m[2])];
}

/** Couleurs pleines déclarées dans le SVG (fill / stroke / stop-color, #rgb ou #rrggbb). */
export function svgColors(svg: string): Rgb[] {
  const found = new Map<string, Rgb>();
  for (const m of svg.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*"?\s*(#[0-9a-fA-F]{3,6})\b/g)) {
    let hex = (m[1] ?? '').toLowerCase();
    if (hex.length === 4) hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    if (hex.length !== 7) continue;
    const n = Number.parseInt(hex.slice(1), 16);
    found.set(hex, [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  return [...found.values()];
}
