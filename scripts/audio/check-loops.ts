/**
 * Contrôle des boucles audio telles que le jeu les jouera : chaque fichier de public/audio est décodé
 * par Chromium et raccordé comme dans le jeu (stitchLoop), la boucle [offset, offset + samples) est
 * refermée sur elle-même, et sa jonction est comparée aux autres « coutures » du même son, naturelles :
 *  - musique : les changements de mesure (une attaque d'accord au temps fort n'est pas un défaut) ;
 *  - ambiances : 64 points répartis dans la boucle.
 * Trois mesures à chaque coupure : le plus grand saut d'un échantillon au suivant (±8 échantillons,
 * un clic), l'écart de niveau entre les 300 ms d'avant et d'après, et le niveau le plus faible des
 * deux (un creux de silence, la coupure). La jonction passe si elle ne dépasse pas les coutures
 * naturelles du son.
 * Usage : serveur de dev lancé, puis `npx tsx scripts/audio/check-loops.ts`
 */
import { readFileSync } from 'node:fs';
import { openPage } from '../dev/browser';

interface Entry {
  id: string;
  file: string;
  samples: number;
  offset?: number;
  wrap?: boolean;
}

interface Report {
  seamClick: number;
  seamJump: number;
  seamLevel: number;
  maxClick: number;
  minJump: number;
  maxJump: number;
  minLevel: number;
  level: number;
}

const manifest = JSON.parse(readFileSync('public/audio/tracks.json', 'utf8')) as {
  music: Entry[];
  ambience: Entry[];
};
const { browser, page } = await openPage('http://localhost:5173/scripts/audio/render.html', {
  width: 400,
  height: 400,
});

/** Exécuté dans Chromium (texte : tsx n'y injecte rien). */
const ANALYZE = `async ({ id, file, samples, offset, wrap }) => {
  const data = await fetch('/audio/' + file).then((x) => x.arrayBuffer());
  const b = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(data);
  // comme le jeu : la jonction est raccordée à la suite décodée de la fin
  const { stitchLoop } = await import('/src/audio/loopStitch.ts');
  if (wrap) stitchLoop(b, offset, samples);
  const l = b.getChannelData(0);
  const rr = b.numberOfChannels > 1 ? b.getChannelData(1) : l;
  const at = (i) => {
    const k = offset + (((i % samples) + samples) % samples);
    return ((l[k] ?? 0) + (rr[k] ?? 0)) / 2;
  };
  const click = (p) => {
    let m = 0;
    for (let i = -8; i <= 8; i++) m = Math.max(m, Math.abs(at(p + i) - at(p + i - 1)));
    return m;
  };
  const w = 14400;
  const rms = (from) => {
    let s = 0;
    for (let i = from; i < from + w; i++) s += at(i) ** 2;
    return Math.sqrt(s / w);
  };
  const db = (x) => 20 * Math.log10(Math.max(1e-9, x));
  const jump = (p) => db(rms(p)) - db(rms(p - w));
  // niveau le plus faible de part et d'autre : un creux de silence trahit une coupure
  const low = (p) => Math.min(db(rms(p)), db(rms(p - w)));
  // coutures naturelles : lignes de mesure (musique) ou points réguliers (ambiances)
  let cuts = [];
  const music = id.startsWith('music:');
  if (music) {
    const { TRACKS } = await import('/scripts/audio/compose.ts');
    const def = TRACKS.find((t) => t.id === id);
    const bar = samples / def.bars;
    for (let k = 1; k < def.bars; k++) cuts.push(Math.round(k * bar));
  } else for (let k = 1; k < 64; k++) cuts.push(Math.round((k * samples) / 64));
  const clicks = cuts.map(click);
  const jumps = cuts.map(jump);
  const lows = cuts.map(low);
  let level = 0;
  for (let i = 0; i < samples; i += 64) level += at(i) ** 2;
  return {
    seamClick: click(0),
    seamJump: jump(0),
    seamLevel: low(0),
    maxClick: Math.max(...clicks),
    minJump: Math.min(...jumps),
    maxJump: Math.max(...jumps),
    minLevel: Math.min(...lows),
    level: db(Math.sqrt(level / (samples / 64))),
  };
}`;

let failed = 0;
for (const e of [...manifest.music, ...manifest.ambience]) {
  const r = await page.evaluate<Report>(
    `(${ANALYZE})(${JSON.stringify({ id: e.id, file: e.file, samples: e.samples, offset: e.offset ?? 0, wrap: e.wrap === true })})`,
  );
  const clickOk = r.seamClick <= r.maxClick * 1.05;
  const jumpOk = r.seamJump >= r.minJump - 1 && r.seamJump <= r.maxJump + 1;
  const levelOk = r.seamLevel >= r.minLevel - 3;
  const ok = clickOk && jumpOk && levelOk && r.level > -50;
  if (!ok) failed++;
  console.log(
    `${ok ? 'ok  ' : 'NON '} ${e.id.padEnd(16)} clic ${r.seamClick.toFixed(4)} (coutures ≤ ${r.maxClick.toFixed(4)})  ` +
      `écart ${r.seamJump.toFixed(1)} dB (coutures ${r.minJump.toFixed(1)} à ${r.maxJump.toFixed(1)} dB)  ` +
      `creux ${r.seamLevel.toFixed(1)} dB (coutures ≥ ${r.minLevel.toFixed(1)} dB)`,
  );
}
await browser.close();
if (failed > 0) {
  console.log(`${String(failed)} boucle(s) à reprendre`);
  process.exitCode = 1;
}
