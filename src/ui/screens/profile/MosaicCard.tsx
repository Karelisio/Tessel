import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { tr } from '@/i18n/locale';
import { t, type I18nText } from '@/i18n/text';
import { Card, ProgressRing } from '@/ui/kit';
import { Thumb } from '@/ui/library/Thumb';
import { spring } from '@/theme/motion/tokens';
import { IconCheckBold } from './icons';
import './collections.css';

export interface MosaicItem {
  id: string;
  done: boolean;
}

/** Carte de collection : progression et mosaïque de vignettes, grisées pour les œuvres manquantes. */
export function MosaicCard({
  index,
  name,
  items,
  badge,
  note,
  onClick,
}: {
  index: number;
  name: I18nText;
  items: readonly MosaicItem[];
  badge?: ReactNode;
  note?: string;
  onClick?: () => void;
}) {
  const done = items.filter((i) => i.done).length;
  const complete = done === items.length && items.length > 0;
  return (
    <Card index={index} className="col-card" {...(onClick && { onClick })}>
      <div className="col-card__box" data-done={complete}>
        <header className="col-card__head">
          <div className="col-card__title">
            <strong>{tr(name)}</strong>
            <small>{note ?? `${done} / ${items.length} ${tr(t('œuvres', 'artworks'))}`}</small>
          </div>
          {badge}
          <ProgressRing value={items.length ? done / items.length : 0} size={44} stroke={5}>
            {complete ? <IconCheckBold size={18} /> : `${done}`}
          </ProgressRing>
        </header>
        <ul
          className="col-mosaic"
          style={{ gridTemplateColumns: `repeat(${Math.min(6, items.length)}, 1fr)` }}
        >
          {items.map((it, i) => (
            <motion.li
              key={it.id}
              className="col-thumb"
              data-missing={!it.done}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', ...spring.gentle, delay: 0.12 + i * 0.035 }}
            >
              <Thumb id={it.id} size={48} />
            </motion.li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
