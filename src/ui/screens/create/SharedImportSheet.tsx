import { useMemo, useState } from 'react';
import { getServices } from '@/app/services';
import { fromGrid } from '@/create/document';
import { sharedRef } from '@/create/refs';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import type { SharedArtwork } from '@/create/format';
import { useNav } from '@/store/nav';
import { Button, Sheet } from '@/ui/kit';
import { EditorHost } from './EditorHost';
import { IconPencil } from './icons';
import { ModeSheet } from './ModeSheet';
import { useUnlockedModes } from './useModes';
import { gridRgba, gridStats } from './render';
import { useEditorStore } from './store';
import { PixelThumb } from './ui';
import { useToast } from './useToast';
import { IconPlay } from '@/ui/kit/icons';
import './create.css';

function Incoming({ art, onClose }: { art: SharedArtwork; onClose: () => void }) {
  const modes = useUnlockedModes();
  const [step, setStep] = useState<'main' | 'mode'>('main');
  const { notify, toast } = useToast();
  const pixels = useMemo(() => ({ w: art.grid.width, h: art.grid.height, rgba: gridRgba(art.grid) }), [art]);
  const stats = useMemo(() => gridStats(art.grid), [art]);
  const play = (mode: (typeof modes)[number]) => {
    useNav.getState().open(sharedRef(art), { mode });
    onClose();
  };
  const edit = () => {
    void (async () => {
      try {
        const { creations } = await getServices();
        const id = await creations.save(null, art.title, fromGrid(art.grid, `${tr(t('Calque', 'Layer'))} 1`));
        useNav.getState().setTab('create');
        onClose();
        useEditorStore.getState().open(id);
      } catch {
        notify(tr(t('Impossible de la copier pour l’instant.', 'Could not copy it right now.')), 'soft');
      }
    })();
  };
  const only = modes.length === 1 ? modes[0] : undefined;
  return (
    <>
      <div className="cr-incoming">
        <div className="cr-sheet-head">
          <h3>{tr(t('Une œuvre pour toi', 'An artwork for you'))}</h3>
          <p>{tr(t('Quelqu’un t’a partagé cette création.', 'Someone shared this creation with you.'))}</p>
        </div>
        <div className="cr-incoming__card">
          <PixelThumb pixels={pixels} box={148} radius={20} />
          <div className="cr-incoming__meta">
            <strong>{art.title}</strong>
            <span>
              {art.grid.width} × {art.grid.height} {tr(t('cases', 'squares'))}
            </span>
            <span>
              {stats.colors} {stats.colors > 1 ? tr(t('couleurs', 'colors')) : tr(t('couleur', 'color'))}
            </span>
            <span>
              {stats.cells.toLocaleString(tr(t('fr-FR', 'en-US')))} {tr(t('cases à poser', 'to place'))}
            </span>
          </div>
        </div>
        <div className="cr-incoming__actions">
          <Button
            variant="filled"
            onClick={() => {
              if (only) play(only);
              else setStep('mode');
            }}
          >
            <span className="cr-btn-in">
              <IconPlay size={18} />
              {tr(t('Jouer', 'Play'))}
            </span>
          </Button>
          <Button variant="tonal" onClick={edit}>
            <span className="cr-btn-in">
              <IconPencil size={18} />
              {tr(t('Modifier dans l’éditeur', 'Edit in the editor'))}
            </span>
          </Button>
          <Button variant="text" onClick={onClose}>
            {tr(t('Ignorer', 'Dismiss'))}
          </Button>
        </div>
      </div>
      <ModeSheet
        open={step === 'mode'}
        onClose={() => {
          setStep('main');
        }}
        onPick={play}
      />
      {toast}
    </>
  );
}

/**
 * Œuvre reçue (fichier .tessel ouvert, QR scanné) : aperçu et choix, monté une fois dans l'application.
 * Porte aussi l'éditeur plein écran, pour qu'il s'affiche quel que soit l'onglet actif.
 */
export function SharedImportSheet() {
  const incoming = useNav((s) => s.incoming);
  // le contenu reste affiché pendant la fermeture de la feuille
  const [shown, setShown] = useState<{ art: SharedArtwork; gen: number } | null>(
    incoming ? { art: incoming, gen: 0 } : null,
  );
  if (incoming && incoming !== shown?.art) setShown({ art: incoming, gen: (shown?.gen ?? 0) + 1 });
  const close = () => {
    useNav.getState().receiveShared(null);
  };
  return (
    <>
      <Sheet open={incoming !== null} onClose={close} label={tr(t('Œuvre reçue', 'Received artwork'))}>
        {shown && <Incoming key={shown.gen} art={shown.art} onClose={close} />}
      </Sheet>
      <EditorHost />
    </>
  );
}
