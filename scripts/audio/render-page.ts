/** Chargé dans Chromium par prerender.ts : compose, rend, normalise et encode chaque son. */
import { AMBIENCES, renderAmbience } from './ambiences';
import { renderLoop, TRACKS } from './compose';
import { encodeOggOpus } from './encode';
import { integratedLoudness, normalize, samplePeak } from './loudness';

export interface Rendered {
  id: string;
  title: { fr: string; en: string };
  kind: 'music' | 'ambience';
  seconds: number;
  samples: number;
  lufs: number;
  peak: number;
  /** Début réel de la boucle dans le son décodé par Chromium (échantillons, 0 si pre-skip appliqué). */
  offset: number;
  /** Écart entre la boucle décodée et l'original (dB, plus c'est bas mieux c'est). */
  errorDb: number;
  /** Musique : écart entre les fins des deux périodes rendues (dB), la garantie de la jonction. */
  periodicityDb?: number;
  base64: string;
}

/**
 * Décalage du son décodé par rapport à l'original (écart minimal sur une fenêtre au milieu), et erreur
 * résiduelle une fois aligné. L'écart et non la corrélation : une frappe plus forte un peu plus loin
 * attirerait la corrélation à côté.
 */
function alignment(decoded: AudioBuffer, original: AudioBuffer): { offset: number; errorDb: number } {
  const mono = (b: AudioBuffer) => {
    const l = b.getChannelData(0);
    const r = b.numberOfChannels > 1 ? b.getChannelData(1) : l;
    const m = new Float32Array(b.length);
    for (let i = 0; i < b.length; i++) m[i] = ((l[i] ?? 0) + (r[i] ?? 0)) / 2;
    return m;
  };
  const a = mono(original);
  const d = mono(decoded);
  const from = Math.min(96000, Math.floor(a.length / 3));
  const win = 8192;
  let best = 0;
  let bestErr = Infinity;
  for (let off = 0; off <= 30000 && from + off + win <= d.length; off++) {
    let s = 0;
    for (let i = 0; i < win && s < bestErr; i++) s += ((a[from + i] ?? 0) - (d[from + off + i] ?? 0)) ** 2;
    if (s < bestErr) {
      bestErr = s;
      best = off;
    }
  }
  // erreur sur toute la boucle, en particulier ses deux bords (la jonction)
  let err = 0;
  let ref = 0;
  for (let i = 0; i < a.length; i++) {
    const e = (a[i] ?? 0) - (d[best + i] ?? 0);
    err += e * e;
    ref += (a[i] ?? 0) ** 2;
  }
  return { offset: best, errorDb: 10 * Math.log10(err / Math.max(1e-12, ref)) };
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function finish(
  id: string,
  title: { fr: string; en: string },
  kind: 'music' | 'ambience',
  buffer: AudioBuffer,
  target: number,
  bitrate: number,
): Promise<Rendered> {
  const ch = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  normalize(ch, 48000, target);
  const lufs = integratedLoudness(ch, 48000);
  const bytes = await encodeOggOpus(buffer, bitrate, [`TITLE=${title.fr}`, 'ARTIST=Tessel', 'LICENSE=CC0'], {
    loop: true,
  });
  // contrôle : le fichier se relit, assez long, et colle à l'original une fois aligné. Opus garde le
  // timbre d'un bruit (pluie, feuillage) mais pas sa forme d'onde : pour les ambiances, il suffit que
  // la relecture reste corrélée (une relecture décalée ou illisible donnerait 0 dB ou plus).
  const check = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(bytes.slice().buffer);
  const { offset, errorDb } = alignment(check, buffer);
  if (check.length < offset + buffer.length) throw new Error(`${id} : son relu trop court (${check.length})`);
  if (errorDb > (kind === 'music' ? -12 : -2))
    throw new Error(`${id} : son relu trop différent (${errorDb.toFixed(1)} dB)`);
  return {
    id,
    title,
    kind,
    seconds: buffer.duration,
    samples: buffer.length,
    lufs,
    peak: samplePeak(ch),
    offset,
    errorDb,
    base64: toBase64(bytes),
  };
}

export async function renderOne(id: string): Promise<Rendered> {
  const t = TRACKS.find((x) => x.id === id);
  if (t) {
    const { buffer, periodicityDb } = await renderLoop(t);
    return { ...(await finish(t.id, t.title, 'music', buffer, -16, 64000)), periodicityDb };
  }
  const a = AMBIENCES.find((x) => x.id === id);
  if (a) return finish(a.id, a.title, 'ambience', await renderAmbience(a), -22, 48000);
  throw new Error(`Son inconnu : ${id}`);
}

export const ALL_IDS = [...TRACKS.map((t) => t.id), ...AMBIENCES.map((a) => a.id)];
