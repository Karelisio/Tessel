import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MAX_LAYERS } from '@/create/document';
import type { Editor } from '@/create/Editor';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { spring } from '@/theme/motion/tokens';
import { Sheet } from '@/ui/kit';
import { IconDown, IconEye, IconEyeOff, IconMerge, IconPlus, IconRename, IconTrash, IconUp } from '../icons';
import { fitBox, layerRgba, paintPixels } from '../render';
import type { EditorSnap } from './snap';

const THUMB = 52;

/** Miniature d'un calque, redessinée quand le calque change. */
function LayerThumb({ editor, index }: { editor: Editor; index: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const layer = editor.doc.layers[index];
      if (!layer) return;
      paintPixels(
        el,
        { w: editor.doc.width, h: editor.doc.height, rgba: layerRgba(layer, editor.doc.palette) },
        THUMB * 2,
      );
    };
    paint();
    const off = editor.on(() => {
      if (!raf) raf = requestAnimationFrame(paint);
    });
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, [editor, index]);
  const size = fitBox(editor.doc.width, editor.doc.height, THUMB);
  return (
    <span className="cr-layer__thumb cr-checker" aria-hidden>
      <canvas ref={canvas} style={{ width: size.width, height: size.height }} />
    </span>
  );
}

function Act({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <motion.button
      className="cr-layer-act"
      data-danger={danger}
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}

/** Calques : ajouter, réordonner, fusionner, masquer, renommer, supprimer (4 au plus). */
export function LayersSheet({
  open,
  onClose,
  editor,
  snap,
}: {
  open: boolean;
  onClose: () => void;
  editor: Editor;
  snap: EditorSnap;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const layers = snap.layers;
  const full = layers.length >= MAX_LAYERS;
  // du haut vers le bas, comme on les voit empilés
  const order = layers.map((_, i) => i).reverse();
  const finishRename = (index: number) => {
    editor.renameLayer(index, draft);
    setRenaming(null);
  };
  return (
    <Sheet open={open} onClose={onClose} label={tr(t('Calques', 'Layers'))}>
      <div className="cr-layers-head">
        <div>
          <h3>{tr(t('Calques', 'Layers'))}</h3>
          <p>
            {layers.length} / {MAX_LAYERS}
          </p>
        </div>
        <motion.button
          className="cr-pill"
          disabled={full}
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            editor.addLayer(`${tr(t('Calque', 'Layer'))} ${String(layers.length + 1)}`);
          }}
        >
          <IconPlus size={18} />
          {full ? tr(t('4 au maximum', '4 at most')) : tr(t('Ajouter', 'Add'))}
        </motion.button>
      </div>
      <ul className="cr-layers">
        <AnimatePresence initial={false}>
          {order.map((i) => {
            const layer = layers[i];
            if (!layer) return null;
            const active = snap.active === i;
            return (
              <motion.li
                key={layer.id}
                layout
                className="cr-layer"
                data-active={active}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: 'spring', ...spring.gentle }}
              >
                <div className="cr-layer__row">
                  <button
                    className="cr-layer__main"
                    aria-pressed={active}
                    aria-label={`${layer.name}${active ? `, ${tr(t('calque actif', 'active layer'))}` : ''}`}
                    onClick={() => {
                      editor.setActive(i);
                    }}
                  >
                    <LayerThumb editor={editor} index={i} />
                    <span className="cr-layer__name">
                      {renaming === layer.id ? null : <strong>{layer.name}</strong>}
                      <small>
                        {active
                          ? tr(t('Calque actif', 'Active layer'))
                          : i === layers.length - 1
                            ? tr(t('Dessus', 'Top'))
                            : i === 0
                              ? tr(t('Dessous', 'Bottom'))
                              : ' '}
                      </small>
                    </span>
                  </button>
                  {renaming === layer.id && (
                    <input
                      className="cr-layer__input"
                      value={draft}
                      maxLength={24}
                      autoFocus
                      aria-label={tr(t('Nom du calque', 'Layer name'))}
                      onChange={(e) => {
                        setDraft(e.target.value);
                      }}
                      onBlur={() => {
                        finishRename(i);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                    />
                  )}
                  <motion.button
                    className="cr-layer__eye"
                    aria-label={
                      layer.visible
                        ? tr(t('Masquer le calque', 'Hide layer'))
                        : tr(t('Afficher le calque', 'Show layer'))
                    }
                    aria-pressed={layer.visible}
                    whileTap={{ scale: 0.86 }}
                    onClick={() => {
                      editor.toggleVisible(i);
                    }}
                  >
                    {layer.visible ? <IconEye size={22} /> : <IconEyeOff size={22} />}
                  </motion.button>
                </div>
                <AnimatePresence initial={false}>
                  {active && (
                    <motion.div
                      className="cr-layer__acts"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', ...spring.gentle }}
                    >
                      <div className="cr-layer__acts-in">
                        <Act
                          icon={<IconUp size={18} />}
                          label={tr(t('Monter', 'Up'))}
                          disabled={i >= layers.length - 1}
                          onClick={() => {
                            editor.moveLayer(i, i + 1);
                          }}
                        />
                        <Act
                          icon={<IconDown size={18} />}
                          label={tr(t('Descendre', 'Down'))}
                          disabled={i === 0}
                          onClick={() => {
                            editor.moveLayer(i, i - 1);
                          }}
                        />
                        <Act
                          icon={<IconMerge size={18} />}
                          label={tr(t('Fusionner', 'Merge down'))}
                          disabled={i === 0}
                          onClick={() => {
                            editor.mergeDown(i);
                          }}
                        />
                        <Act
                          icon={<IconRename size={18} />}
                          label={tr(t('Renommer', 'Rename'))}
                          onClick={() => {
                            setDraft(layer.name);
                            setRenaming(layer.id);
                          }}
                        />
                        <Act
                          icon={<IconTrash size={18} />}
                          label={tr(t('Supprimer', 'Delete'))}
                          danger
                          disabled={layers.length <= 1}
                          onClick={() => {
                            editor.removeLayer(i);
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <p className="cr-layers-hint">
        {tr(
          t(
            'Chaque calque se dessine à part ; ils s’empilent, et seuls les calques visibles comptent dans l’œuvre.',
            'Each layer is drawn separately; they stack, and only visible layers count in the artwork.',
          ),
        )}
      </p>
    </Sheet>
  );
}
