import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { getServices } from '@/app/services';
import type { Rgb } from '@/content/grid';
import { MAX_COLORS } from '@/content/grid';
import { paintedCount, type CreationDoc } from '@/create/document';
import { Editor } from '@/create/Editor';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useNav } from '@/store/nav';
import { spring } from '@/theme/motion/tokens';
import { IconButton } from '@/ui/kit';
import { useBackClose } from '@/ui/kit/backClose';
import { IconBack, IconPlay } from '@/ui/kit/icons';
import { IconRedo, IconShare, IconUndo } from '../icons';
import { usePlayFlow } from '../usePlayFlow';
import { ShareSheet, type ShareSource } from '../ShareSheet';
import { useEditorStore } from '../store';
import { ConfirmSheet } from '../ui';
import { useToast } from '../useToast';
import { useAutosave, type SaveStatus } from './autosave';
import { ColorSheet, type ColorTarget } from './ColorSheet';
import { EditorCanvas } from './EditorCanvas';
import { LayersSheet } from './LayersSheet';
import { PaletteBar } from './PaletteBar';
import { PaletteSheet } from './PaletteSheet';
import { useEditorSnap } from './snap';
import { Toolbar } from './Toolbar';

export interface EditorInitial {
  id: string | null;
  title: string;
  doc: CreationDoc;
  createdAt: number;
}

const statusText = (s: SaveStatus, fresh: boolean): string => {
  switch (s) {
    case 'saved':
      return tr(t('Enregistré', 'Saved'));
    case 'saving':
      return tr(t('Enregistrement…', 'Saving…'));
    case 'pending':
      return tr(t('Modifié', 'Edited'));
    case 'error':
      return tr(t('Non enregistré, nouvel essai…', 'Not saved, retrying…'));
    default:
      return fresh ? tr(t('Nouvelle toile', 'New canvas')) : '';
  }
};

const hasPaint = (e: Editor) => e.doc.layers.some((l) => l.cells.some((v) => v !== 0));

