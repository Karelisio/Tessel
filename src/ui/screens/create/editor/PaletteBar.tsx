import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { MAX_COLORS } from '@/content/grid';
import type { Editor } from '@/create/Editor';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { spring } from '@/theme/motion/tokens';
import { css, inkOn } from '../color';
import { IconPalette, IconPlus } from '../icons';
import type { EditorSnap } from './snap';

const LONG_PRESS = 420;

/** Palette en bas : couleur active soulevée, appui long (ou second appui) pour la modifier. */
export function PaletteBar({
  editor,
  snap,
  onEdit,
  onAdd,
  onSwitch,
}: {
  editor: Editor;
  snap: EditorSnap;
  onEdit: (index: number) => void;
  onAdd: () => void;
  onSwitch: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);

  // la couleur choisie (pipette, ajout…) reste visible dans la rangée
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!box || !el) return;
    const target = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    box.scrollTo({ left: target, behavior: 'smooth' });
  }, [snap.color]);

  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
  };

  return (
    <div className="cr-palette">
      <motion.button
        className="cr-palette__switch"
        aria-label={tr(t('Changer de palette', 'Change palette'))}
        whileTap={{ scale: 0.9 }}
        onClick={onSwitch}
      >
        <IconPalette size={22} />
      </motion.button>
      <div
        className="cr-palette__scroll"
        ref={scroller}
        role="listbox"
        aria-label={tr(t('Couleurs', 'Colors'))}
      >
        {snap.palette.map((color, i) => {
          const selected = snap.color === i && snap.tool !== 'eraser';
          return (
            <motion.button
              key={i}
              className="cr-swatch"
              role="option"
              aria-selected={selected}
              aria-pressed={selected}
              aria-label={`${tr(t('Couleur', 'Color'))} ${String(i + 1)}`}
              animate={{ y: selected ? -6 : 0, scale: selected ? 1.12 : 1 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', ...spring.bouncy }}
              onPointerDown={(e) => {
                cancel();
                press.current = {
                  x: e.clientX,
                  y: e.clientY,
                  fired: false,
                  timer: window.setTimeout(() => {
                    if (press.current) press.current.fired = true;
                    if ('vibrate' in navigator) navigator.vibrate(12);
                    onEdit(i);
                  }, LONG_PRESS),
                };
              }}
              onPointerMove={(e) => {
                const p = press.current;
                if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancel();
              }}
              onPointerUp={cancel}
              onPointerCancel={cancel}
              onPointerLeave={cancel}
              onContextMenu={(e) => {
                e.preventDefault();
              }}
              onClick={() => {
                if (press.current?.fired) {
                  press.current = null;
                  return;
                }
                if (selected) onEdit(i);
                else editor.setColor(i);
              }}
            >
              <span
                className="cr-swatch__disc"
                style={{ background: css(color), color: inkOn(color) }}
                data-selected={selected}
              >
                {selected && <span className="cr-swatch__dot" />}
              </span>
            </motion.button>
          );
        })}
        <motion.button
          className="cr-swatch cr-swatch--add"
          aria-label={
            snap.palette.length >= MAX_COLORS
              ? tr(t('64 couleurs au maximum', '64 colors at most'))
              : tr(t('Ajouter une couleur', 'Add a color'))
          }
          whileTap={{ scale: 0.9 }}
          onClick={onAdd}
        >
          <span className="cr-swatch__disc cr-swatch__disc--add">
            <IconPlus size={18} />
          </span>
        </motion.button>
      </div>
    </div>
  );
}
