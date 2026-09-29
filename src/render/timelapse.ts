import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { TRANSPARENT } from '@/content/grid';
import { FINALE } from '@/fx/finaleTimeline';
import { getMode } from '@/modes';
import { ArtworkRenderer, type Scene } from './ArtworkRenderer';
import type { Artwork } from './exports';

export type TimelapseFormat = 'mp4' | 'gif';

export interface TimelapseOptions {
  format: TimelapseFormat;
  /** Plus grand côté (px) ; 1080 en MP4, 480 en GIF par défaut. */
  size?: number;
  /** Durée totale (s). */
  seconds?: number;
  fps?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Temps passé sur l'image finale, cadre construit. */
const HOLD = 1;

/** Ordre de pose : le journal, complété par les cases posées qu'il ne contient pas (outils anciens…). */
export function placementOrder(a: Pick<Artwork, 'grid' | 'filled' | 'history'>): number[] {
  const seen = new Uint8Array(a.grid.cells.length);
  const order: number[] = [];
  for (const i of a.history) {
    if (seen[i] || !a.filled.get(i)) continue;
    seen[i] = 1;
    order.push(i);
  }
  for (let i = 0; i < a.grid.cells.length; i++)
    if (!seen[i] && a.grid.cells[i] !== TRANSPARENT && a.filled.get(i)) order.push(i);
  return order;
}

/** Image n° `f` : nombre de cases posées et temps de la cinématique de fin (< 0 : pas encore). */
export interface PlanFrame {
  placed: number;
  finale: number;
}

/**
 * Découpage du film : remplissage accéléré (doux au début et à la fin), puis cinématique de fin
 * en temps réel (cadre qui se construit), puis l'œuvre finie un instant.
 */
export function timelapsePlan(cells: number, fps: number, seconds: number, complete: boolean): PlanFrame[] {
  const tail = complete ? FINALE.done + HOLD : HOLD;
  const fill = Math.max(2, seconds - tail);
  const total = Math.round((fill + tail) * fps);
  const frames: PlanFrame[] = [];
  for (let f = 0; f < total; f++) {
    const t = f / fps;
    if (t < fill) {
      const k = t / fill;
      const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      frames.push({ placed: Math.round(cells * (0.15 * k + 0.85 * eased)), finale: -1 });
    } else {
      const since = t - fill;
      frames.push({ placed: cells, finale: complete ? Math.min(since, FINALE.done) : -1 });
    }
  }
  return frames;
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

const AVC_CODECS = ['avc1.640028', 'avc1.4D0028', 'avc1.42E01F', 'avc1.42001E'];

/** Premier codec vidéo pris en charge par l'appareil (H.264, sinon VP9 dans un MP4). */
async function pickCodec(
  width: number,
  height: number,
  fps: number,
): Promise<{ config: VideoEncoderConfig; muxCodec: 'avc' | 'vp9' } | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  const bitrate = Math.round(width * height * fps * 0.12);
  const candidates: [string, 'avc' | 'vp9'][] = [
    ...AVC_CODECS.map((c): [string, 'avc'] => [c, 'avc']),
    ['vp09.00.40.08', 'vp9'],
  ];
  for (const [codec, muxCodec] of candidates) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
      ...(muxCodec === 'avc' && { avc: { format: 'avc' as const } }),
    };
    const support = await VideoEncoder.isConfigSupported(config).catch(() => null);
    if (support?.supported) return { config, muxCodec };
  }
  return null;
}

/** L'export vidéo est-il possible sur cet appareil ? */
export async function canExportMp4(): Promise<boolean> {
  return (await pickCodec(720, 720, 30)) !== null;
}

class Aborted extends Error {
  constructor() {
    super('Export annulé');
    this.name = 'AbortError';
  }
}

async function encodeMp4(
  scene: Scene,
  plan: readonly PlanFrame[],
  order: readonly number[],
  fps: number,
  opts: TimelapseOptions,
): Promise<Blob> {
  const width = scene.width;
  const height = scene.height;
  const codec = await pickCodec(width, height, fps);
  if (!codec) throw new Error('Encodage vidéo indisponible sur cet appareil');
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: codec.muxCodec, width, height, frameRate: fps },
    fastStart: 'in-memory',
  });
  const status: { failure: Error | null } = { failure: null };
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      status.failure = e;
    },
  });
  encoder.configure(codec.config);
  const frameUs = 1e6 / fps;
  try {
    let last = -1;
    for (let f = 0; f < plan.length; f++) {
      if (opts.signal?.aborted) throw new Aborted();
      if (status.failure) throw status.failure;
      const p = plan[f] ?? { placed: order.length, finale: -1 };
      if (p.placed !== last) scene.setFilled(null, p.placed, order);
      last = p.placed;
      scene.setFinale(p.finale);
      scene.draw();
      const frame = new VideoFrame(scene.capture(), {
        timestamp: Math.round(f * frameUs),
        duration: Math.round(frameUs),
      });
      encoder.encode(frame, { keyFrame: f % (fps * 2) === 0 });
      frame.close();
      // contre-pression : l'encodeur matériel garde la main
      while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
      if (f % 4 === 0) {
        opts.onProgress?.(f / plan.length);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    await encoder.flush();
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
  muxer.finalize();
  opts.onProgress?.(1);
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

async function encodeGif(
  scene: Scene,
  plan: readonly PlanFrame[],
  order: readonly number[],
  fps: number,
  opts: TimelapseOptions,
): Promise<Blob> {
  const { width, height } = scene;
  const copy = document.createElement('canvas');
  copy.width = width;
  copy.height = height;
  const ctx = copy.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D indisponible');
  const grab = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(scene.capture(), 0, 0);
    return ctx.getImageData(0, 0, width, height).data;
  };
  // palette commune : l'œuvre finie encadrée (toutes les couleurs du film y sont)
  scene.setFilled(null, order.length, order);
  scene.setFinale(FINALE.done);
  scene.draw();
  const palette = quantize(grab(), 256);
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  let last = -1;
  for (let f = 0; f < plan.length; f++) {
    if (opts.signal?.aborted) throw new Aborted();
    const p = plan[f] ?? { placed: order.length, finale: -1 };
    if (p.placed !== last) scene.setFilled(null, p.placed, order);
    last = p.placed;
    scene.setFinale(p.finale);
    scene.draw();
    const holdEnd = f === plan.length - 1;
    gif.writeFrame(applyPalette(grab(), palette), width, height, {
      palette,
      delay: holdEnd ? delay + 1500 : delay,
    });
    if (f % 3 === 0) {
      opts.onProgress?.(f / plan.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  gif.finish();
  opts.onProgress?.(1);
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

/**
 * Film de la création : les cases apparaissent dans l'ordre où elles ont été posées, puis le cadre
 * se construit. MP4 (WebCodecs, H.264 matériel) ou GIF animé (plus léger, plus petit).
 */
export async function exportTimelapse(a: Artwork, opts: TimelapseOptions): Promise<Blob> {
  const gif = opts.format === 'gif';
  const fps = opts.fps ?? (gif ? 12 : 30);
  const seconds = opts.seconds ?? (gif ? 7 : 10);
  const size = opts.size ?? (gif ? 480 : 1080);
  const order = placementOrder(a);
  const plan = timelapsePlan(order.length, fps, seconds, a.completed);
  const r = await ArtworkRenderer.get();
  return r.sequence(
    { grid: a.grid, mode: getMode(a.mode), filled: null, framed: true, frame: a.frame, size: even(size) },
    (scene) => (gif ? encodeGif(scene, plan, order, fps, opts) : encodeMp4(scene, plan, order, fps, opts)),
  );
}
