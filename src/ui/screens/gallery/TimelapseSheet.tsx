import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { ProjectMeta } from '@/db/ProgressStore';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { fileName, loadArtwork, saveToDevice, shareFile } from '@/render/exports';
import { exportTimelapse, type TimelapseFormat } from '@/render/timelapse';
import { spring } from '@/theme/motion/tokens';
import { Button, Sheet } from '@/ui/kit';
import { isCancel, isNative } from './actions';
import { displayTitle } from './model';
import type { Notify } from './Toast';

export interface TimelapseRequest {
  /** Identifiant de l'essai : une nouvelle demande repart de zéro. */
  run: number;
  format: TimelapseFormat;
}

type State =
  | { phase: 'working'; progress: number }
  | { phase: 'done'; blob: Blob; url: string; name: string }
  | { phase: 'error' };

function Job({
  project,
  request,
  open,
  thumb,
  onClose,
  notify,
}: {
  project: ProjectMeta;
  request: TimelapseRequest;
  open: boolean;
  thumb: string | null;
  onClose: () => void;
  notify: Notify;
}) {
  const [state, setState] = useState<State>({ phase: 'working', progress: 0 });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const controller = useRef<AbortController | null>(null);
  const { format } = request;

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    controller.current = ctrl;
    void (async () => {
      try {
        const artwork = await loadArtwork(project.id);
        const blob = await exportTimelapse(artwork, {
          format,
          signal: ctrl.signal,
          onProgress: (p) => {
            if (ctrl.signal.aborted) return;
            setState((s) =>
              s.phase === 'working' ? { phase: 'working', progress: Math.max(s.progress, p) } : s,
            );
          },
        });
        if (ctrl.signal.aborted) return;
        setState({
          phase: 'done',
          blob,
          url: URL.createObjectURL(blob),
          name: fileName(artwork.title, format),
        });
      } catch (e) {
        if (ctrl.signal.aborted || isCancel(e)) return;
        console.error(e);
        setState({ phase: 'error' });
      }
    })();
    return () => {
      ctrl.abort();
    };
  }, [open, project.id, format, attempt]);

  const doneUrl = state.phase === 'done' ? state.url : null;
  useEffect(() => {
    if (doneUrl === null) return;
    return () => {
      URL.revokeObjectURL(doneUrl);
    };
  }, [doneUrl]);

  const label = format === 'mp4' ? tr(t('Vidéo MP4', 'MP4 video')) : tr(t('GIF animé', 'Animated GIF'));

  const run = async (kind: 'save' | 'share', done: Extract<State, { phase: 'done' }>) => {
    setBusy(kind);
    try {
      if (kind === 'save') {
        await saveToDevice(done.blob, done.name);
        notify(
          isNative()
            ? tr(t('Enregistré dans ta galerie, dossier Tessel.', 'Saved to your gallery, Tessel folder.'))
            : tr(t('Fichier téléchargé.', 'File downloaded.')),
        );
      } else {
        await shareFile(done.blob, done.name, displayTitle(project));
      }
    } catch (e) {
      if (!isCancel(e))
        notify(
          tr(
            t(
              'Ça n’a pas fonctionné cette fois. Réessaie dans un instant.',
              'That didn’t work this time. Try again in a moment.',
            ),
          ),
          'soft',
        );
    } finally {
      setBusy(null);
    }
  };

  if (state.phase === 'working') {
    const pct = Math.round(state.progress * 100);
    return (
      <div className="gg-job">
        <h2 className="gg-sheet__title">{label}</h2>
        <div className="gg-job__hero">
          {thumb && <img src={thumb} alt="" draggable={false} />}
          <motion.span
            className="gg-job__pulse"
            aria-hidden
            animate={{ opacity: [0.35, 0.8, 0.35], scale: [0.96, 1.04, 0.96] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <p className="gg-job__text">
          {pct < 2
            ? tr(t('On prépare ta création…', 'Getting your creation ready…'))
            : tr(t('On rejoue chaque case, une par une…', 'Replaying every cell, one by one…'))}
        </p>
        <div
          className="gg-progress"
          role="progressbar"
          aria-label={tr(t('Progression de l’export', 'Export progress'))}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <motion.span
            className="gg-progress__fill"
            initial={false}
            animate={{ scaleX: state.progress }}
            transition={{ type: 'spring', ...spring.gentle }}
          />
        </div>
        <div className="gg-job__row">
          <strong className="gg-job__pct">{pct} %</strong>
          <small>
            {tr(t('Garde l’appli ouverte pendant l’export.', 'Keep the app open during the export.'))}
          </small>
        </div>
        <Button
          variant="tonal"
          onClick={() => {
            controller.current?.abort();
            onClose();
            notify(tr(t('Export annulé.', 'Export cancelled.')), 'soft');
          }}
        >
          {tr(t('Annuler', 'Cancel'))}
        </Button>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="gg-job">
        <h2 className="gg-sheet__title">{label}</h2>
        <p className="gg-job__text">
          {tr(
            t(
              'L’export n’a pas pu se terminer. Ce n’est pas grave, on peut réessayer.',
              'The export couldn’t finish. No worries, we can try again.',
            ),
          )}
        </p>
        <div className="gg-job__actions">
          <Button variant="text" onClick={onClose}>
            {tr(t('Fermer', 'Close'))}
          </Button>
          <Button
            variant="filled"
            onClick={() => {
              setState({ phase: 'working', progress: 0 });
              setAttempt((a) => a + 1);
            }}
          >
            {tr(t('Réessayer', 'Try again'))}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="gg-job">
      <h2 className="gg-sheet__title">{tr(t('C’est prêt !', 'All done!'))}</h2>
      <motion.div
        className="gg-job__preview"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', ...spring.gentle }}
      >
        {format === 'mp4' ? (
          <video src={state.url} autoPlay loop muted playsInline controls={false} />
        ) : (
          <img src={state.url} alt={displayTitle(project)} draggable={false} />
        )}
      </motion.div>
      <div className="gg-job__actions">
        <Button
          variant="filled"
          disabled={busy !== null}
          onClick={() => {
            void run('save', state);
          }}
        >
          {busy === 'save' ? tr(t('Enregistrement…', 'Saving…')) : tr(t('Enregistrer', 'Save'))}
        </Button>
        <Button
          variant="tonal"
          disabled={busy !== null}
          onClick={() => {
            void run('share', state);
          }}
        >
          {busy === 'share' ? tr(t('Ouverture…', 'Opening…')) : tr(t('Partager', 'Share'))}
        </Button>
      </div>
      <Button variant="text" onClick={onClose}>
        {tr(t('Terminer', 'Done'))}
      </Button>
    </div>
  );
}

/** Feuille d'export du film de la création : progression annulable, puis enregistrer ou partager. */
export function TimelapseSheet({
  open,
  onClose,
  project,
  request,
  thumb,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  project: ProjectMeta;
  request: TimelapseRequest | null;
  thumb: string | null;
  notify: Notify;
}) {
  return (
    <Sheet
      open={open}
      onClose={() => {
        // fermer pendant l'export l'interrompt (le cleanup de l'effet annule le travail)
        onClose();
      }}
      label={tr(t('Exporter la vidéo', 'Export video'))}
    >
      {request && (
        <Job
          key={request.run}
          project={project}
          request={request}
          open={open}
          thumb={thumb}
          onClose={onClose}
          notify={notify}
        />
      )}
    </Sheet>
  );
}