/** Éditeur plein écran : barre du haut, toile, outils, palette, et toutes ses feuilles. */
export default function EditorView({ initial }: { initial: EditorInitial }) {
  const [editor] = useState(() => new Editor(initial.doc));
  const snap = useEditorSnap(editor);
  const [title, setTitle] = useState(initial.title);
  const titleRef = useRef(initial.title);
  const { status, hasId, markDirty, flush, id } = useAutosave(editor, initial.id, titleRef);
  const { notify, toast } = useToast();
  const play = usePlayFlow(notify);
  const playing = useNav((s) => s.playing);

  const [layersOpen, setLayersOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [colorTarget, setColorTarget] = useState<ColorTarget | null>(null);
  const [share, setShare] = useState<ShareSource | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [hint, setHint] = useState(() => !hasPaint(editor));

  // l'astuce disparaît dès le premier trait
  useEffect(() => {
    if (!hint) return;
    return editor.on(() => {
      if (hasPaint(editor)) setHint(false);
    });
  }, [editor, hint]);

  const exit = () => {
    useEditorStore.getState().close();
  };
  const requestExit = () => {
    if (paintedCount(editor.doc) === 0) {
      setConfirmEmpty(true);
      return;
    }
    void flush().finally(exit);
  };
  // retour Android : quitte l'éditeur (le jeu, lui, garde la main quand il est ouvert)
  useBackClose(!playing, requestExit);

  const discard = () => {
    setConfirmEmpty(false);
    const current = id.current;
    if (current === null) {
      exit();
      return;
    }
    void getServices()
      .then((s) => s.creations.remove(current))
      .catch(() => undefined)
      .finally(exit);
  };

  const applyColor = (color: Rgb) => {
    if (!colorTarget) return;
    if (colorTarget.kind === 'edit') editor.setPaletteColor(colorTarget.index, color);
    else editor.addColor(color);
  };

  const name = title.trim() || tr(t('Sans titre', 'Untitled'));
  const fresh = !hasId;

  return (
    <div className="cr-view" data-testid="cr-editor">
      <header className="cr-top">
        <IconButton label={tr(t('Retour', 'Back'))} onClick={requestExit}>
          <IconBack />
        </IconButton>
        <div className="cr-top__title">
          <input
            className="cr-title"
            value={title}
            maxLength={60}
            placeholder={tr(t('Sans titre', 'Untitled'))}
            aria-label={tr(t('Titre de la création', 'Creation title'))}
            enterKeyHint="done"
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            onChange={(e) => {
              setTitle(e.target.value);
              titleRef.current = e.target.value.trim() || tr(t('Sans titre', 'Untitled'));
              markDirty();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          <small className="cr-status" aria-live="polite" data-status={status}>
            <span className="cr-status__dot" aria-hidden />
            {statusText(status, fresh)}
            <span className="cr-status__size">
              {' · '}
              {editor.doc.width}×{editor.doc.height}
            </span>
          </small>
        </div>
        <IconButton
          label={tr(t('Annuler', 'Undo'))}
          disabled={!snap.canUndo}
          onClick={() => {
            editor.undo();
          }}
        >
          <IconUndo size={22} />
        </IconButton>
        <IconButton
          label={tr(t('Rétablir', 'Redo'))}
          disabled={!snap.canRedo}
          onClick={() => {
            editor.redo();
          }}
        >
          <IconRedo size={22} />
        </IconButton>
        <motion.button
          className="cr-play"
          aria-label={tr(t('Jouer', 'Play'))}
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', ...spring.snappy }}
          onClick={() => {
            play.start(name, editor.doc, flush);
          }}
        >
          <IconPlay size={20} />
        </motion.button>
        <IconButton
          label={tr(t('Partager', 'Share'))}
          onClick={() => {
            setShare({ title: name, doc: editor.doc, createdAt: initial.createdAt });
          }}
        >
          <IconShare size={22} />
        </IconButton>
      </header>

      <div className="cr-main">
        <EditorCanvas editor={editor} />
        {hint && (
          <div className="cr-hint-wrap">
            <motion.p
              className="cr-hint"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {tr(
                t(
                  'Touche la toile pour peindre. Pince à deux doigts pour zoomer.',
                  'Touch the canvas to paint. Pinch with two fingers to zoom.',
                ),
              )}
            </motion.p>
          </div>
        )}
      </div>

      <div className="cr-dock">
        <Toolbar
          editor={editor}
          snap={snap}
          onLayers={() => {
            setLayersOpen(true);
          }}
        />
        <PaletteBar
          editor={editor}
          snap={snap}
          onEdit={(index) => {
            const color = snap.palette[index];
            if (color) setColorTarget({ kind: 'edit', index, color });
          }}
          onAdd={() => {
            if (snap.palette.length >= MAX_COLORS) {
              notify(tr(t('64 couleurs au maximum.', '64 colors at most.')), 'soft');
              return;
            }
            setColorTarget({ kind: 'add', color: snap.palette[snap.color] ?? [200, 120, 160] });
          }}
          onSwitch={() => {
            setPaletteOpen(true);
          }}
        />
      </div>

      <LayersSheet
        open={layersOpen}
        onClose={() => {
          setLayersOpen(false);
        }}
        editor={editor}
        snap={snap}
      />
      <PaletteSheet
        open={paletteOpen}
        onClose={() => {
          setPaletteOpen(false);
        }}
        editor={editor}
        onApplied={(n) => {
          notify(`${tr(t('Palette', 'Palette'))} « ${n} » ${tr(t('appliquée', 'applied'))}`);
        }}
      />
      <ColorSheet
        target={colorTarget}
        onClose={() => {
          setColorTarget(null);
        }}
        onApply={applyColor}
      />
      <ShareSheet
        source={share}
        notify={notify}
        onClose={() => {
          setShare(null);
        }}
      />
      {play.sheet}
      <ConfirmSheet
        open={confirmEmpty}
        onClose={() => {
          setConfirmEmpty(false);
        }}
        danger
        title={tr(t('Rien n’est encore peint', 'Nothing is painted yet'))}
        text={
          !hasId
            ? tr(
                t(
                  'Cette toile est vide : si tu quittes maintenant, elle ne sera pas gardée.',
                  'This canvas is empty: if you leave now, it will not be kept.',
                ),
              )
            : tr(
                t(
                  'Cette toile est vide. Tu peux la garder pour plus tard ou la supprimer.',
                  'This canvas is empty. You can keep it for later or delete it.',
                ),
              )
        }
        confirm={!hasId ? tr(t('Quitter', 'Leave')) : tr(t('Supprimer la création', 'Delete creation'))}
        cancel={tr(t('Continuer à peindre', 'Keep painting'))}
        onConfirm={discard}
        {...(hasId && {
          extra: {
            label: tr(t('Garder et quitter', 'Keep and leave')),
            onClick: () => {
              setConfirmEmpty(false);
              void flush().finally(exit);
            },
          },
        })}
      />
      {toast}
    </div>
  );
}
