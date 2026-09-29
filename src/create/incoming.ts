import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { fromBase64 } from '@/db/codecs';
import { useNav } from '@/store/nav';
import { decodeTessel } from './format';

/** Lit une œuvre .tessel ouverte depuis une autre app (URI content:// ou file://). */
async function receive(url: string): Promise<void> {
  if (!url.startsWith('content:') && !url.startsWith('file:')) return;
  try {
    const file = await Filesystem.readFile({ path: url });
    const data =
      typeof file.data === 'string' ? fromBase64(file.data) : new Uint8Array(await file.data.arrayBuffer());
    useNav.getState().receiveShared(decodeTessel(data));
  } catch (e) {
    console.error('Œuvre partagée illisible', e);
  }
}

/** Branche la réception des fichiers .tessel (au lancement et pendant que l'app tourne). */
export function listenIncomingShares(): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  void CapApp.getLaunchUrl()
    .then((r) => (r?.url ? receive(r.url) : undefined))
    .catch(() => undefined);
  const handle = CapApp.addListener('appUrlOpen', ({ url }) => {
    void receive(url);
  });
  return () => {
    void handle.then((h) => h.remove());
  };
}

/** Ouvre une œuvre .tessel choisie dans les fichiers du téléphone (sélecteur du système). */
export async function readTesselFile(file: Blob): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  useNav.getState().receiveShared(decodeTessel(bytes));
}
