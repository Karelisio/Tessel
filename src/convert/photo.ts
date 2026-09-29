import { Camera, MediaTypeSelection, type MediaResult } from '@capacitor/camera';

export type PhotoSource = 'camera' | 'photos';

async function toBlob(media: MediaResult | undefined): Promise<Blob | null> {
  if (!media?.webPath) return null;
  const res = await fetch(media.webPath);
  return res.blob();
}

/**
 * Récupère une photo : appareil photo, ou galerie via le sélecteur système (aucune permission
 * de stockage). Renvoie `null` si l'utilisateur annule.
 */
export async function pickPhoto(from: PhotoSource): Promise<Blob | null> {
  const options = { quality: 92, targetWidth: 2048, correctOrientation: true };
  try {
    if (from === 'camera') return await toBlob(await Camera.takePhoto(options));
    const { results } = await Camera.chooseFromGallery({
      ...options,
      mediaType: MediaTypeSelection.Photo,
      allowMultipleSelection: false,
      limit: 1,
    });
    return await toBlob(results[0]);
  } catch (e) {
    // annulation par l'utilisateur : pas une erreur
    if (e instanceof Error && /cancel/i.test(e.message)) return null;
    throw e;
  }
}
