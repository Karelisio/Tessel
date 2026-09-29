import { AnimatePresence, motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import type { Editor, Symmetry, Tool } from '@/create/Editor';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { spring } from '@/theme/motion/tokens';
import {
  IconBrush,
  IconBucket,
  IconEraser,
  IconLayers,
  IconPencil,
  IconPipette,
  IconSymmetry,
} from '../icons';
import type { EditorSnap } from './snap';

const TOOLS: readonly { id: Tool; icon: ReactNode; label: () => string }[] = [
  { id: 'pencil', icon: <IconPencil size={22} />, label: () => tr(t('Crayon', 'Pencil')) },
  { id: 'eraser', icon: <IconEraser size={22} />, label: () => tr(t('Gomme', 'Eraser')) },
  { id: 'bucket', icon: <IconBucket size={22} />, label: () => tr(t('Pot de peinture', 'Paint bucket')) },
  { id: 'eyedropper', icon: <IconPipette size={22} />, label: () => tr(t('Pipette', 'Eyedropper')) },
];

const SYMMETRIES: readonly { id: Symmetry; label: () => string }[] = [
  { id: 'none', label: () => tr(t('Aucune', 'None')) },
  { id: 'x', label: () => tr(t('Verticale', 'Vertical')) },
  { id: 'y', label: () => tr(t('Horizontale', 'Horizontal')) },
  { id: 'xy', label: () => tr(t('Les deux', 'Both')) },
];

const BRUSHES = [1, 2, 3] as const;

type Panel = 'symmetry' | 'brush' | null;

/** Rangée d'outils : crayon, gomme, pot, pipette, symétrie, pinceau, calques. */
export function Toolbar({
  editor,
  snap,
  onLayers,
}: {
  editor: Editor;
  snap: EditorSnap;
  onLayers: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (p: Exclude<Panel, null>) => {
    setPanel((cur) => (cur === p ? null : p));
  };
  const symLabel = SYMMETRIES.find((s) => s.id === snap.symmetry)?.label() ?? '';
  return (
    <div className="cr-tools">
      <AnimatePresence>
        {panel && (
          <>
            <div
              className="cr-options-scrim"
              onPointerDown={() => {
                setPanel(null);
              }}
            />
            <motion.div
              key={panel}
              className="cr-options"
              role="group"
              aria-label={panel === 'symmetry' ? tr(t('Symétrie', 'Symmetry')) : tr(t('Pinceau', 'Brush'))}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: 'spring', ...spring.snappy }}
            >
              {panel === 'symmetry' &&
                SYMMETRIES.map((s) => (
                  <motion.button
                    key={s.id}
                    className="cr-option"
                    aria-pressed={snap.symmetry === s.id}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      editor.setSymmetry(s.id);
                      setPanel(null);
                    }}
                  >
                    <IconSymmetry kind={s.id} size={26} />
                    <span>{s.label()}</span>
                  </motion.button>
                ))}
              {panel === 'brush' &&
                BRUSHES.map((n) => (
                  <motion.button
                    key={n}
                    className="cr-option"
                    aria-pressed={snap.brush === n}
                    aria-label={`${tr(t('Pinceau', 'Brush'))} ${String(n)}×${String(n)}`}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      editor.setBrush(n);
                      setPanel(null);
                    }}
                  >
                    <IconBrush n={n} size={26} />
                    <span>
                      {n}×{n}
                    </span>
                  </motion.button>
                ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="cr-toolgroup" role="group" aria-label={tr(t('Outils', 'Tools'))}>
        {TOOLS.map((tool) => {
          const on = snap.tool === tool.id;
          return (
            <motion.button
              key={tool.id}
              className="cr-tool"
              aria-pressed={on}
              aria-label={tool.label()}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', ...spring.snappy }}
              onClick={() => {
                editor.setTool(tool.id);
              }}
            >
              {on && (
                <motion.span
                  layoutId="cr-tool-bg"
                  className="cr-tool__bg"
                  transition={{ type: 'spring', ...spring.snappy }}
                />
              )}
              <span className="cr-tool__icon">{tool.icon}</span>
            </motion.button>
          );
        })}
      </div>

      <motion.button
        className="cr-tool cr-tool--solo"
        aria-label={`${tr(t('Symétrie', 'Symmetry'))} : ${symLabel}`}
        aria-expanded={panel === 'symmetry'}
        data-active={snap.symmetry !== 'none'}
        whileTap={{ scale: 0.88 }}
        onClick={() => {
          toggle('symmetry');
        }}
      >
        <span className="cr-tool__icon">
          <IconSymmetry kind={snap.symmetry} size={22} />
        </span>
      </motion.button>
      <motion.button
        className="cr-tool cr-tool--solo"
        aria-label={`${tr(t('Taille du pinceau', 'Brush size'))} : ${String(snap.brush)}`}
        aria-expanded={panel === 'brush'}
        data-active={snap.brush > 1}
        whileTap={{ scale: 0.88 }}
        onClick={() => {
          toggle('brush');
        }}
      >
        <span className="cr-tool__icon">
          <IconBrush n={snap.brush as 1 | 2 | 3} size={22} />
        </span>
      </motion.button>

      <span className="cr-tools__fill" />

      <motion.button
        className="cr-tool cr-tool--solo cr-tool--layers"
        aria-label={`${tr(t('Calques', 'Layers'))} (${String(snap.layers.length)})`}
        whileTap={{ scale: 0.88 }}
        onClick={onLayers}
      >
        <span className="cr-tool__icon">
          <IconLayers size={22} />
        </span>
        <span className="cr-badge">{snap.layers.length}</span>
      </motion.button>
    </div>
  );
}
