import { motion } from 'framer-motion';
import { useId } from 'react';
import type { FlameLevel } from './common';

const SCALE: Readonly<Record<FlameLevel, number>> = { 0: 0.86, 1: 0.8, 2: 0.9, 3: 1, 4: 1.08 };

const SPARKS = [
  { x: 20, drift: -6, delay: 0 },
  { x: 44, drift: 6, delay: 0.8 },
  { x: 32, drift: -3, delay: 1.5 },
  { x: 50, drift: 4, delay: 2.1 },
  { x: 14, drift: 5, delay: 1.1 },
] as const;

const OUTER =
  'M32 4C36 18 54 28 54 50C54 66 44 76 32 76C20 76 10 66 10 50C10 40 16 34 20 28C22 34 24 38 28 38C26 26 28 14 32 4Z';
const INNER = 'M32 36C35 46 44 50 44 60C44 68 39 73 32 73C25 73 20 68 20 60C20 52 27 48 32 38Z';
const CORE = 'M32 52C34 57 38 59 38 64C38 69 35 72 32 72C29 72 26 69 26 64C26 59 30 57 32 52Z';

/**
 * Flamme vivante et douce : elle ondule, respire et, à partir de quelques jours de série,
 * laisse s'échapper des étincelles. Éteinte (niveau 0), elle reste une silhouette tranquille.
 */
export function Flame({
  level,
  size = 72,
  dim = false,
}: {
  level: FlameLevel;
  size?: number;
  dim?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const lit = level > 0;
  const speed = 2.9 - level * 0.22;
  const k = SCALE[level];
  const sparks = level >= 4 ? SPARKS : level >= 3 ? SPARKS.slice(0, 3) : [];
  return (
    <svg
      width={size}
      height={(size * 80) / 64}
      viewBox="0 0 64 80"
      overflow="visible"
      aria-hidden
      className="daily-flame"
      style={dim ? { opacity: 0.9 } : undefined}
    >
      <defs>
        <linearGradient id={`${uid}o`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--tertiary) 82%, var(--primary))' }} />
          <stop offset="1" style={{ stopColor: 'var(--tertiary)' }} />
        </linearGradient>
        <linearGradient id={`${uid}i`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--daily-flame-mid)' }} />
          <stop offset="1" style={{ stopColor: 'var(--daily-flame-core)' }} />
        </linearGradient>
        <radialGradient id={`${uid}g`}>
          <stop offset="0" style={{ stopColor: 'var(--tertiary)', stopOpacity: 0.5 }} />
          <stop offset="1" style={{ stopColor: 'var(--tertiary)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      {level >= 2 && (
        <motion.circle
          cx="32"
          cy="52"
          r={level >= 4 ? 46 : 38}
          fill={`url(#${uid}g)`}
          animate={{ opacity: [0.55, 1, 0.55], scale: [0.96, 1.05, 0.96] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: 0.5, originY: 0.5 }}
        />
      )}
      <g transform={`translate(32 76) scale(${k}) translate(-32 -76)`}>
        {lit ? (
          <>
            <motion.path
              d={OUTER}
              fill={`url(#${uid}o)`}
              style={{ originX: 0.5, originY: 1 }}
              animate={{
                scaleY: [1, 1.06, 0.97, 1.04, 1],
                scaleX: [1, 0.96, 1.03, 0.98, 1],
                rotate: [0, -1.6, 1.2, -0.6, 0],
              }}
              transition={{ duration: speed, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.path
              d={INNER}
              fill={`url(#${uid}i)`}
              style={{ originX: 0.5, originY: 1 }}
              animate={{
                scaleY: [1, 0.95, 1.07, 0.98, 1],
                scaleX: [1, 1.04, 0.97, 1.02, 1],
                rotate: [0, 1.4, -1.2, 0.8, 0],
              }}
              transition={{ duration: speed * 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
            />
            <motion.path
              d={CORE}
              style={{ originX: 0.5, originY: 1, fill: 'var(--daily-flame-core)' }}
              animate={{ scaleY: [1, 1.12, 0.94, 1], opacity: [0.9, 1, 0.8, 0.9] }}
              transition={{ duration: speed * 0.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : (
          <>
            <path
              d={OUTER}
              style={{ fill: 'var(--surface-3)', stroke: 'var(--outline-strong)' }}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d={INNER} style={{ fill: 'var(--outline)' }} />
          </>
        )}
      </g>
      {sparks.map((s, i) => (
        <motion.circle
          key={i}
          r={1.7}
          cx={s.x}
          cy={58}
          style={{ fill: 'var(--daily-flame-core)' }}
          animate={{ y: [0, -50], x: [0, s.drift], opacity: [0, 1, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut', delay: s.delay }}
        />
      ))}
    </svg>
  );
}
