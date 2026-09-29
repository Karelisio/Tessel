import { motion, useReducedMotion } from 'framer-motion';
import type { PhotoSource } from '@/convert/photo';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { IconCamera, IconGallery, IconInfo, PixelScene, Spinner } from './icons';

interface PickViewProps {
  /** Source dont le sélecteur système est ouvert (les cartes sont alors inactives). */
  picking: PhotoSource | null;
  /** Message d'erreur à afficher gentiment (source indisponible, image illisible…). */
  notice: string | null;
  onPick: (source: PhotoSource) => void;
}

const CARDS = [
  { source: 'photos', title: 'Galerie', text: 'Choisir une photo', Icon: IconGallery },
  { source: 'camera', title: 'Appareil photo', text: 'Prendre une photo', Icon: IconCamera },
] as const satisfies readonly {
  source: PhotoSource;
  title: string;
  text: string;
  Icon: typeof IconGallery;
}[];

/** État initial : deux grandes cartes pour choisir la provenance de la photo. */
export function PickView({ picking, notice, onPick }: PickViewProps) {
  const reduced = useReducedMotion();
  return (
    <div className="imp-pick">
      <div className="imp-pick__hero">
        <motion.div
          className="imp-pick__art"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduced ? { duration: 0.12 } : { type: 'spring', ...spring.gentle }}
        >
          <PixelScene />
        </motion.div>
        <p className="imp-pick__lead">Une photo devient un tableau à colorier, case par case.</p>
        <div className="imp-pick__cards">
          {CARDS.map(({ source, title, text, Icon }, i) => (
            <motion.button
              key={source}
              type="button"
              className="imp-card"
              disabled={picking !== null}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduced
                  ? { duration: 0.12 }
                  : { type: 'spring', ...spring.gentle, delay: staggerDelay(i + 1) / 1000 }
              }
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                onPick(source);
              }}
            >
              <span className="imp-card__icon">
                {picking === source ? <Spinner size={32} /> : <Icon size={36} />}
              </span>
              <span className="imp-card__text">
                <span className="imp-card__title">{title}</span>
                <span className="imp-card__sub">{text}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </div>
      {/* zone réservée : l'apparition du message ne déplace pas les cartes */}
      <div className="imp-pick__notice" role="alert">
        {notice && (
          <motion.p
            className="imp-notice"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', ...spring.gentle }}
          >
            <IconInfo size={20} />
            <span>{notice}</span>
          </motion.p>
        )}
      </div>
    </div>
  );
}
