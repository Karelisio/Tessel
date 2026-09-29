import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { catalogItem, unlockKind, type UnlockKind } from '@/meta/catalog';
import { mergeRewards, type Reward } from '@/meta/rewards';
import { useSettings } from '@/store/settings';
import { spring } from '@/theme/motion/tokens';
import { Confetti } from '@/ui/fx/Confetti';
import { UNLOCK_KINDS, rewardLabel } from './labels';

/** Rosette à 14 festons (badge de niveau). */
function rosette(r: number, bumps = 14): string {
  const pts: string[] = [];
  for (let i = 0; i < bumps * 8; i++) {
    const a = (i / (bumps * 8)) * Math.PI * 2;
    const rr = r * (0.93 + 0.07 * Math.cos(a * bumps));
    pts.push(`${(60 + Math.cos(a) * rr).toFixed(2)},${(60 + Math.sin(a) * rr).toFixed(2)}`);
  }
  return pts.join(' ');
}
const ROSETTE = rosette(54);

function KindIcon({ kind }: { kind: UnlockKind }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  switch (kind) {
    case 'mode':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="3.5" />
          <path d="M3 17.5l3.5-3.5 3.5 3.5-3.5 3.5z" />
          <path d="M14 14l7 7M21 14l-7 7" />
        </svg>
      );
    case 'category':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <path d="M3 16l5-5 4 4 3-3 6 6" />
          <circle cx="16" cy="8.5" r="1.6" />
        </svg>
      );
    case 'frame':
    case 'wall':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="1.5" />
          <rect x="7" y="7" width="10" height="10" rx="1" />
        </svg>
      );
    case 'music':
    case 'ambience':
      return (
        <svg {...common}>
          <path d="M9 18V5l11-2v13" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="17.5" cy="16" r="2.5" />
        </svg>
      );
    case 'palette':
    case 'texture':
      return (
        <svg {...common}>
          <path d="M12 3a9 9 0 100 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.6 0-.9.7-1.5 1.7-1.5H17a4 4 0 004-4c0-4.5-4-8.2-9-8.2z" />
          <circle cx="7.5" cy="11" r="1.2" />
          <circle cx="10.5" cy="7" r="1.2" />
          <circle cx="15" cy="7.5" r="1.2" />
        </svg>
      );
    case 'badge':
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="6" />
          <path d="M8.5 14l-1.5 7 5-2.5 5 2.5-1.5-7" />
        </svg>
      );
  }
}

/** Compteur qui monte de l'ancien niveau au nouveau. */
function useCountUp(from: number, to: number, delayMs: number, reduced: boolean): number {
  const [value, setValue] = useState(reduced ? to : from);
  useEffect(() => {
    if (reduced || from === to) return;
    let raf = 0;
    const start = performance.now() + delayMs;
    const dur = Math.min(900, 220 * (to - from));
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - start) / dur));
      setValue(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [from, to, delayMs, reduced]);
  return value;
}

export interface LevelUpProps {
  from: number;
  level: number;
  rewards: readonly Reward[];
  onClose: () => void;
}

/**
 * Célébration plein écran d'une montée de niveau : rayons qui tournent, rosette qui arrive en tournoyant,
 * compteur de niveau, confettis, puis les déblocages en cartes qui se retournent.
 */
export function LevelUp({ from, level, rewards, onClose }: LevelUpProps) {
  const reduced = useSettings((s) => s.reducedMotion);
  const shown = useCountUp(from, level, 380, reduced);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const h = setTimeout(() => {
      setReady(true);
    }, 900);
    return () => {
      clearTimeout(h);
    };
  }, []);
  const merged = mergeRewards([...rewards]);
  const unlocks = merged.filter((r): r is Extract<Reward, { kind: 'unlock' }> => r.kind === 'unlock');
  const others = merged.filter((r) => r.kind !== 'unlock');
  const cardsAt = 0.75;

  return (
    <motion.div
      className="levelup"
      role="dialog"
      aria-modal="true"
      aria-label={tr(t(`Niveau ${level} atteint`, `Reached level ${level}`))}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onClick={() => {
        if (ready) onClose();
      }}
    >
      {!reduced && <Confetti burst={1} origin={[0.5, 0.3]} />}
      <div className="levelup__stage">
        <div className="levelup__medal">
          <motion.div
            className="levelup__rays"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1, rotate: reduced ? 0 : 360 }}
            transition={{
              opacity: { duration: 0.5, delay: 0.15 },
              scale: { type: 'spring', ...spring.gentle, delay: 0.15 },
              rotate: { duration: 30, ease: 'linear', repeat: Infinity },
            }}
          />
          <motion.div
            className="levelup__badge"
            initial={reduced ? { opacity: 0 } : { scale: 0.2, rotate: -200, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 13, delay: 0.1 }}
          >
            <svg viewBox="0 0 120 120" aria-hidden>
              <defs>
                <linearGradient id="levelup-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fbe3a2" />
                  <stop offset="0.5" stopColor="#f0b85f" />
                  <stop offset="1" stopColor="#d9895a" />
                </linearGradient>
                <linearGradient id="levelup-face" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--primary)" />
                  <stop offset="1" stopColor="var(--tertiary)" />
                </linearGradient>
              </defs>
              <polygon points={ROSETTE} fill="url(#levelup-gold)" />
              <circle cx="60" cy="60" r="41" fill="url(#levelup-face)" />
              <circle cx="60" cy="60" r="41" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" />
              <path
                d="M28 48a34 34 0 0164 0"
                fill="none"
                stroke="#fff"
                strokeOpacity="0.25"
                strokeWidth="6"
              />
            </svg>
            <motion.span
              key={shown}
              className="levelup__number"
              initial={reduced ? false : { scale: 1.35 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', ...spring.bouncy }}
            >
              {shown}
            </motion.span>
          </motion.div>
        </div>
        <motion.p
          className="levelup__kicker"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          {tr(t('Nouveau niveau', 'Level up'))}
        </motion.p>
        <motion.h2
          className="levelup__title"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, type: 'spring', ...spring.gentle }}
        >
          {tr(t(`Niveau ${level}`, `Level ${level}`))}
        </motion.h2>
        {unlocks.length > 0 && (
          <div className="levelup__cards">
            {unlocks.map((r, i) => {
              const kind = unlockKind(r.key);
              const item = catalogItem(r.key);
              return (
                <motion.div
                  key={r.key}
                  className="levelup__card"
                  initial={reduced ? { opacity: 0 } : { rotateY: 180, opacity: 0, y: 16 }}
                  animate={{ rotateY: 0, opacity: 1, y: 0 }}
                  transition={{ delay: cardsAt + i * 0.14, type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <span className="levelup__card-icon">
                    <KindIcon kind={kind} />
                  </span>
                  <small>{tr(UNLOCK_KINDS[kind])}</small>
                  <strong>{item ? tr(item.name) : r.key}</strong>
                </motion.div>
              );
            })}
          </div>
        )}
        {others.length > 0 && (
          <div className="levelup__gifts">
            {others.map((r, i) => (
              <motion.span
                key={rewardLabel(r)}
                className="levelup__gift"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: cardsAt + (unlocks.length + i) * 0.1, type: 'spring', ...spring.bouncy }}
              >
                {rewardLabel(r)}
              </motion.span>
            ))}
          </div>
        )}
        <motion.button
          className="levelup__continue"
          initial={{ opacity: 0 }}
          animate={{ opacity: ready ? 1 : 0 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          {tr(t('Continuer', 'Continue'))}
        </motion.button>
      </div>
    </motion.div>
  );
}
