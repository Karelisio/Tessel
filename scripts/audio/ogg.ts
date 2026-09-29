/**
 * Conteneur Ogg pour des paquets Opus (RFC 7845) : en-têtes OpusHead / OpusTags, pages avec CRC,
 * positions de granule en échantillons à 48 kHz.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    t[i] = r >>> 0;
  }
  return t;
})();

export function oggCrc(data: Uint8Array): number {
  let crc = 0;
  for (const b of data) crc = ((crc << 8) ^ (CRC_TABLE[((crc >>> 24) ^ b) & 0xff] ?? 0)) >>> 0;
  return crc >>> 0;
}

function page(
  packets: Uint8Array[],
  granule: bigint,
  serial: number,
  seq: number,
  flags: number,
): Uint8Array {
  const lacing: number[] = [];
  for (const p of packets) {
    let n = p.length;
    while (n >= 255) {
      lacing.push(255);
      n -= 255;
    }
    lacing.push(n);
  }
  const body = packets.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(27 + lacing.length + body);
  const v = new DataView(out.buffer);
  out.set([0x4f, 0x67, 0x67, 0x53], 0); // "OggS"
  out[4] = 0;
  out[5] = flags;
  v.setBigInt64(6, granule, true);
  v.setUint32(14, serial, true);
  v.setUint32(18, seq, true);
  v.setUint32(22, 0, true);
  out[26] = lacing.length;
  out.set(lacing, 27);
  let o = 27 + lacing.length;
  for (const p of packets) {
    out.set(p, o);
    o += p.length;
  }
  v.setUint32(22, oggCrc(out), true);
  return out;
}

function opusHead(channels: number, preSkip: number, sampleRate: number): Uint8Array {
  const h = new Uint8Array(19);
  const v = new DataView(h.buffer);
  h.set(new TextEncoder().encode('OpusHead'), 0);
  h[8] = 1;
  h[9] = channels;
  v.setUint16(10, preSkip, true);
  v.setUint32(12, sampleRate, true);
  v.setInt16(16, 0, true);
  h[18] = 0;
  return h;
}

function opusTags(vendor: string, comments: string[]): Uint8Array {
  const enc = new TextEncoder();
  const vend = enc.encode(vendor);
  const cs = comments.map((c) => enc.encode(c));
  const size = 8 + 4 + vend.length + 4 + cs.reduce((s, c) => s + 4 + c.length, 0);
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  out.set(enc.encode('OpusTags'), 0);
  v.setUint32(8, vend.length, true);
  out.set(vend, 12);
  let o = 12 + vend.length;
  v.setUint32(o, cs.length, true);
  o += 4;
  for (const c of cs) {
    v.setUint32(o, c.length, true);
    out.set(c, o + 4);
    o += 4 + c.length;
  }
  return out;
}

export interface OpusStream {
  channels: number;
  /** Échantillons (48 kHz) à ignorer au début (latence de l'encodeur). */
  preSkip: number;
  /** Paquets Opus et nombre d'échantillons (48 kHz) de chacun. */
  packets: { data: Uint8Array; samples: number }[];
  /** Longueur réelle du son (48 kHz), pour couper le bourrage final. */
  totalSamples: number;
  comments?: string[];
}

/** Assemble un fichier .ogg (Opus) complet. */
export function muxOggOpus(s: OpusStream): Uint8Array {
  const serial = 0x7e55e1;
  const pages: Uint8Array[] = [];
  let seq = 0;
  pages.push(page([opusHead(s.channels, s.preSkip, 48000)], 0n, serial, seq++, 0x02));
  pages.push(page([opusTags('Tessel', s.comments ?? [])], 0n, serial, seq++, 0));
  const end = BigInt(s.preSkip + s.totalSamples);
  let granule = 0n;
  let batch: Uint8Array[] = [];
  let segments = 0;
  const flush = (last: boolean) => {
    if (batch.length === 0) return;
    const g = last ? end : granule;
    pages.push(page(batch, g, serial, seq++, last ? 0x04 : 0));
    batch = [];
    segments = 0;
  };
  s.packets.forEach((p, i) => {
    const segs = Math.floor(p.data.length / 255) + 1;
    if (segments + segs > 255 || batch.length >= 50) flush(false);
    batch.push(p.data);
    segments += segs;
    granule += BigInt(p.samples);
    if (i === s.packets.length - 1) flush(true);
  });
  const total = pages.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of pages) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
