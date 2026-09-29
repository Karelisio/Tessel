import { AnimatePresence, motion } from 'framer-motion';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useMetaStore } from '@/store/meta';
import { spring } from '@/theme/motion/tokens';
import { IconFlame } from './icons';

const R = 17;
const CIRC = 2 * Math.PI * R;

/** Pastille de niveau : anneau d'XP qui se remplit, badge qui se retourne à chaque niveau, série. */
export function LevelChip({ onOpen }: { onOpen: () => void }) {
  const snap = useMetaStore((s) => s.snap);
  if (!snap) return null;
  const { level, streak, unseen } = snap;
  return (
    <motion.button
      className="level-chip"
      aria-label={`${tr(t('Niveau', 'Level'))} ${level.level}`}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', ...spring.snappy }}
      onClick={onOpen}
    >
      <span className="level-chip__badge">
        <svg viewBox="0 0 40 40" className="level-chip__ring" aria-hidden>
          <circle cx="20" cy="20" r={R} fill="none" stroke="var(--outline)" strokeWidth="3.5" />
          <motion.circle
            cx="20"
            cy="20"
            r={R}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            initial={false}
            animate={{ strokeDashoffset: CIRC * (1 - level.progress) }}
            transition={{ type: 'spring', ...spring.gentle }}
          />
        </svg>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={level.level}
            className="level-chip__num"
            initial={{ rotateY: -90, scale: 0.6, opacity: 0 }}
            animate={{ rotateY: 0, scale: 1, opacity: 1 }}
            exit={{ rotateY: 90, scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', ...spring.bouncy }}
          >
            {level.level}
          </motion.span>
        </AnimatePresence>
      </span>
      {streak.current > 0 && (
        <span className={`level-chip__streak level-chip__streak--${streak.status}`}>
          <IconFlame size={15} />
          {streak.current}
        </span>
      )}
      {unseen > 0 && (
        <motion.span className="level-chip__dot" layout initial={{ scale: 0 }} animate={{ scale: 1 }} />
      )}
    </motion.button>
  );
}
