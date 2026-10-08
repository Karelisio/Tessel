/**
 * Contrôle des boucles audio telles que le jeu les jouera : chaque fichier de public/audio est décodé
 * par Chromium, la boucle [offset, offset + samples) est refermée sur elle-même et la jonction est
 * comparée au reste du morceau :
 *  - clic : plus grand saut d'un échantillon au suivant autour de la jonction, rapporté au saut
 *    typique du morceau (centile 99,9) — au-delà de 1, la jonction claque plus fort que la musique ;
 *  - coupure : niveau (RMS) des 300 ms avant et après la jonction — un creux trahit une boucle qui
 *    s'éteint puis repart.
 * Usage : serveur de dev lancé, puis `npx tsx scripts/audio/check-loops.ts`
 */
import { readFileSync } from 'node:fs';
import { openPage } from '../dev/browser';

interface Entry {
  id: string;
  file: string;
  samples: number;
  offset?: number;
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
const ANALYZE = `async ({ file, samples, offset }) => {
  const data = await fetch('/audio/' + file).then((x) => x.arrayBuffer());
  const b = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(data);
  const l = b.getChannelData(0);
  const rr = b.numberOfChannels > 1 ? b.getChannelData(1) : l;
  const at = (i) => {
    const k = offset + (((i % samples) + samples) % samples);
    return ((l[k] ?? 0) + (rr[k] ?? 0)) / 2;
  };
  // saut typique d'un échantillon au suivant, dans la boucle
  const steps = new Float32Array(samples - 1);
  for (let i = 1; i < samples; i++) steps[i - 1] = Math.abs(at(i) - at(i - 1));
  steps.sort();
  const p999 = steps[Math.floor(steps.length * 0.999)] || 1e-9;
  let seam = 0;
  for (let i = -32; i <= 32; i++) seam = Math.max(seam, Math.abs(at(i) - at(i - 1)));
  const rms = (from, n) => {
    let s = 0;
    for (let i = from; i < from + n; i++) s += at(i) ** 2;
    return Math.sqrt(s / n);
  };
  const w = 14400;
  return { click: seam / p999, before: rms(-w, w), after: rms(0, w), length: b.length };
}`;

let failed = 0;
for (const e of [...manifest.music, ...manifest.ambience]) {
  const r = await page.evaluate<{ click: number; before: number; after: number; length: number }>(
    `(${ANALYZE})(${JSON.stringify({ file: e.file, samples: e.samples, offset: e.offset ?? 0 })})`,
  );
  const db = (x: number) => 20 * Math.log10(Math.max(1e-9, x));
  const jump = db(r.after) - db(r.before);
  const ok = r.click <= 1 && Math.abs(jump) <= 3 && db(r.before) > -60;
  if (!ok) failed++;
  console.log(
    `${ok ? 'ok  ' : 'NON '} ${e.id.padEnd(16)} clic ${r.click.toFixed(2)}  avant ${db(r.before).toFixed(1)} dB  après ${db(r.after).toFixed(1)} dB  (écart ${jump.toFixed(1)} dB)`,
  );
}
await browser.close();
if (failed > 0) {
  console.log(`${String(failed)} boucle(s) à reprendre`);
  process.exitCode = 1;
}
