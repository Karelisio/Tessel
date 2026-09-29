/**
 * Génère les icônes et écrans de démarrage Android à partir des SVG de scripts/icon/icon.ts
 * (rastérisation dans Chromium). Usage : npx tsx --tsconfig tsconfig.app.json scripts/icon/build-icons.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { CHROME } from '../dev/browser';
import { ICONS } from './icon';

const RES = 'android/app/src/main/res';
const DENSITIES: [string, number][] = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

for (const [name, content] of Object.entries(ICONS)) writeFileSync(`assets/icon/${name}.svg`, content);

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();

/** Rastérise des calques SVG superposés dans un canvas w × h (contenu en `fit` px, centré, décalé de dy). */
async function raster(
  layers: string[],
  w: number,
  h: number,
  opts: { fit?: number; dy?: number; bg?: string; round?: boolean; radius?: number } = {},
): Promise<Buffer> {
  const data = await page.evaluate(
    async ({ layers, w, h, opts }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      if (!g) throw new Error('canvas');
      if (opts.round || opts.radius) {
        g.beginPath();
        if (opts.round) g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
        else g.roundRect(0, 0, w, h, opts.radius ?? 0);
        g.clip();
      }
      if (opts.bg) {
        g.fillStyle = opts.bg;
        g.fillRect(0, 0, w, h);
      }
      const fit = opts.fit ?? Math.min(w, h);
      for (const svg of layers) {
        const img = new Image();
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        await img.decode();
        g.drawImage(img, (w - fit) / 2, (h - fit) / 2 + (opts.dy ?? 0), fit, fit);
      }
      return c.toDataURL('image/png');
    },
    { layers, w, h, opts },
  );
  return Buffer.from(data.split(',')[1] ?? '', 'base64');
}

const write = (path: string, png: Buffer) => {
  mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  writeFileSync(path, png);
};

for (const [d, k] of DENSITIES) {
  const legacy = Math.round(48 * k);
  const adaptive = Math.round(108 * k);
  // icônes classiques : l'icône adaptative complète, recadrée comme le ferait le lanceur
  const full = [ICONS.background, ICONS.foreground];
  write(
    `${RES}/mipmap-${d}/ic_launcher.png`,
    await raster(full, legacy, legacy, { fit: legacy * 1.5, radius: legacy * 0.18 }),
  );
  write(
    `${RES}/mipmap-${d}/ic_launcher_round.png`,
    await raster(full, legacy, legacy, { fit: legacy * 1.5, round: true }),
  );
  write(
    `${RES}/mipmap-${d}/ic_launcher_foreground.png`,
    await raster([ICONS.foreground], adaptive, adaptive),
  );
  write(
    `${RES}/mipmap-${d}/ic_launcher_background.png`,
    await raster([ICONS.background], adaptive, adaptive),
  );
  write(
    `${RES}/mipmap-${d}/ic_launcher_monochrome.png`,
    await raster([ICONS.monochrome], adaptive, adaptive),
  );
  write(
    `${RES}/drawable-${d}/ic_stat_tessel.png`,
    await raster([ICONS.notification], Math.round(24 * k), Math.round(24 * k)),
  );
  // écrans de démarrage (Android < 12) : cœur au centre, clair et sombre
  for (const [orient, w, h] of [
    ['port', 320, 480],
    ['land', 480, 320],
  ] as const) {
    const W = Math.round(w * k);
    const H = Math.round(h * k);
    const fit = Math.min(W, H) * 0.62;
    write(
      `${RES}/drawable-${orient}-${d}/splash.png`,
      await raster([ICONS.foreground], W, H, { fit, bg: '#FBF7F4' }),
    );
    write(
      `${RES}/drawable-${orient}-night-${d}/splash.png`,
      await raster([ICONS.foreground], W, H, { fit, bg: '#141217' }),
    );
  }
}
write(`${RES}/drawable/splash.png`, await raster([ICONS.foreground], 480, 320, { fit: 200, bg: '#FBF7F4' }));
write(
  `${RES}/drawable-night/splash.png`,
  await raster([ICONS.foreground], 480, 320, { fit: 200, bg: '#141217' }),
);
// icône du site / README
write('public/icon-512.png', await raster([ICONS.full], 512, 512, { radius: 112 }));
write('assets/icon/icon-512.png', await raster([ICONS.full], 512, 512, { radius: 112 }));
await browser.close();
console.log('Icônes générées');
