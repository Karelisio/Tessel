const SIZE = 240;

export interface PerfStats {
  fps: number;
  frameAvg: number;
  frameP95: number;
  workAvg: number;
  workP95: number;
  /** Frames dépassant 20 ms sur la fenêtre. */
  janky: number;
  rendered: number;
}

function percentile(values: Float32Array, n: number, p: number): number {
  if (n === 0) return 0;
  const sorted = Array.from(values.subarray(0, n)).sort((a, b) => a - b);
  return sorted[Math.min(n - 1, Math.floor(n * p))] ?? 0;
}

/** Mesure glissante des temps de frame (intervalle entre frames) et du temps de travail JS + GPU soumis. */
export class PerfMonitor {
  private readonly frames = new Float32Array(SIZE);
  private readonly work = new Float32Array(SIZE);
  private i = 0;
  private n = 0;
  private renderedCount = 0;

  record(frameMs: number, workMs: number, rendered: boolean): void {
    this.frames[this.i] = frameMs;
    this.work[this.i] = workMs;
    this.i = (this.i + 1) % SIZE;
    this.n = Math.min(SIZE, this.n + 1);
    if (rendered) this.renderedCount++;
  }

  reset(): void {
    this.i = 0;
    this.n = 0;
    this.renderedCount = 0;
  }

  stats(): PerfStats {
    let sumF = 0;
    let sumW = 0;
    let janky = 0;
    for (let k = 0; k < this.n; k++) {
      const f = this.frames[k] ?? 0;
      sumF += f;
      sumW += this.work[k] ?? 0;
      if (f > 20) janky++;
    }
    const frameAvg = this.n ? sumF / this.n : 0;
    return {
      fps: frameAvg ? 1000 / frameAvg : 0,
      frameAvg,
      frameP95: percentile(this.frames, this.n, 0.95),
      workAvg: this.n ? sumW / this.n : 0,
      workP95: percentile(this.work, this.n, 0.95),
      janky,
      rendered: this.renderedCount,
    };
  }
}
