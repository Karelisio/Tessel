/**
 * Aperçu des générateurs : une ligne par générateur, une colonne par graine.
 * npx tsx --tsconfig tsconfig.app.json scripts/art/preview-gen.ts sortie.png mandala,quilt [taille] [graines]
 */
import { writeFileSync } from 'node:fs';
import { GENERATORS } from '../../src/content/generators';
import { Sheet } from './sheet';

const [out = 'gen.png', ids = 'mandala', sizeArg = '96', countArg = '4'] = process.argv.slice(2);
const list = ids === 'all' ? Object.keys(GENERATORS) : ids.split(',');
const count = Number(countArg);
const size = Number(sizeArg);
const sheet = new Sheet(count, list.length, 200);
for (const [row, id] of list.entries()) {
  const gen = GENERATORS[id];
  if (!gen) throw new Error(`Générateur inconnu : ${id} (${Object.keys(GENERATORS).join(', ')})`);
  let ms = 0;
  let colors = 0;
  for (let i = 0; i < count; i++) {
    const t0 = performance.now();
    const g = gen.render(size, Math.round(size * gen.aspect), i + 1);
    ms = Math.max(ms, performance.now() - t0);
    colors = Math.max(colors, g.palette.length);
    sheet.grid(i, row, g);
  }
  console.log(`${id} : jusqu'à ${colors} couleurs, ${ms.toFixed(0)} ms max`);
}
writeFileSync(out, sheet.encode());
console.log(`→ ${out}`);
