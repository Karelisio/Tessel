import { motion } from 'framer-motion';
import { useId, useState } from 'react';
import { useSpringTransition } from './hooks';

interface SwitchProps {
  label: string;
  /** Précision affichée sous le libellé. */
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Interrupteur (piste + pouce, inspiré de Material 3) : toute la ligne est cliquable. */
export function Switch({ label, hint, checked, onChange, disabled = false }: SwitchProps) {
  const hintId = useId();
  const [pressed, setPressed] = useState(false);
  const transition = useSpringTransition('snappy');
  const release = () => {
    setPressed(false);
  };
  return (
    <button
      type="button"
      role="switch"
      className="imp-switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={hint ? hintId : undefined}
      disabled={disabled}
      onClick={() => {
        onChange(!checked);
      }}
      onPointerDown={() => {
        setPressed(true);
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    >
      <span className="imp-switch__text">
        <span className="imp-switch__label">{label}</span>
        {hint && (
          <span id={hintId} className="imp-switch__hint">
            {hint}
          </span>
        )}
      </span>
      <span className="imp-switch__track" data-on={checked ? '' : undefined}>
        <motion.span
          className="imp-switch__thumb"
          initial={false}
          animate={{ x: checked ? 20 : 0 }}
          transition={transition}
        >
          {/* 16 px éteint, 24 px allumé, 28 px pendant l'appui (28 × échelle) */}
          <motion.span
            className="imp-switch__dot"
            initial={false}
            animate={{ scale: pressed ? 1 : checked ? 24 / 28 : 16 / 28 }}
            transition={transition}
          />
        </motion.span>
      </span>
    </button>
  );
}
