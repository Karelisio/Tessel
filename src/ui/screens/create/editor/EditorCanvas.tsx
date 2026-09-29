import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@/create/Editor';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useSettings } from '@/store/settings';
import { spring } from '@/theme/motion/tokens';
import { IconFit } from '../icons';
import { CanvasView, type ViewInfo } from './CanvasView';

/** Toile de dessin : le canvas est piloté par `CanvasView` (aucun rendu React pendant le dessin). */
export function EditorCanvas({ editor }: { editor: Editor }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<CanvasView | null>(null);
  const [info, setInfo] = useState<ViewInfo>({ zoom: 1, moved: false });
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const v = new CanvasView(editor, el, setInfo, () => useSettings.getState().reducedMotion);
    view.current = v;
    const dispose = v.attach();
    return () => {
      dispose();
      view.current = null;
    };
  }, [editor]);
  return (
    <div className="cr-stage">
      <canvas
        ref={canvas}
        className="cr-canvas"
        aria-label={tr(t('Toile de dessin', 'Drawing canvas'))}
        role="img"
      />
      <AnimatePresence>
        {info.moved && (
          <motion.button
            className="cr-recenter"
            aria-label={tr(t('Recentrer la toile', 'Recenter the canvas'))}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', ...spring.snappy }}
            onClick={() => {
              view.current?.reset();
            }}
          >
            <IconFit size={20} />
            <span>×{info.zoom.toFixed(1)}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
