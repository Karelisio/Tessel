import { motion } from 'framer-motion';
import { useSpringTransition } from './hooks';

interface SegmentedProps<T extends string> {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  /** Nom du groupe pour les lecteurs d'écran. */
  label: string;
  /** `segmented` : boutons joints dans une pastille ; `chips` : pastilles séparées. */
  variant: 'segmented' | 'chips';
  /** Identifiant du fond mobile (unique par groupe). */
  layoutId: string;
}

/** Choix exclusif : le fond de la sélection glisse d'une option à l'autre (ressort de la charte). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  variant,
  layoutId,
}: SegmentedProps<T>) {
  const transition = useSpringTransition('snappy');
  return (
    <div className={`imp-seg imp-seg--${variant}`} role="group" aria-label={label}>
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            className="imp-seg__btn"
            aria-pressed={selected}
            onClick={() => {
              onChange(o.id);
            }}
          >
            {selected && <motion.span layoutId={layoutId} className="imp-seg__bg" transition={transition} />}
            <motion.span className="imp-seg__text" whileTap={{ scale: 0.94 }}>
              {o.label}
            </motion.span>
          </button>
        );
      })}
    </div>
  );
}
