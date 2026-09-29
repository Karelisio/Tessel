/**
 * Aperçu d'illustrations SVG converties en grilles : original, facile (48), moyen (96), difficile (144).
 * npx tsx --tsconfig tsconfig.app.json scripts/art/preview-svg.ts sortie.png fichier1.svg fichier2.svg…
 * Affiche aussi les couleurs déclarées et celles qui disparaissent à chaque taille (détails trop fins).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { countByColor } from '../../src/content/grid';
import { svgToGrid } from './convert-art';
import { Sheet } from './sheet';
import { SvgRasterizer, svgColors } from './svg';

const [out = 'preview.png', ...files] = process.argv.slice(2);
if (files.length === 0) throw new Error('Aucun SVG donné');
const raster = await SvgRasterizer.open();
const sheet = new Sheet(4, files.length, 220);
for (const [row, file] of files.entries()) {
  const svg = readFileSync(file, 'utf8');
  const colors = svgColors(svg);
  const r = await raster.render(svg);
  sheet.image(0, row, r);
  const report: string[] = [];
  for (const [col, diff] of (['easy', 'medium', 'hard'] as const).entries()) {
    const g = svgToGrid(r, diff, colors);
    sheet.grid(col + 1, row, g);
    const used = [...countByColor(g)].filter((n) => n > 0).length;
    report.push(`${diff} ${g.width}×${g.height} ${used} c.`);
  }
  console.log(`${basename(file)} : ${colors.length} couleurs déclarées · ${report.join(' · ')}`);
}
writeFileSync(out, sheet.encode());
await raster.close();
console.log(`→ ${out}`);
