/**
 * Planche de relecture : la grille moyenne (96) de chaque SVG, 6 par ligne.
 * npx tsx --tsconfig tsconfig.app.json scripts/art/review-svg.ts sortie.png fichiers.svg…
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { svgToGrid } from './convert-art';
import { Sheet } from './sheet';
import { SvgRasterizer, svgColors } from './svg';

const [out = 'review.png', diff = 'medium', ...files] = process.argv.slice(2);
const cols = 6;
const raster = await SvgRasterizer.open();
const sheet = new Sheet(cols, Math.ceil(files.length / cols), 150, 6);
for (const [i, file] of files.entries()) {
  const svg = readFileSync(file, 'utf8');
  const r = await raster.render(svg, 700);
  sheet.grid(i % cols, Math.floor(i / cols), svgToGrid(r, diff as 'medium', svgColors(svg)));
  console.log(`${i + 1}. ${basename(file)}`);
}
writeFileSync(out, sheet.encode());
await raster.close();
