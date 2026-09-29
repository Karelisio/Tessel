import { motion } from 'framer-motion';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { moveRect, resizeRect, type CropHandle, type NormRect } from './crop';
import { useSpringTransition } from './hooks';

/** Côté minimal (px écran) du cadre : les quatre poignées de 44 px restent saisissables. */
const MIN_BOX_PX = 76;
const HANDLES: readonly CropHandle[] = ['nw', 'ne', 'sw', 'se'];

type DragKind = 'move' | CropHandle;

interface Drag {
  id: number;
  kind: DragKind;
  x0: number;
  y0: number;
  rect: NormRect;
  /** Taille (px) de la zone photo à la prise : convertit les pixels en fraction de la photo. */
  fw: number;
  fh: number;
}

const percent = (v: number): string => `${v * 100}%`;

function place(r: NormRect) {
  return { left: percent(r.x), top: percent(r.y), width: percent(r.w), height: percent(r.h) };
}

interface CropBoxProps {
  rect: NormRect;
  /** Rapport largeur / hauteur normalisé imposé par le format choisi, `null` si libre. */
  ratio: number | null;
  /** Faux quand la vue « Aperçu » est affichée : le cadre n'est alors ni saisissable ni focalisable. */
  active: boolean;
  onChange: (rect: NormRect) => void;
}

/**
 * Cadre de recadrage posé sur la photo : glisser au centre pour déplacer, glisser un coin pour
 * redimensionner (Pointer Events, cibles de 44 px). Doit remplir la zone photo (`position: relative`).
 */
export function CropBox({ rect, ratio, active, onChange }: CropBoxProps) {
  const layer = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const spring = useSpringTransition('snappy');
  // pendant un glissé le cadre colle au doigt ; sinon (préréglage de format) il glisse avec un ressort
  const transition = dragging ? { duration: 0 } : spring;
  const box = place(rect);

  const start = (e: PointerEvent<HTMLElement>, kind: DragKind) => {
    if (!active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const bounds = layer.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      kind,
      x0: e.clientX,
      y0: e.clientY,
      rect,
      fw: bounds.width,
      fh: bounds.height,
    };
    setDragging(true);
  };

  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = (e.clientX - d.x0) / d.fw;
    const dy = (e.clientY - d.y0) / d.fh;
    onChange(
      d.kind === 'move'
        ? moveRect(d.rect, dx, dy)
        : resizeRect(d.rect, d.kind, dx, dy, {
            ratio,
            minW: Math.min(1, MIN_BOX_PX / d.fw),
            minH: Math.min(1, MIN_BOX_PX / d.fh),
          }),
    );
  };

  const end = (e: PointerEvent<HTMLElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const d = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
      ArrowUp: [0, -d],
      ArrowDown: [0, d],
    };
    const delta = moves[e.key];
    if (!delta) return;
    e.preventDefault();
    onChange(moveRect(rect, delta[0], delta[1]));
  };

  return (
    <div ref={layer} className="imp-crop" aria-hidden={!active}>
      {/* assombrit ce qui est hors du cadre, sans déborder de la photo */}
      <div className="imp-crop__clip">
        <motion.div className="imp-crop__shade" initial={false} animate={box} transition={transition} />
      </div>
      <motion.div
        className="imp-crop__box"
        role="group"
        aria-label="Zone de recadrage"
        tabIndex={active ? 0 : -1}
        data-dragging={dragging ? '' : undefined}
        initial={false}
        animate={box}
        transition={transition}
        onPointerDown={(e) => {
          start(e, 'move');
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={onKeyDown}
      >
        <span className="imp-crop__guides" aria-hidden />
        {HANDLES.map((h) => (
          <motion.div
            key={h}
            className="imp-crop__handle"
            data-h={h}
            whileTap={{ scale: 1.22 }}
            transition={spring}
            onPointerDown={(e) => {
              start(e, h);
            }}
          >
            <span className="imp-crop__grip" />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
