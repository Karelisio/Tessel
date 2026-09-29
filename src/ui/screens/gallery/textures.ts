/**
 * Textures des murs générées une fois en JavaScript (bruit de valeur périodique → petite tuile PNG),
 * à la place de filtres SVG : ceux-ci se rasterisent lentement sur le fil principal des téléphones.
 */

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Réseau de valeurs aléatoires qui se referme sur lui-même (la tuile se répète sans couture). */
class Lattice {
  private readonly values: Float32Array;
  constructor(
    private readonly nx: number,
    private readonly ny: number,
    seed: number,
  ) {
    const rand = rng(seed);
    this.values = Float32Array.from({ length: nx * ny }, () => rand());
  }
  private at(ix: number, iy: number): number {
    const x = ((ix % this.nx) + this.nx) % this.nx;
    const y = ((iy % this.ny) + this.ny) % this.ny;
    return this.values[y * this.nx + x] ?? 0;
  }
  /** Bruit lissé en (x, y), exprimé en cases du réseau. */
  sample(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const top = this.at(x0, y0) * (1 - fx) + this.at(x0 + 1, y0) * fx;
    const bottom = this.at(x0, y0 + 1) * (1 - fx) + this.at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  }
}

/** Bruit fractal périodique dans [0, 1] : `cells` cases par tuile à la première octave. */
export class Fbm {
  private readonly layers: Lattice[] = [];
  private readonly total: number;
  constructor(
    private readonly cellsX: number,
    private readonly cellsY: number,
    octaves: number,
    seed: number,
  ) {
    let amp = 1;
    let sum = 0;
    for (let o = 0; o < octaves; o++) {
      this.layers.push(new Lattice(cellsX * 2 ** o, cellsY * 2 ** o, seed + o * 101));
      sum += amp;
      amp *= 0.5;
    }
    this.total = sum;
  }
  /** `u`, `v` dans [0, 1[ (position dans la tuile). */
  at(u: number, v: number): number {
    let amp = 1;
    let acc = 0;
    this.layers.forEach((lat, o) => {
      const k = 2 ** o;
      acc += amp * lat.sample(u * this.cellsX * k, v * this.cellsY * k);
      amp *= 0.5;
    });
    return acc / this.total;
  }
}

export type Shader = (u: number, v: number) => readonly [number, number, number, number];

const cache = new Map<string, string>();

/** Peint une tuile pixel par pixel. Couleurs 0–255, alpha 0–1. */
export function paint(key: string, size: number, shade: Shader): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'none';
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = shade(x / size, y / size);
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.max(0, Math.min(255, a * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = `url("${canvas.toDataURL('image/png')}")`;
  cache.set(key, url);
  return url;
}

type Rgb = readonly [number, number, number];

/** Grain fin : mouchetures de la couleur donnée. */
export function grainTexture(rgb: Rgb, strength: number, seed: number, size = 128): string {
  const f = new Fbm(size, size, 1, seed);
  return paint(`grain/${rgb.join(',')}/${String(strength)}/${String(seed)}`, size, (u, v) => [
    rgb[0],
    rgb[1],
    rgb[2],
    strength * f.at(u, v),
  ]);
}

/** Nuages doux : variations lentes de la matière. */
export function cloudTexture(rgb: Rgb, strength: number, seed: number, cells = 3, size = 256): string {
  const f = new Fbm(cells, cells, 4, seed);
  return paint(
    `cloud/${rgb.join(',')}/${String(strength)}/${String(seed)}/${String(cells)}`,
    size,
    (u, v) => {
      const n = f.at(u, v);
      return [rgb[0], rgb[1], rgb[2], strength * Math.max(0, (n - 0.25) * 1.8)];
    },
  );
}

/** Fibres étirées (grain du bois, veines de l'ardoise) : `stretch` > 1 allonge dans la hauteur. */
export function fibreTexture(
  rgb: Rgb,
  strength: number,
  seed: number,
  o: { cellsX: number; cellsY: number; size?: number },
): string {
  const f = new Fbm(o.cellsX, o.cellsY, 4, seed);
  return paint(
    `fibre/${rgb.join(',')}/${String(strength)}/${String(seed)}/${String(o.cellsX)}x${String(o.cellsY)}`,
    o.size ?? 256,
    (u, v) => [rgb[0], rgb[1], rgb[2], strength * f.at(u, v)],
  );
}

/** Veines de marbre : crêtes fines du bruit, déformées par un second bruit. */
export function marbleTexture(rgb: Rgb, seed: number, size = 384): string {
  const warp = new Fbm(2, 2, 3, seed + 7);
  const base = new Fbm(2, 2, 5, seed);
  return paint(`marble/${rgb.join(',')}/${String(seed)}`, size, (u, v) => {
    const w = (warp.at(u, v) - 0.5) * 0.55;
    const n = base.at((u + w + 1) % 1, (v + w * 0.8 + 1) % 1);
    const vein = Math.abs(n - 0.5);
    const a = Math.max(0, 1 - vein / 0.014) ** 1.5;
    // un voile plus large, très léger, autour de chaque veine
    const halo = Math.max(0, 1 - vein / 0.07) * 0.1;
    return [rgb[0], rgb[1], rgb[2], Math.min(1, a * 0.62 + halo)];
  });
}
