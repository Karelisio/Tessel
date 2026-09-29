import { motion } from 'framer-motion';
import { useMemo, useRef } from 'react';
import { dailyArtwork } from '@/content/daily';
import type { ProjectMeta } from '@/db/ProgressStore';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { addDays, type DayKey } from '@/meta/time';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { Skeleton } from '@/ui/kit';
import { Thumb } from '@/ui/library/Thumb';
import { IconCheck } from '@/ui/meta/icons';
import { dayLabel } from './common';
import { openDaily } from './open';

const DAYS = 6;

function PastDay({
  day,
  index,
  status,
}: {
  day: DayKey;
  index: number;
  status: 'done' | 'started' | 'none';
}) {
  const box = useRef<HTMLButtonElement>(null);
  const art = dailyArtwork(day);
  const load = useMemo(() => () => Promise.resolve(dailyArtwork(day).grid()), [day]);
  const label = dayLabel(day, { weekday: 'short', day: 'numeric' });
  const state =
    status === 'done'
      ? tr(t('terminée', 'completed'))
      : status === 'started'
        ? tr(t('commencée', 'started'))
        : tr(t('à découvrir', 'to discover'));
  return (
    <motion.li
      className="daily-past"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', ...spring.gentle, delay: staggerDelay(index) / 1000 }}
    >
      <motion.button
        ref={box}
        type="button"
        className="daily-past__btn"
        data-status={status}
        whileTap={{ scale: 0.95 }}
        aria-label={`${tr(art.title)}, ${state}`}
        onClick={() => {
          openDaily(day, box.current);
        }}
      >
        <span className="daily-past__thumb">
          <Thumb id={art.id} load={load} size={76} />
          {status === 'done' && (
            <span className="daily-past__check" aria-hidden>
              <IconCheck size={14} />
            </span>
          )}
        </span>
        <span className="daily-past__label">{label}</span>
      </motion.button>
    </motion.li>
  );
}

/** Rangée des œuvres du jour précédentes (celles qu'on a manquées restent jouables). */
export function PastDays({ day, projects }: { day: DayKey; projects: ProjectMeta[] | undefined }) {
  if (projects === undefined)
    return (
      <div className="daily-past-row">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} width={76} height={100} radius={14} />
        ))}
      </div>
    );
  return (
    <ul
      className="daily-past-row"
      aria-label={tr(t('Œuvres des jours précédents', 'Previous days’ artworks'))}
    >
      {Array.from({ length: DAYS }, (_, i) => {
        const d = addDays(day, -(i + 1));
        const p = projects.find((x) => x.artworkId === `daily:${d}`);
        const status = p?.completedAt != null ? 'done' : p && p.filled > 0 ? 'started' : 'none';
        return <PastDay key={d} day={d} index={i} status={status} />;
      })}
    </ul>
  );
}
