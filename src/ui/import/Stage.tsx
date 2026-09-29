import { motion } from 'framer-motion';
import type { ConvertClient } from '@/convert/client';
import { duration } from '@/theme/motion/tokens';
import { CropBox } from './CropBox';
import { fitInside, type NormRect } from './crop';
import { GridPreview } from './GridPreview';
import { useElementSize } from './hooks';
import { IconInfo, Spinner } from './icons';
import type { Output } from './settings';

/** Marge autour de la photo : les poignées de 44 px, centrées sur les coins, restent entièrement visibles. */
const PAD = 22;

export type StageView = 'photo' | 'preview';

/** Photo décodée et prête à être convertie. */
export interface LoadedPhoto {
  blob: Blob;
  client: ConvertClient;
  /** URL d'objet pour l'affichage (révoquée à la fermeture). */
  url: string;
  /** Dimensions de la photo après réduction à 1200 px max. */
  width: number;
  height: number;
}

interface StageProps {
  view: StageView;
  /** `null` pendant le décodage de la photo. */
  photo: LoadedPhoto | null;
  crop: NormRect;
  /** Rapport largeur / hauteur normalisé imposé par le format, `null` si libre. */
  ratio: number | null;
  onCrop: (rect: NormRect) => void;
  /** Dernier résultat de conversion (peut dater d'un réglage précédent). */
  output: Output | null;
  /** Un résultat à jour est attendu. */
  waiting: boolean;
  failed: boolean;
}

/** Zone image : la photo avec son cadre de recadrage, ou l'aperçu de la grille convertie. */
export function Stage({ view, photo, crop, ratio, onCrop, output, waiting, failed }: StageProps) {
  const [setElement, size] = useElementSize();
  const availW = Math.max(0, size.w - 2 * PAD);
  const availH = Math.max(0, size.h - 2 * PAD);
  const fit = photo ? fitInside(photo.width / photo.height, availW, availH) : { w: 0, h: 0 };
  const fade = { duration: duration.sm / 1000 };

  return (
    <div className="imp-stage" ref={setElement}>
      {!photo && (
        <div className="imp-stage__center" role="status">
          <Spinner size={28} />
          <span>Lecture de la photo…</span>
        </div>
      )}
      {photo && fit.w > 0 && (
        <motion.div
          className="imp-layer"
          initial={false}
          animate={{ opacity: view === 'photo' ? 1 : 0 }}
          transition={fade}
          style={{ pointerEvents: view === 'photo' ? 'auto' : 'none' }}
          aria-hidden={view !== 'photo'}
        >
          <div className="imp-frame" style={{ width: fit.w, height: fit.h }}>
            <div className="imp-frame__clip">
              <img src={photo.url} alt="Photo choisie" draggable={false} />
            </div>
            <CropBox rect={crop} ratio={ratio} active={view === 'photo'} onChange={onCrop} />
          </div>
        </motion.div>
      )}
      {photo && (
        <motion.div
          className="imp-layer"
          initial={false}
          animate={{ opacity: view === 'preview' ? 1 : 0 }}
          transition={fade}
          style={{ pointerEvents: 'none' }}
          aria-hidden={view !== 'preview'}
        >
          {output ? (
            <GridPreview grid={output.result.grid} maxW={availW} maxH={availH} />
          ) : (
            <div className="imp-stage__center">
              <Spinner size={28} />
              <span>Calcul de l’aperçu…</span>
            </div>
          )}
        </motion.div>
      )}
      {view === 'preview' && waiting && output && (
        <div className="imp-busy" role="status">
          <Spinner size={16} />
          <span>Calcul…</span>
        </div>
      )}
      {failed && (
        <div className="imp-busy imp-busy--error" role="alert">
          <IconInfo size={16} />
          <span>Conversion impossible</span>
        </div>
      )}
    </div>
  );
}
