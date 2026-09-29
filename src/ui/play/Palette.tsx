import { AnimatePresence, motion } from 'framer-motion';
import { memo, useEffect, useRef } from 'react';
import { luminance, rgbToHex, type Rgb } from '@/content/grid';
import { useSettings } from '@/store/settings';
import { spring } from '@/theme/motion/tokens';
import { ColorPattern } from './patterns';

interface SwatchProps {
  index: number;
  color: Rgb;
  remaining: number;
  total: number;
  selected: boolean;
  onSelect: (i: number) => void;
}

const R = 26;
const CIRC = 2 * Math.PI * R;

const Swatch = memo(function Swatch({ index, color, remaining, total, selected, onSelect }: SwatchProps) {
  const done = remaining === 0;
  const progress = total > 0 ? 1 - remaining / total : 1;
  const hex = rgbToHex(color);
  const dark = luminance(color) < 0.35;
  const patterns = useSettings((st) => st.colorblind);
  return (
    <motion.button
      className="swatch"
      aria-label={`Couleur ${index + 1}${done ? ', terminée' : ''}`}
      aria-pressed={selected}
      onClick={() => {
        onSelect(index);
      }}
      animate={{ y: selected ? -8 : 0, scale: selected ? 1.08 : 1 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', ...spring.bouncy }}
    >
      <svg className="swatch__ring" viewBox="0 0 58 58" aria-hidden>
        <circle cx="29" cy="29" r={R} fill="none" stroke="var(--outline)" strokeWidth="3" />
        <motion.circle
          cx="29"
          cy="29"
          r={R}
          fill="none"
          stroke={hex}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          initial={false}
          animate={{ strokeDashoffset: CIRC * (1 - progress) }}
          transition={{ type: 'spring', ...spring.gentle }}
        />
      </svg>
      <motion.div
        className="swatch__disc"
        style={{ background: hex, color: dark ? '#fff' : 'rgba(40,30,40,0.75)' }}
        animate={{ boxShadow: selected ? 'var(--shadow-lift)' : '0 0 0 rgba(0,0,0,0)' }}
      >
        {patterns && (
          <ColorPattern
            className="swatch__pattern"
            index={index}
            ink={dark ? 'rgba(255,255,255,0.5)' : 'rgba(30,20,30,0.3)'}
          />
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          {done ? (
            <motion.svg
              key="check"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', ...spring.bouncy }}
            >
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.32, delay: 0.08 }}
              />
            </motion.svg>
          ) : (
            <motion.span key="num" exit={{ scale: 0, opacity: 0 }}>
              {index + 1}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      {!done && <span className="swatch__count">{remaining}</span>}
    </motion.button>
  );
});

interface PaletteProps {
  palette: readonly Rgb[];
  remaining: readonly number[];
  totals: readonly number[];
  selected: number;
  onSelect: (i: number) => void;
}

export function Palette({ palette, remaining, totals, selected, onSelect }: PaletteProps) {
  const track = useRef<HTMLDivElement>(null);

  // garde la couleur active visible
  useEffect(() => {
    const el = track.current?.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selected]);

  return (
    <div className="palette">
      <div className="palette__track" ref={track}>
        {palette.map((c, i) => (
          <Swatch
            key={i}
            index={i}
            color={c}
            remaining={remaining[i] ?? 0}
            total={totals[i] ?? 0}
            selected={i === selected}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
