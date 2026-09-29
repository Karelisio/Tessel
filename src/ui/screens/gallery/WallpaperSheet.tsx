import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { ProjectMeta } from '@/db/ProgressStore';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import type { WallpaperTarget } from '@/native/TesselNative';
import {
  canvasBlob,
  fileName,
  loadArtwork,
  renderWallpaper,
  saveToDevice,
  screenPixels,
  setWallpaper,
} from '@/render/exports';
import { spring } from '@/theme/motion/tokens';
import { Button, Segmented, Sheet, Skeleton } from '@/ui/kit';
import { isCancel, isNative } from './actions';
import { withVars } from './model';
import type { Notify } from './Toast';

type Preview = { phase: 'loading' } | { phase: 'ready'; blob: Blob; url: string } | { phase: 'error' };

function Job({
  project,
  open,
  onClose,
  notify,
}: {
  project: ProjectMeta;
  open: boolean;
  onClose: () => void;
  notify: Notify;
}) {
  const [preview, setPreview] = useState<Preview>({ phase: 'loading' });
  const [target, setTarget] = useState<WallpaperTarget>('both');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const screen = useMemo(() => screenPixels(), []);
  const clock = useMemo(
    () =>
      new Intl.DateTimeFormat(locale() === 'fr' ? 'fr-FR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const live = { on: true };
    let url: string | null = null;
    void (async () => {
      try {
        const artwork = await loadArtwork(project.id);
        const blob = await canvasBlob(await renderWallpaper(artwork, screen));
        if (!live.on) return;
        url = URL.createObjectURL(blob);
        setPreview({ phase: 'ready', blob, url });
      } catch (e) {
        console.error(e);
        if (live.on) setPreview({ phase: 'error' });
      }
    })();
    return () => {
      live.on = false;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [open, project.id, project.frame, screen, attempt]);

  const apply = async (blob: Blob) => {
    setBusy(true);
    try {
      await setWallpaper(blob, target);
      notify(tr(t('Ton fond d’écran est en place !', 'Your wallpaper is set!')));
      onClose();
    } catch (e) {
      if (!isCancel(e))
        notify(
          isNative()
            ? tr(
                t(
                  'Le fond d’écran n’a pas pu être changé. Réessaie dans un instant.',
                  'Couldn’t set the wallpaper. Try again in a moment.',
                ),
              )
            : tr(
                t(
                  'Le fond d’écran se change depuis l’appli Android. Tu peux enregistrer l’image en attendant.',
                  'Wallpapers can be set from the Android app. You can save the image meanwhile.',
                ),
              ),
          'soft',
        );
    } finally {
      setBusy(false);
    }
  };

  const save = async (blob: Blob) => {
    setBusy(true);
    try {
      await saveToDevice(blob, fileName(`${project.title ?? 'tessel'}-fond`, 'png'));
      notify(tr(t('Image enregistrée.', 'Image saved.')));
    } catch {
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
      setBusy(false);
    }
  };

  const ratio = screen.width / screen.height;
  return (
    <div className="gg-job">
      <h2 className="gg-sheet__title">{tr(t('Fond d’écran', 'Wallpaper'))}</h2>
      <div className="gg-phone" style={withVars({ '--screen-ar': ratio.toFixed(4) })} data-target={target}>
        {preview.phase === 'ready' ? (
          <motion.img
            src={preview.url}
            alt={tr(t('Aperçu du fond d’écran', 'Wallpaper preview'))}
            draggable={false}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', ...spring.gentle }}
          />
        ) : preview.phase === 'loading' ? (
          <Skeleton width="100%" height="100%" radius={22} />
        ) : (
          <p className="gg-phone__error">
            {tr(t('L’aperçu n’a pas pu être préparé.', 'The preview couldn’t be prepared.'))}
          </p>
        )}
        {preview.phase === 'ready' && target !== 'home' && (
          <span className="gg-phone__clock" aria-hidden>
            {clock}
          </span>
        )}
      </div>
      <Segmented<WallpaperTarget>
        label={tr(t('Où l’afficher', 'Where to show it'))}
        variant="segmented"
        layoutId="gg-wp-target"
        value={target}
        onChange={setTarget}
        options={[
          { id: 'home', label: tr(t('Accueil', 'Home')) },
          { id: 'lock', label: tr(t('Verrouillage', 'Lock')) },
          { id: 'both', label: tr(t('Les deux', 'Both')) },
        ]}
      />
      {preview.phase === 'error' ? (
        <Button
          variant="filled"
          onClick={() => {
            setPreview({ phase: 'loading' });
            setAttempt((a) => a + 1);
          }}
        >
          {tr(t('Réessayer', 'Try again'))}
        </Button>
      ) : (
        <div className="gg-job__actions">
          {!isNative() && preview.phase === 'ready' && (
            <Button
              variant="tonal"
              disabled={busy}
              onClick={() => {
                void save(preview.blob);
              }}
            >
              {tr(t('Enregistrer l’image', 'Save image'))}
            </Button>
          )}
          <Button
            variant="filled"
            disabled={busy || preview.phase !== 'ready'}
            onClick={() => {
              if (preview.phase === 'ready') void apply(preview.blob);
            }}
          >
            {busy ? tr(t('Un instant…', 'One moment…')) : tr(t('Définir', 'Set wallpaper'))}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Aperçu du fond d'écran dans un téléphone, choix accueil / verrouillage / les deux. */
export function WallpaperSheet({
  open,
  onClose,
  project,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  project: ProjectMeta;
  notify: Notify;
}) {
  return (
    <Sheet open={open} onClose={onClose} label={tr(t('Fond d’écran', 'Wallpaper'))}>
      <Job key={project.id} project={project} open={open} onClose={onClose} notify={notify} />
    </Sheet>
  );
}
