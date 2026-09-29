import { AnimatePresence, motion } from 'framer-motion';
import { useId } from 'react';
import { spring } from '@/theme/motion/tokens';
import './profile.css';

/** Rosette à 12 lobes, calculée une fois. */
const ROSETTE = (() => {
  const pts: string[] = [];
  const n = 240;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 39 + 2.6 * Math.cos(12 * a);
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();

const R = 47;
const C = 2 * Math.PI * R;

/** Grand badge de niveau : rosette, anneau d'XP animé et chiffre qui se retourne à chaque niveau. */
export function LevelBadge({
  level,
  progress,
  size = 116,
}: {
  level: number;
  progress: number;
  size?: number;
}) {
  const gid = useId();
  const digits = String(level).length;
  return (
    <span className="pf-badge" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="pf-badge__svg" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--primary)' }} />
            <stop offset="1" style={{ stopColor: 'var(--tertiary)' }} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--outline)" strokeWidth="3" />
        <motion.circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          style={{ rotate: -90, originX: '50%', originY: '50%' }}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - Math.min(1, Math.max(0, progress))) }}
          transition={{ type: 'spring', ...spring.gentle }}
        />
        <path d={ROSETTE} fill={`url(#${gid})`} />
        <circle
          cx="50"
          cy="50"
          r="30"
          fill="none"
          stroke="var(--on-primary)"
          strokeOpacity="0.35"
          strokeWidth="1.5"
        />
      </svg>
      <span className="pf-badge__num" data-digits={digits}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={level}
            initial={{ rotateY: -90, scale: 0.6, opacity: 0 }}
            animate={{ rotateY: 0, scale: 1, opacity: 1 }}
            exit={{ rotateY: 90, scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', ...spring.bouncy }}
          >
            {level}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
