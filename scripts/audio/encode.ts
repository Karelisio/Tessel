/** Encodage Opus dans le navigateur (WebCodecs) puis mise en conteneur Ogg. */
import { muxOggOpus } from './ogg';

export async function encodeOggOpus(
  buffer: AudioBuffer,
  bitrate: number,
  comments: string[] = [],
): Promise<Uint8Array> {
  if (buffer.sampleRate !== 48000) throw new Error('48 kHz attendu');
  const channels = buffer.numberOfChannels;
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
  const frames = buffer.length;
  const CHUNK = 48000;
  for (let start = 0; start < frames; start += CHUNK) {
    const n = Math.min(CHUNK, frames - start);
    const planar = new Float32Array(n * channels);
    for (let c = 0; c < channels; c++) planar.set(buffer.getChannelData(c).subarray(start, start + n), c * n);
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
  return muxOggOpus({ channels, preSkip, packets, totalSamples: frames, comments });
}
