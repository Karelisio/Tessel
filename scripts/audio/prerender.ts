/**
 * Pré-rendu de la musique et des ambiances : Chromium headless (Tone.Offline / OfflineAudioContext),
 * normalisation (-16 LUFS musique, -22 LUFS ambiances), encodage Ogg Opus.
 * Écrit assets/audio/<music|ambience>/*.ogg + tracks.json et les copie dans public/audio/.
 * Usage : serveur de dev lancé, puis `npx tsx --tsconfig tsconfig.app.json scripts/audio/prerender.ts [id…]`
 */
import { cpSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { openPage } from '../dev/browser';

interface Rendered {
  id: string;
  title: { fr: string; en: string };
  kind: 'music' | 'ambience';
  seconds: number;
  samples: number;
  lufs: number;
  peak: number;
  offset: number;
  errorDb: number;
  periodicityDb?: number;
  base64: string;
}

interface Entry {
  id: string;
  file: string;
  title: { fr: string; en: string };
  seconds: number;
  /** Longueur exacte de la boucle (échantillons à 48 kHz). */
  samples: number;
  /** Début de la boucle dans le son décodé (échantillons à 48 kHz, 0 en général). */
  offset: number;
  lufs: number;
}

const only = process.argv.slice(2);
const PAGE = 'http://localhost:5173/scripts/audio/render.html';
const { browser, page } = await openPage(PAGE, { width: 400, height: 400 });
const ids = await page.evaluate<string[]>(`import('/scripts/audio/render-page.ts').then((m) => m.ALL_IDS)`);
const manifestPath = 'assets/audio/tracks.json';
/** Relu avant chaque écriture : plusieurs rendus peuvent tourner en parallèle. */
const readManifest = (): { music: Entry[]; ambience: Entry[] } =>
  existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { music: Entry[]; ambience: Entry[] })
    : { music: [], ambience: [] };

for (const id of ids) {
  if (only.length > 0 && !only.includes(id)) continue;
  const t0 = Date.now();
  let r: Rendered | null = null;
  // le serveur de dev peut recharger la page (dépendances réoptimisées) : on reprend
  for (let attempt = 0; attempt < 4 && !r; attempt++) {
    try {
      r = await page.evaluate<Rendered>(
        `import('/scripts/audio/render-page.ts').then((m) => m.renderOne(${JSON.stringify(id)}))`,
      );
    } catch (e) {
      if (!String(e).includes('context was destroyed') || attempt === 3) throw e;
      await page.waitForTimeout(3000);
      await page.goto(PAGE);
    }
  }
  if (!r) continue;
  const name = id.split(':')[1] ?? id;
  const dir = `assets/audio/${r.kind}`;
  mkdirSync(dir, { recursive: true });
  const file = `${r.kind}/${name}.ogg`;
  const bytes = Buffer.from(r.base64, 'base64');
  writeFileSync(`assets/audio/${file}`, bytes);
  const manifest = readManifest();
  const list = manifest[r.kind].filter((e) => e.id !== id);
  list.push({
    id,
    file,
    title: r.title,
    seconds: Math.round(r.seconds * 100) / 100,
    samples: r.samples,
    offset: r.offset,
    lufs: Math.round(r.lufs * 10) / 10,
  });
  list.sort((a, b) => a.id.localeCompare(b.id, 'fr', { numeric: true }));
  manifest[r.kind] = list;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `${id} : ${(bytes.length / 1024).toFixed(0)} Ko, ${r.seconds.toFixed(1)} s, ${r.lufs.toFixed(1)} LUFS, crête ${r.peak.toFixed(2)}, décalage ${String(r.offset)}, écart ${r.errorDb.toFixed(1)} dB${r.periodicityDb === undefined ? '' : `, périodicité ${r.periodicityDb.toFixed(1)} dB`} (${String(Math.round((Date.now() - t0) / 1000))} s)`,
  );
}
mkdirSync('public/audio', { recursive: true });
cpSync('assets/audio', 'public/audio', { recursive: true, filter: (src) => !src.endsWith('.md') });
await browser.close();
