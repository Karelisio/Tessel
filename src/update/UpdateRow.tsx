import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { ListRow } from '@/ui/kit';
import { IconRefresh } from '@/ui/screens/profile/icons';
import { formatPercent } from './text';
import { useUpdater } from './updater';
import './update.css';

/** Ligne des Réglages : vérifie les mises à jour et montre la version installée. */
export function UpdateRow() {
  const state = useUpdater((s) => s.state);
  const release = useUpdater((s) => s.release);
  const installed = useUpdater((s) => s.installed);
  const progress = useUpdater((s) => s.progress);
  // espace et tirets insécables : la version reste d'un seul bloc quand la ligne passe à la ligne
  const installedText = `${tr(t('installée', 'installed'))}\u00a0${installed.replaceAll('-', '\u2011')}`;

  const subtitle =
    state === 'checking'
      ? tr(t('Vérification…', 'Checking…'))
      : state === 'upToDate'
        ? `${tr(t('À jour ✓', 'Up to date ✓'))} · ${installedText}`
        : state === 'available' && release
          ? `${tr(t(`Version ${release.version} disponible`, `Version ${release.version} available`))} · ${installedText}`
          : state === 'downloading'
            ? `${tr(t('Téléchargement…', 'Downloading…'))} ${progress.total > 0 ? formatPercent(progress.downloaded / progress.total) : ''}`.trim()
            : state === 'ready'
              ? tr(t('Prête à installer', 'Ready to install'))
              : state === 'permission'
                ? tr(t('Autorisation d’installation requise', 'Install permission needed'))
                : state === 'error'
                  ? `${tr(t('Vérification impossible pour le moment', 'Could not check right now'))} · ${installedText}`
                  : `${tr(t('Version installée', 'Installed version'))}\u00a0: ${installed.replaceAll('-', '\u2011')}`;

  return (
    <ListRow
      icon={<IconRefresh size={20} />}
      title={tr(t('Vérifier les mises à jour', 'Check for updates'))}
      subtitle={subtitle}
      {...(state === 'checking' && { trailing: <span className="upd-spin" aria-hidden /> })}
      onClick={() => {
        const u = useUpdater.getState();
        if (state === 'checking') return;
        if (state === 'available' || state === 'downloading' || state === 'ready' || state === 'permission')
          u.show();
        else void u.check(true);
      }}
    />
  );
}
