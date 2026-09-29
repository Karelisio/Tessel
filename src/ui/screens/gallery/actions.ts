import { Capacitor } from '@capacitor/core';
import { useEffect, useState } from 'react';
import type { ProjectMeta } from '@/db/ProgressStore';
import { canvasBlob, fileName, loadArtwork, renderArtwork } from '@/render/exports';
import { canExportMp4 } from '@/render/timelapse';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/** Annulation volontaire (feuille de partage fermée, export interrompu) : pas une erreur. */
export function isCancel(e: unknown): boolean {
  if (e instanceof Error && e.name === 'AbortError') return true;
  const message = e instanceof Error ? e.message : String(e);
  return /cancel|abort|dismiss/i.test(message);
}

/** Image HD (2048 px) de l'œuvre encadrée, prête à enregistrer ou partager. */
export async function renderHd(project: ProjectMeta): Promise<{ blob: Blob; name: string; title: string }> {
  const artwork = await loadArtwork(project.id);
  const canvas = await renderArtwork(artwork, { size: 2048 });
  return { blob: await canvasBlob(canvas), name: fileName(artwork.title, 'png'), title: artwork.title };
}

let mp4Support: Promise<boolean> | null = null;

/** L'appareil sait-il encoder de la vidéo ? (null tant qu'on ne le sait pas) */
export function useCanExportMp4(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    mp4Support ??= canExportMp4().catch(() => false);
    void mp4Support.then((v) => {
      if (alive) setOk(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}
