import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { sunsetLake } from '../../src/content/generators/sunsetLake';
import { countByColor } from '../../src/content/grid';

const out = process.argv[2] ?? 'preview.png';
const scale = 4;
const g = sunsetLake();
const png = new PNG({ width: g.width * scale, height: g.height * scale });
for (let y = 0; y < png.height; y++)
  for (let x = 0; x < png.width; x++) {
    const c = g.cells[Math.floor(y / scale) * g.width + Math.floor(x / scale)] ?? 0;
    const [r, gg, b] = g.palette[c] ?? [255, 0, 255];
    const o = (y * png.width + x) * 4;
    png.data[o] = r;
    png.data[o + 1] = gg;
    png.data[o + 2] = b;
    png.data[o + 3] = 255;
  }
writeFileSync(out, PNG.sync.write(png));
console.log([...countByColor(g)].join(' '));
