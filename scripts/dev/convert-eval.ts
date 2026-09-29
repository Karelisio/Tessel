import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { TRANSPARENT, type Grid } from '../../src/content/grid';
import { convertPixels, DEFAULT_PARAMS, type ConvertParams } from '../../src/convert/pipeline';
import { gridSizeFor } from '../../src/convert/resample';

/**
 * Planche d'évaluation de la conversion : pour chaque image, l'original puis plusieurs réglages.
 * Usage : tsx scripts/dev/convert-eval.ts <dossier d'images> <sortie.png> [colonnes JSON]
 */
const [dir = '.', out = 'eval.png', configsArg] = process.argv.slice(2);
const TILE = 300;

interface Column {
  label: string;
  long: number;
  params: Partial<ConvertParams>;
}

const columns: Column[] = configsArg
  ? (JSON.parse(configsArg) as Column[])
  : [
      { label: '60 · 12 c.', long: 60, params: { colors: 12 } },
      { label: '100 · 24 c.', long: 100, params: { colors: 24 } },
      { label: '150 · 36 c.', long: 150, params: { colors: 36 } },
      { label: '100 · 24 c. tramé', long: 100, params: { colors: 24, dither: true } },
      { label: '80 · 16 c. sans fond', long: 80, params: { colors: 16, removeBackground: true } },
    ];

function renderGrid(g: Grid, target: PNG, ox: number, oy: number): void {
  const s = Math.min(TILE / g.width, TILE / g.height);
  const offX = ox + Math.floor((TILE - g.width * s) / 2);
  const offY = oy + Math.floor((TILE - g.height * s) / 2);
  for (let y = 0; y < g.height * s; y++)
    for (let x = 0; x < g.width * s; x++) {
      const c = g.cells[Math.floor(y / s) * g.width + Math.floor(x / s)] ?? TRANSPARENT;
      const checker = (Math.floor(x / 6) + Math.floor(y / 6)) % 2 ? 235 : 250;
      const [r, gg, b] = c === TRANSPARENT ? [checker, checker, checker] : (g.palette[c] ?? [255, 0, 255]);
      const o = ((offY + y) * target.width + offX + x) * 4;
      target.data[o] = r;
      target.data[o + 1] = gg;
      target.data[o + 2] = b;
      target.data[o + 3] = 255;
    }
}

function renderImage(px: Uint8Array, w: number, h: number, target: PNG, ox: number, oy: number): void {
  const s = Math.min(TILE / w, TILE / h);
  const tw = Math.floor(w * s);
  const th = Math.floor(h * s);
  const offX = ox + Math.floor((TILE - tw) / 2);
  const offY = oy + Math.floor((TILE - th) / 2);
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      const i = (Math.floor(y / s) * w + Math.floor(x / s)) * 4;
      const o = ((offY + y) * target.width + offX + x) * 4;
      target.data.set([px[i] ?? 0, px[i + 1] ?? 0, px[i + 2] ?? 0, 255], o);
    }
}

const files = readdirSync(dir)
  .filter((f) => /\.jpe?g$/i.test(f))
  .sort();
const sheet = new PNG({ width: TILE * (columns.length + 1), height: TILE * files.length });
sheet.data.fill(255);
files.forEach((f, row) => {
  const img = jpeg.decode(readFileSync(join(dir, f)), { useTArray: true });
  renderImage(img.data, img.width, img.height, sheet, 0, row * TILE);
  const aspect = img.width / img.height;
  const stats: string[] = [];
  columns.forEach((col, c) => {
    const size = gridSizeFor(aspect, col.long);
    const params: ConvertParams = { ...DEFAULT_PARAMS, ...size, ...col.params };
    const { grid, stats: st } = convertPixels(img.data, img.width, img.height, params);
    renderGrid(grid, sheet, (c + 1) * TILE, row * TILE);
    stats.push(
      `${col.label}: ${st.colors} c., ${Math.round(st.ms)} ms${st.backgroundFound ? ', fond retiré' : ''}`,
    );
  });
  console.log(`${basename(f)} → ${stats.join(' | ')}`);
});
writeFileSync(out, PNG.sync.write(sheet));
console.log(`colonnes : original | ${columns.map((c) => c.label).join(' | ')}`);
