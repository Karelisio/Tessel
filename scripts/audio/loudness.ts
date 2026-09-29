/**
 * Sonie intégrée selon l'UIT-R BS.1770-4 (LUFS) : pondération K, blocs de 400 ms (recouvrement 75 %),
 * seuil absolu à -70 LUFS puis seuil relatif à -10 LU.
 */

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** Filtres de pondération K pour une fréquence d'échantillonnage donnée (formules de la norme). */
function kWeighting(fs: number): [Biquad, Biquad] {
  // étage 1 : plateau haut (tête)
  const f0 = 1681.974450955533;
  const G = 3.999843853973347;
  const Q = 0.7071752369554196;
  const K = Math.tan((Math.PI * f0) / fs);
  const Vh = 10 ** (G / 20);
  const Vb = Vh ** 0.4996667741545416;
  const a0 = 1 + K / Q + K * K;
  const shelf: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // étage 2 : passe-haut (RLB)
  const f1 = 38.13547087602444;
  const Q1 = 0.5003270373238773;
  const K1 = Math.tan((Math.PI * f1) / fs);
  const a01 = 1 + K1 / Q1 + K1 * K1;
  const hp: Biquad = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (K1 * K1 - 1)) / a01,
    a2: (1 - K1 / Q1 + K1 * K1) / a01,
  };
  return [shelf, hp];
}

function filter(x: Float32Array, f: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i] ?? 0;
    const y0 = f.b0 * x0 + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    y[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return y;
}

/** Sonie intégrée (LUFS) de canaux de même longueur. -Infinity si silence. */
export function integratedLoudness(channels: readonly Float32Array[], fs: number): number {
  const [shelf, hp] = kWeighting(fs);
  const weighted = channels.map((c) => filter(filter(c, shelf), hp));
  const n = weighted[0]?.length ?? 0;
  const block = Math.round(0.4 * fs);
  const step = Math.round(0.1 * fs);
  const powers: number[] = [];
  for (let start = 0; start + block <= n; start += step) {
    let z = 0;
    for (const w of weighted) {
      let s = 0;
      for (let i = start; i < start + block; i++) s += (w[i] ?? 0) ** 2;
      z += s / block;
    }
    powers.push(z);
  }
  const lufs = (p: number) => -0.691 + 10 * Math.log10(p);
  const abs = powers.filter((p) => lufs(p) > -70);
  if (abs.length === 0) return -Infinity;
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const relGate = lufs(mean(abs)) - 10;
  const gated = abs.filter((p) => lufs(p) > relGate);
  return lufs(mean(gated));
}

/** Crête d'échantillon (valeur absolue maximale). */
export function samplePeak(channels: readonly Float32Array[]): number {
  let m = 0;
  for (const c of channels) for (const v of c) m = Math.max(m, Math.abs(v));
  return m;
}

/**
 * Normalise à la sonie visée, avec un plafond de crête doux (ne coupe jamais net) : renvoie le gain appliqué (dB).
 */
export function normalize(channels: Float32Array[], fs: number, targetLufs = -16, ceiling = 0.89): number {
  const current = integratedLoudness(channels, fs);
  if (!Number.isFinite(current)) return 0;
  const gainDb = targetLufs - current;
  const g = 10 ** (gainDb / 20);
  for (const c of channels)
    for (let i = 0; i < c.length; i++) {
      const v = (c[i] ?? 0) * g;
      // limiteur doux au-dessus de 80 % du plafond
      const knee = ceiling * 0.8;
      const a = Math.abs(v);
      c[i] =
        a <= knee ? v : Math.sign(v) * (knee + (ceiling - knee) * Math.tanh((a - knee) / (ceiling - knee)));
    }
  return gainDb;
}
