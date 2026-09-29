import { motion, useReducedMotion } from 'framer-motion';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { spring } from '@/theme/motion/tokens';
import { scatter } from './common';

export type GiftPhase = 'closed' | 'opening' | 'reveal' | 'open';

const TINTS = ['var(--primary)', 'var(--tertiary)', 'var(--daily-flame-core)', 'var(--primary-container)'];

/** Éclat de particules douces qui jaillit d'un point (boîte cadeau, coffre). */
export function Burst({
  count = 18,
  radius = 110,
  delay = 0,
}: {
  count?: number;
  radius?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <span className="daily-burst" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + scatter(i) * 0.5;
        const dist = radius * (0.55 + scatter(i, 1) * 0.55);
        const size = 5 + Math.round(scatter(i, 2) * 6);
        return (
          <motion.i
            key={i}
            className="daily-burst__p"
            data-round={i % 3 !== 0}
            style={{ width: size, height: size, background: TINTS[i % TINTS.length] ?? TINTS[0] }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist - 18,
              scale: [0, 1.15, 0.7],
              opacity: [1, 1, 0],
              rotate: (scatter(i, 3) - 0.5) * 240,
            }}
            transition={{ duration: 1.05 + scatter(i, 4) * 0.4, ease: [0.1, 0.7, 0.2, 1], delay }}
          />
        );
      })}
    </span>
  );
}

const TWINKLES = [
  { x: 24, y: 40, s: 1, d: 0 },
  { x: 176, y: 58, s: 0.8, d: 0.7 },
  { x: 160, y: 24, s: 0.6, d: 1.3 },
  { x: 38, y: 112, s: 0.55, d: 1.9 },
] as const;

/**
 * Boîte cadeau de l'œuvre du jour : elle se balance doucement ; au toucher le couvercle saute,
 * le ruban se détend et un éclat de lumière révèle la surprise.
 */
export function GiftBox({ phase, onOpen }: { phase: GiftPhase; onOpen: () => void }) {
  const opened = phase !== 'closed';
  return (
    <motion.button
      type="button"
      className="daily-gift"
      aria-label={tr(t('Ouvrir le cadeau du jour', 'Open today’s gift'))}
      disabled={opened}
      onClick={onOpen}
      {...(!opened && { whileTap: { scale: 0.94 } })}
      animate={
        phase === 'closed'
          ? { y: [0, -5, 0], rotate: [0, -1.2, 0, 1.2, 0] }
          : phase === 'opening'
            ? { scaleY: [1, 0.88, 1.06, 1], scaleX: [1, 1.08, 0.97, 1], y: 0, rotate: 0 }
            : { scale: 0.85, opacity: 0, y: 12 }
      }
      transition={
        phase === 'closed'
          ? { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }
          : { duration: phase === 'opening' ? 0.5 : 0.35 }
      }
    >
      <svg viewBox="0 0 200 200" className="daily-gift__svg" aria-hidden>
        <ellipse cx="100" cy="180" rx="66" ry="8" style={{ fill: 'var(--on-surface)', opacity: 0.12 }} />
        {/* lumière qui s'échappe de la boîte */}
        <motion.ellipse
          cx="100"
          cy="96"
          rx="56"
          ry="12"
          style={{ fill: 'var(--daily-flame-core)' }}
          initial={false}
          animate={{ opacity: opened ? [0, 1, 0.8] : 0, scaleX: opened ? [0.6, 1.3, 1.1] : 0.6 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        />
        <rect x="40" y="94" width="120" height="82" rx="13" style={{ fill: 'var(--primary)' }} />
        <rect
          x="100"
          y="94"
          width="60"
          height="82"
          rx="13"
          style={{ fill: 'var(--on-primary-container)', opacity: 0.14 }}
        />
        <rect x="91" y="94" width="18" height="82" style={{ fill: 'var(--tertiary)' }} />
        <motion.g
          initial={false}
          animate={
            opened ? { y: -74, x: 34, rotate: 26, opacity: [1, 1, 0] } : { y: 0, x: 0, rotate: 0, opacity: 1 }
          }
          transition={{ type: 'spring', ...spring.bouncy, opacity: { duration: 0.9, times: [0, 0.6, 1] } }}
          style={{ originX: 0.5, originY: 1 }}
        >
          <rect
            x="31"
            y="64"
            width="138"
            height="36"
            rx="11"
            style={{ fill: 'color-mix(in srgb, var(--primary) 82%, var(--surface-2))' }}
          />
          <rect x="91" y="64" width="18" height="36" style={{ fill: 'var(--tertiary)' }} />
          <motion.g
            style={{ originX: 0.5, originY: 1 }}
            animate={opened ? { rotate: 0 } : { rotate: [0, -4, 0, 4, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ellipse
              cx="80"
              cy="52"
              rx="20"
              ry="12"
              transform="rotate(-24 80 52)"
              style={{ fill: 'var(--tertiary)', stroke: 'var(--surface-2)', strokeWidth: 2.5 }}
            />
            <ellipse
              cx="120"
              cy="52"
              rx="20"
              ry="12"
              transform="rotate(24 120 52)"
              style={{ fill: 'var(--tertiary)', stroke: 'var(--surface-2)', strokeWidth: 2.5 }}
            />
            <circle
              cx="100"
              cy="58"
              r="9"
              style={{ fill: 'var(--tertiary)', stroke: 'var(--surface-2)', strokeWidth: 2.5 }}
            />
          </motion.g>
        </motion.g>
        {!opened &&
          TWINKLES.map((s, i) => (
            <g key={i} transform={`translate(${s.x} ${s.y}) scale(${s.s})`}>
              <motion.path
                d="M0 -10C1 -3 3 -1 10 0C3 1 1 3 0 10C-1 3 -3 1 -10 0C-3 -1 -1 -3 0 -10Z"
                style={{ fill: 'var(--daily-flame-core)', originX: 0.5, originY: 0.5 }}
                animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: s.d, ease: 'easeInOut' }}
              />
            </g>
          ))}
      </svg>
    </motion.button>
  );
}
