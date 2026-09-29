import { Capacitor } from '@capacitor/core';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useNav } from '@/store/nav';
import { useSettings } from '@/store/settings';
import { spring } from '@/theme/motion/tokens';
import { Button, Sheet } from '@/ui/kit';
import { IconRefresh } from '@/ui/screens/profile/icons';
import { Markdown } from './Markdown';
import { downloadErrorText, formatMegabytes, formatPercent, formatReleaseDate } from './text';
import { runAutoCheck, useUpdater } from './updater';
import './update.css';

/** Délai après le lancement avant la vérification automatique (laisse l'écran de démarrage respirer). */
const AUTO_CHECK_DELAY_MS = 4000;

function ProgressBar({ downloaded, total }: { downloaded: number; total: number }) {
  const known = total > 0 && downloaded > 0;
  const fraction = known ? Math.min(1, downloaded / total) : 0;
  return (
    <div className="upd-progress">
      <div
        className="upd-progress__bar"
        role="progressbar"
        aria-label={tr(t('Téléchargement de la mise à jour', 'Downloading the update'))}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(known && { 'aria-valuenow': Math.round(fraction * 100) })}
      >
        {known ? (
          <motion.i
            className="upd-progress__fill"
            initial={false}
            animate={{ width: `${String(fraction * 100)}%` }}
            transition={{ type: 'spring', ...spring.gentle }}
          />
        ) : (
          <i className="upd-progress__fill upd-progress__fill--wait" />
        )}
      </div>
      <div className="upd-progress__text" aria-live="off">
        <strong>{known ? formatPercent(fraction) : tr(t('Préparation…', 'Getting ready…'))}</strong>
        <span>
          {known
            ? `${formatMegabytes(downloaded)} ${tr(t('sur', 'of'))} ${formatMegabytes(total)}`
            : total > 0
              ? formatMegabytes(total)
              : ''}
        </span>
      </div>
    </div>
  );
}

/** Feuille de mise à jour : nouveautés, téléchargement, installation. Jamais pendant une partie. */
export function UpdateSheet() {
  const settingsLoaded = useSettings((s) => s.loaded);
  const onboarded = useSettings((s) => s.onboarded);
  const playing = useNav((s) => s.playing);
  const { state, release, installed, progress, error, open } = useUpdater();
  const updater = useUpdater.getState();

  useEffect(() => {
    if (!settingsLoaded) return;
    const id = setTimeout(() => {
      void runAutoCheck();
    }, AUTO_CHECK_DELAY_MS);
    return () => {
      clearTimeout(id);
    };
  }, [settingsLoaded]);

  const visible = open && release !== null && !playing && onboarded;
  const native = Capacitor.isNativePlatform();
  const date = release ? formatReleaseDate(release.publishedAt) : null;

  let body = null;
  if (release) {
    const busy = state === 'downloading';
    body = (
      <div className="upd">
        <header className="upd__head">
          <span className="upd__icon">
            <IconRefresh size={26} />
          </span>
          <div className="upd__title">
            <h3>{tr(t('Une nouvelle version de Tessel', 'A new version of Tessel'))}</h3>
            <p className="upd__versions" aria-label={`${installed} → ${release.version}`}>
              <span>{installed}</span>
              <span aria-hidden> → </span>
              <strong>{release.version}</strong>
            </p>
          </div>
        </header>

        <div className="upd__meta">
          {release.apk.size > 0 && <span className="upd__chip">{formatMegabytes(release.apk.size)}</span>}
          {date && <span className="upd__chip">{date}</span>}
          {release.prerelease && (
            <span className="upd__chip upd__chip--warm">{tr(t('Préversion', 'Pre-release'))}</span>
          )}
        </div>

        {release.body.trim() !== '' && (
          <section
            className={`upd__notes${busy ? ' upd__notes--compact' : ''}`}
            aria-label={tr(t('Nouveautés', 'What’s new'))}
            tabIndex={0}
          >
            <Markdown source={release.body} />
          </section>
        )}

        {error && (
          <p className="upd__error" role="alert">
            {downloadErrorText(error)}
          </p>
        )}

        {state === 'permission' && (
          <p className="upd__info">
            {tr(
              t(
                'Pour installer la mise à jour, Android a besoin de ton accord : autorise Tessel à installer des applications, puis reviens ici, on reprend tout seul.',
                'To install the update, Android needs your OK: allow Tessel to install apps, then come back here and we will carry on by ourselves.',
              ),
            )}
          </p>
        )}

        {state === 'ready' && !error && (
          <p className="upd__info">
            {tr(
              t(
                'La mise à jour est téléchargée et vérifiée. Confirme l’installation dans la fenêtre d’Android.',
                'The update is downloaded and verified. Confirm the installation in the Android dialog.',
              ),
            )}
          </p>
        )}

        {busy && <ProgressBar downloaded={progress.downloaded} total={progress.total} />}

        {!native && state === 'available' && !error && (
          <p className="upd__hint">
            {tr(
              t(
                'Dans le navigateur, la page de la version s’ouvre dans un nouvel onglet.',
                'In the browser, the release page opens in a new tab.',
              ),
            )}
          </p>
        )}

        <div className="upd__actions">
          {busy ? (
            <Button variant="tonal" onClick={updater.cancel}>
              {tr(t('Annuler', 'Cancel'))}
            </Button>
          ) : (
            <>
              {state === 'permission' ? (
                <Button variant="filled" onClick={updater.openInstallSettings}>
                  {tr(t('Ouvrir les réglages', 'Open settings'))}
                </Button>
              ) : state === 'ready' ? (
                <Button
                  variant="filled"
                  onClick={() => {
                    void updater.install();
                  }}
                >
                  {tr(t('Installer', 'Install'))}
                </Button>
              ) : (
                <Button
                  variant="filled"
                  onClick={() => {
                    void updater.download();
                  }}
                >
                  {error ? tr(t('Réessayer', 'Try again')) : tr(t('Mettre à jour', 'Update'))}
                </Button>
              )}
              <div className="upd__secondary">
                <Button variant="text" onClick={updater.dismiss}>
                  {tr(t('Plus tard', 'Later'))}
                </Button>
                {(state === 'available' || state === 'idle') && (
                  <Button variant="text" onClick={updater.ignore}>
                    {tr(t('Ignorer cette version', 'Skip this version'))}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <Sheet
      open={visible}
      onClose={updater.dismiss}
      label={tr(t('Mise à jour disponible', 'Update available'))}
    >
      {body}
    </Sheet>
  );
}
