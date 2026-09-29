import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { CreationMeta } from '@/create/CreationStore';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { IconMore } from '@/ui/kit/icons';
import type { Pixels } from './render';
import { creationPixels } from './thumbs';
import { whenText } from './when';
import { PixelThumb } from './ui';

/** Carte d'une création : vignette dessinée case par case, titre, taille, date, menu. */
export function CreationCard({
  meta,
  index,
  onOpen,
  onMenu,
}: {
  meta: CreationMeta;
  index: number;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const reduced = useReducedMotion();
  const [pixels, setPixels] = useState<Pixels | null>(null);
  useEffect(() => {
    let alive = true;
    void creationPixels(meta)
      .then((p) => {
        if (alive) setPixels(p);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [meta]);
  return (
    <motion.article
      className="cr-card"
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', ...spring.gentle, delay: staggerDelay(index) / 1000 }}
    >
      <motion.button
        className="cr-card__thumb"
        aria-label={`${tr(t('Ouvrir', 'Open'))} ${meta.title}`}
        whileTap={{ scale: 0.97 }}
        onClick={onOpen}
      >
        <PixelThumb pixels={pixels} box="fill" radius={18} />
        <span className="cr-card__size">
          {meta.width}×{meta.height}
        </span>
      </motion.button>
      <button
        className="cr-card__menu"
        aria-label={`${tr(t('Actions pour', 'Actions for'))} ${meta.title}`}
        onClick={onMenu}
      >
        <span>
          <IconMore size={20} />
        </span>
      </button>
      <div className="cr-card__info">
        <strong>{meta.title}</strong>
        <span>{whenText(meta.updatedAt)}</span>
      </div>
    </motion.article>
  );
}
