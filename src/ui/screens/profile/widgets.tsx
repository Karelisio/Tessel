import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import { duration, easing, spring } from '@/theme/motion/tokens';
import { fmt } from './format';
import './profile.css';

/** Nombre qui monte doucement jusqu'à sa valeur. */
export function CountUp({ value, format = fmt }: { value: number; format?: (n: number) => string }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(reduced ? value : 0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: duration.xl / 1000 + 0.35, ease: easing.decelerate });
    return () => {
      controls.stop();
    };
  }, [value, reduced, mv]);
  return <motion.span>{text}</motion.span>;
}

/** Barre de progression (0–1) qui se remplit au ressort. */
export function Bar({
  value,
  tone = 'primary',
  label,
}: {
  value: number;
  tone?: 'primary' | 'done';
  label?: string;
}) {
  const v = Math.min(1, Math.max(0, value));
  return (
    <span
      className="pf-bar"
      data-tone={tone}
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(v * 100) : undefined}
    >
      <motion.span
        className="pf-bar__fill"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: v }}
        transition={{ type: 'spring', ...spring.gentle }}
      />
    </span>
  );
}
