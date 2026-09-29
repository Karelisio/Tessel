import { TRANSPARENT, countByColor, type Grid } from './grid';

/** Bitset compact des cases posées. */
export class Bitset {
  readonly bytes: Uint8Array;

  constructor(
    readonly size: number,
    bytes?: Uint8Array,
  ) {
    this.bytes = bytes ?? new Uint8Array((size + 7) >> 3);
    if (this.bytes.length !== (size + 7) >> 3) throw new Error('Taille de bitset incohérente');
  }

  get(i: number): boolean {
    return ((this.bytes[i >> 3] ?? 0) & (1 << (i & 7))) !== 0;
  }

  set(i: number): void {
    this.bytes[i >> 3] = (this.bytes[i >> 3] ?? 0) | (1 << (i & 7));
  }

  clear(i: number): void {
    this.bytes[i >> 3] = (this.bytes[i >> 3] ?? 0) & ~(1 << (i & 7));
  }
}

export const PlaceResult = {
  Placed: 0,
  AlreadyFilled: 1,
  WrongColor: 2,
  Transparent: 3,
  OutOfBounds: 4,
} as const;
export type PlaceResult = (typeof PlaceResult)[keyof typeof PlaceResult];

/** État logique d'une partie : cases posées et compteurs par couleur. */
export class Progress {
  readonly filled: Bitset;
  readonly remaining: Uint32Array;
  readonly totals: Uint32Array;
  private remainingTotal: number;
  private readonly transparent: number;

  constructor(
    readonly grid: Grid,
    filled?: Bitset,
  ) {
    this.filled = filled ?? new Bitset(grid.cells.length);
    this.totals = countByColor(grid);
    this.remaining = this.totals.slice();
    this.remainingTotal = 0;
    let transparent = 0;
    for (let i = 0; i < grid.cells.length; i++) {
      const c = grid.cells[i] ?? TRANSPARENT;
      if (c === TRANSPARENT) {
        transparent++;
        continue;
      }
      if (this.filled.get(i)) this.remaining[c] = (this.remaining[c] ?? 1) - 1;
      else this.remainingTotal++;
    }
    this.transparent = transparent;
  }

  get total(): number {
    return this.grid.cells.length - this.transparent;
  }

  get left(): number {
    return this.remainingTotal;
  }

  get complete(): boolean {
    return this.remainingTotal === 0;
  }

  index(x: number, y: number): number {
    return y * this.grid.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.grid.width && y < this.grid.height;
  }

  /** Vérifie sans modifier si la case peut recevoir la couleur. */
  check(i: number, color: number): PlaceResult {
    if (i < 0 || i >= this.grid.cells.length) return PlaceResult.OutOfBounds;
    const target = this.grid.cells[i] ?? TRANSPARENT;
    if (target === TRANSPARENT) return PlaceResult.Transparent;
    if (this.filled.get(i)) return PlaceResult.AlreadyFilled;
    if (target !== color) return PlaceResult.WrongColor;
    return PlaceResult.Placed;
  }

  place(i: number, color: number): PlaceResult {
    const r = this.check(i, color);
    if (r !== PlaceResult.Placed) return r;
    this.filled.set(i);
    this.remaining[color] = (this.remaining[color] ?? 1) - 1;
    this.remainingTotal--;
    return r;
  }

  /** Annule une pose (undo). Renvoie false si la case n'était pas posée. */
  unplace(i: number): boolean {
    const target = this.grid.cells[i] ?? TRANSPARENT;
    if (target === TRANSPARENT || !this.filled.get(i)) return false;
    this.filled.clear(i);
    this.remaining[target] = (this.remaining[target] ?? 0) + 1;
    this.remainingTotal++;
    return true;
  }
}
