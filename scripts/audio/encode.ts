/** Encodage Opus dans le navigateur (WebCodecs) puis mise en conteneur Ogg. */
import { muxOggOpus } from './ogg';

/** Voisinage ajouté autour d'une boucle (échantillons) : 0,5 s de chaque côté. */
export const LOOP_CONTEXT = 24000;

/**
 * Encode un son 48 kHz en Ogg Opus. Pour une boucle, l'encodeur reçoit aussi la fin avant le début
 * et le début après la fin ; ce voisinage est retiré au décodage (pre-skip et granule finale) : les
 * deux bords sont codés avec leur vrai entourage et la jonction reste propre.
 */
export async function encodeOggOpus(
  buffer: AudioBuffer,
  bitrate: number,
  comments: string[] = [],
  opts: { loop?: boolean } = {},
): Promise<Uint8Array> {
  if (buffer.sampleRate !== 48000) throw new Error('48 kHz attendu');
  const channels = buffer.numberOfChannels;
  const context = opts.loop ? Math.min(LOOP_CONTEXT, buffer.length) : 0;
  const source = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  const packets: { data: Uint8Array; samples: number }[] = [];
  let preSkip = 312;
  const status: { failure: Error | null } = { failure: null };
  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      const samples = Math.round(((chunk.duration ?? 20000) * 48000) / 1e6);
      packets.push({ data, samples });
      const desc = meta?.decoderConfig?.description;
      if (desc && desc.byteLength >= 12) {
        const bytes = ArrayBuffer.isView(desc)
          ? new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength)
          : new Uint8Array(desc);
        preSkip = (bytes[10] ?? 0) | ((bytes[11] ?? 0) << 8);
      }
    },
    error: (e) => {
      status.failure = e;
    },
  });
  encoder.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: channels, bitrate });
  const length = buffer.length;
  const frames = length + 2 * context;
  const CHUNK = 48000;
  for (let start = 0; start < frames; start += CHUNK) {
    const n = Math.min(CHUNK, frames - start);
    const planar = new Float32Array(n * channels);
    for (let c = 0; c < channels; c++) {
      const src = source[c] ?? new Float32Array(length);
      // index dans la boucle (avec le voisinage enroulé de part et d'autre)
      for (let i = 0; i < n; i++) planar[c * n + i] = src[(start + i - context + length) % length] ?? 0;
    }
    const data = new AudioData({
      format: 'f32-planar',
      sampleRate: 48000,
      numberOfFrames: n,
      numberOfChannels: channels,
      timestamp: Math.round((start / 48000) * 1e6),
      data: planar,
    });
    encoder.encode(data);
    data.close();
  }
  await encoder.flush();
  encoder.close();
  if (status.failure) throw status.failure;
  return muxOggOpus({ channels, preSkip: preSkip + context, packets, totalSamples: length, comments });
}
