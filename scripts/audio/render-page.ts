/** Chargé dans Chromium par prerender.ts : compose, rend, normalise et encode chaque son. */
import { AMBIENCES, renderAmbience } from './ambiences';
import { renderTrack, TRACKS } from './compose';
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
  base64: string;
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
  const bytes = await encodeOggOpus(buffer, bitrate, [`TITLE=${title.fr}`, 'ARTIST=Tessel', 'LICENSE=CC0']);
  // contrôle : le fichier se relit et a la bonne durée
  const check = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(bytes.slice().buffer);
  if (Math.abs(check.duration - buffer.duration) > 0.1)
    throw new Error(`${id} : durée relue ${check.duration}`);
  return {
    id,
    title,
    kind,
    seconds: buffer.duration,
    samples: buffer.length,
    lufs,
    peak: samplePeak(ch),
    base64: toBase64(bytes),
  };
}

export async function renderOne(id: string): Promise<Rendered> {
  const t = TRACKS.find((x) => x.id === id);
  if (t) return finish(t.id, t.title, 'music', await renderTrack(t), -16, 64000);
  const a = AMBIENCES.find((x) => x.id === id);
  if (a) return finish(a.id, a.title, 'ambience', await renderAmbience(a), -22, 48000);
  throw new Error(`Son inconnu : ${id}`);
}

export const ALL_IDS = [...TRACKS.map((t) => t.id), ...AMBIENCES.map((a) => a.id)];
