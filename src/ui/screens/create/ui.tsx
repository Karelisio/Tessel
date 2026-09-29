import { motion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { spring } from '@/theme/motion/tokens';
import { Button, Sheet } from '@/ui/kit';
import { fitBox, paintPixels, type Pixels } from './render';

/** Vignette nette d'une image de pixels, posée sur un damier (transparence). `box="fill"` : largeur du parent. */
export function PixelThumb({
  pixels,
  box,
  radius = 14,
  className = '',
}: {
  pixels: Pixels | null;
  box: number | 'fill';
  radius?: number;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = box === 'fill' ? 300 : box;
  useEffect(() => {
    const el = canvas.current;
    if (!el || !pixels) return;
    paintPixels(el, pixels, target * Math.min(3, window.devicePixelRatio || 1));
  }, [pixels, target]);
  const wide = !pixels || pixels.w >= pixels.h;
  const style =
    box === 'fill'
      ? wide
        ? { width: '100%', height: 'auto' }
        : { height: '100%', width: 'auto' }
      : pixels
        ? fitBox(pixels.w, pixels.h, box)
        : undefined;
  return (
    <span
      className={`cr-thumb cr-checker ${box === 'fill' ? 'cr-thumb--fill' : ''} ${className}`}
      style={box === 'fill' ? { borderRadius: radius } : { width: box, height: box, borderRadius: radius }}
      aria-hidden
    >
      {pixels ? <canvas ref={canvas} style={style} /> : <span className="cr-thumb__wait" />}
    </span>
  );
}

/** Ligne d'action (menus en feuille) ; `tone="danger"` pour ce qui supprime. */
export function ActionRow({
  icon,
  label,
  hint,
  tone = 'normal',
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  tone?: 'normal' | 'danger';
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      className="cr-action"
      data-tone={tone}
      disabled={disabled}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', ...spring.snappy }}
      onClick={onClick}
    >
      <span className="cr-action__icon">{icon}</span>
      <span className="cr-action__text">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </motion.button>
  );
}

/** Confirmation en feuille : douce, avec une issue claire. */
export function ConfirmSheet({
  open,
  onClose,
  title,
  text,
  confirm,
  cancel,
  danger = false,
  onConfirm,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  confirm: string;
  cancel: string;
  danger?: boolean;
  onConfirm: () => void;
  /** Troisième issue (par exemple « Ne rien garder »). */
  extra?: { label: string; onClick: () => void };
}) {
  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <div className="cr-confirm">
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="cr-confirm__buttons">
          <Button variant={danger ? 'tonal' : 'filled'} onClick={onConfirm}>
            <span className={danger ? 'cr-danger' : undefined}>{confirm}</span>
          </Button>
          {extra && (
            <Button variant="tonal" onClick={extra.onClick}>
              {extra.label}
            </Button>
          )}
          <Button variant={danger ? 'filled' : 'text'} onClick={onClose}>
            {cancel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
