import { motion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useSpringTransition } from './hooks';
import { clamp, snapValue } from './math';

/** Marge horizontale de la piste : le pouce reste entièrement dans la zone. */
const PAD = 16;
/** Déplacement (px) à partir duquel un toucher devient un glissé horizontal (sinon : défilement ou tap). */
const SLOP = 8;

interface Gesture {
  id: number;
  startX: number;
  startY: number;
  /** `pending` : toucher sur la piste, pas encore décidé entre glissé et défilement du panneau. */
  mode: 'pending' | 'drag';
  /** Écart entre le doigt et le centre du pouce à la prise : le pouce ne saute pas sous le doigt. */
  grab: number;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Valeur affichée à droite du libellé. */
  valueText: string;
  /** Valeur d'où part le remplissage (0 pour un curseur centré) ; par défaut `min`. */
  origin?: number;
  disabled?: boolean;
  /** Précision affichée sous le curseur. */
  hint?: string;
}

/**
 * Curseur personnalisé (piste + pouce, inspiré de Material 3). Souris : la piste saute sous le clic.
 * Tactile : un glissé horizontal règle la valeur, un défilement vertical fait défiler le panneau
 * sans rien modifier, un simple tap sur la piste place le pouce.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  valueText,
  origin,
  disabled = false,
  hint,
}: SliderProps) {
  const labelId = useId();
  const control = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [pressed, setPressed] = useState(false);
  const transition = useSpringTransition('snappy');

  const span = max - min;
  const pos = clamp((value - min) / span, 0, 1);
  const from = clamp(((origin ?? min) - min) / span, 0, 1);

  /** Abscisse du centre du pouce (px écran) et valeur sous une abscisse donnée. */
  const geometry = () => {
    const box = control.current?.getBoundingClientRect();
    const inner = Math.max(1, (box?.width ?? 0) - 2 * PAD);
    const left = (box?.left ?? 0) + PAD;
    return {
      thumbX: left + pos * inner,
      valueAt: (clientX: number) =>
        snapValue(min + clamp((clientX - left) / inner, 0, 1) * span, min, max, step),
    };
  };

  // dernière valeur émise : plusieurs déplacements peuvent arriver avant le rendu suivant
  const last = useRef(value);
  useEffect(() => {
    last.current = value;
  }, [value]);
  const commit = (v: number) => {
    if (v === last.current) return;
    last.current = v;
    onChange(v);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const onThumb = e.target instanceof Element && e.target.closest('.imp-slider__thumb') !== null;
    const { thumbX, valueAt } = geometry();
    const immediate = e.pointerType !== 'touch' || onThumb;
    gesture.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      mode: immediate ? 'drag' : 'pending',
      grab: onThumb ? e.clientX - thumbX : 0,
    };
    if (immediate) {
      setPressed(true);
      if (!onThumb) commit(valueAt(e.clientX));
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    if (g.mode === 'pending') {
      const dx = Math.abs(e.clientX - g.startX);
      if (dx < SLOP || dx < Math.abs(e.clientY - g.startY)) return;
      g.mode = 'drag';
      setPressed(true);
    }
    commit(geometry().valueAt(e.clientX - g.grab));
  };

  const finish = (e: PointerEvent<HTMLDivElement>, apply: boolean) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    setPressed(false);
    // simple tap sur la piste : le pouce va à l'endroit touché
    if (apply && g.mode === 'pending') commit(geometry().valueAt(e.clientX));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const page = step * Math.max(1, Math.round(span / step / 10));
    let next: number;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - step;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + step;
        break;
      case 'PageDown':
        next = value - page;
        break;
      case 'PageUp':
        next = value + page;
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    commit(snapValue(next, min, max, step));
  };

  return (
    <div className="imp-slider" data-disabled={disabled ? '' : undefined}>
      <div className="imp-slider__head">
        <span id={labelId} className="imp-slider__label">
          {label}
        </span>
        <span className="imp-slider__value">{valueText}</span>
      </div>
      <div
        ref={control}
        className="imp-slider__control"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => {
          finish(e, true);
        }}
        onPointerCancel={(e) => {
          finish(e, false);
        }}
        onLostPointerCapture={(e) => {
          finish(e, false);
        }}
      >
        <div className="imp-slider__rail">
          <div
            className="imp-slider__fill"
            style={{ left: `${Math.min(pos, from) * 100}%`, width: `${Math.abs(pos - from) * 100}%` }}
          />
        </div>
        <div
          className="imp-slider__thumb"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby={labelId}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueText}
          aria-disabled={disabled}
          style={{ left: `calc(${PAD}px + (100% - ${2 * PAD}px) * ${pos})` }}
          onKeyDown={onKeyDown}
        >
          <motion.span
            className="imp-slider__halo"
            initial={false}
            animate={{ scale: pressed ? 1 : 0.4, opacity: pressed ? 1 : 0 }}
            transition={transition}
          />
          <motion.span
            className="imp-slider__knob"
            initial={false}
            animate={{ scale: pressed ? 1.2 : 1 }}
            transition={transition}
          />
        </div>
      </div>
      {hint && <div className="imp-slider__hint">{hint}</div>}
    </div>
  );
}
