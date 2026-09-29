import { transfer, wrap, type Remote } from 'comlink';
import { createGrid, type Rgb } from '@/content/grid';
import type { ConvertWorkerApi, SourceInfo, WorkerResult } from './convert.worker';
import type { ConvertParams, ConvertResult } from './pipeline';

/** Taille maximale de la photo gardée en mémoire (côté le plus long, px) : 4 px par case à 300 cases. */
const SOURCE_MAX_SIDE = 1200;

function toResult(r: WorkerResult): ConvertResult {
  const palette: Rgb[] = [];
  for (let i = 0; i < r.palette.length; i += 3)
    palette.push([r.palette[i] ?? 0, r.palette[i + 1] ?? 0, r.palette[i + 2] ?? 0]);
  return { grid: createGrid(r.width, r.height, palette, r.cells), stats: r.stats };
}

interface Job {
  params: ConvertParams;
  resolve: (r: ConvertResult | null) => void;
}

/**
 * Conversion photo → grille dans un Web Worker (l'interface ne se fige jamais).
 * Politique « dernière demande gagnante » : pendant qu'un calcul tourne, seule la dernière demande
 * est gardée ; les demandes intermédiaires sont abandonnées (résolues à `null`).
 */
export class ConvertClient {
  private readonly worker: Worker;
  private readonly api: Remote<ConvertWorkerApi>;
  private running = false;
  private pending: Job | null = null;

  constructor() {
    this.worker = new Worker(new URL('./convert.worker.ts', import.meta.url), { type: 'module' });
    this.api = wrap<ConvertWorkerApi>(this.worker);
  }

  /** Charge une photo (orientation EXIF respectée) ; renvoie ses dimensions après réduction. */
  async loadImage(blob: Blob): Promise<SourceInfo> {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    return this.api.setSource(transfer(bitmap, [bitmap]), SOURCE_MAX_SIDE);
  }

  request(params: ConvertParams): Promise<ConvertResult | null> {
    return new Promise((resolve) => {
      this.pending?.resolve(null);
      this.pending = { params, resolve };
      void this.pump();
    });
  }

  dispose(): void {
    this.pending?.resolve(null);
    this.pending = null;
    this.worker.terminate();
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending) {
        const job = this.pending;
        this.pending = null;
        try {
          job.resolve(toResult(await this.api.convert(job.params)));
        } catch (e) {
          console.error('Conversion impossible', e);
          job.resolve(null);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
