import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import type { UpdateErrorKind } from './github';

const bcp47 = () => (locale() === 'fr' ? 'fr-FR' : 'en-US');

/** Taille lisible : « 24,3 Mo » / « 24.3 MB » (une décimale sous 100 Mo). */
export function formatMegabytes(bytes: number): string {
  const mb = Math.max(0, bytes) / (1024 * 1024);
  const text = new Intl.NumberFormat(bcp47(), { maximumFractionDigits: mb < 100 ? 1 : 0 }).format(mb);
  return `${text} ${locale() === 'fr' ? 'Mo' : 'MB'}`;
}

export function formatPercent(fraction: number): string {
  return new Intl.NumberFormat(bcp47(), { style: 'percent', maximumFractionDigits: 0 }).format(
    Math.min(1, Math.max(0, fraction)),
  );
}

export function formatReleaseDate(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat(bcp47(), { day: 'numeric', month: 'long', year: 'numeric' }).format(ms);
}

/** Message doux pour un échec de vérification. */
export function checkErrorText(kind: UpdateErrorKind): string {
  return kind === 'rateLimit'
    ? tr(
        t(
          'GitHub est un peu débordé, réessaie dans un moment.',
          'GitHub is a bit busy, try again in a moment.',
        ),
      )
    : tr(
        t(
          'Impossible de vérifier pour le moment. Vérifie ta connexion et réessaie.',
          'Could not check right now. Check your connection and try again.',
        ),
      );
}

/** Message doux pour un échec de téléchargement ou d'installation. */
export function downloadErrorText(kind: UpdateErrorKind): string {
  switch (kind) {
    case 'corrupt':
      return tr(
        t(
          'Le fichier téléchargé est corrompu, réessaie.',
          'The downloaded file is corrupted, please try again.',
        ),
      );
    case 'io':
      return tr(
        t(
          'Le fichier n’a pas pu être enregistré. Vérifie l’espace disponible et réessaie.',
          'The file could not be saved. Check your free space and try again.',
        ),
      );
    case 'noChecksum':
      return tr(
        t(
          'Cette version n’est pas tout à fait prête (empreinte de vérification introuvable). Réessaie un peu plus tard.',
          'This version is not quite ready (verification checksum not found). Try again a little later.',
        ),
      );
    case 'install':
      return tr(
        t(
          'L’installation n’a pas pu démarrer. Réessaie dans un instant.',
          'The installation could not start. Please try again in a moment.',
        ),
      );
    case 'rateLimit':
    case 'invalid':
    case 'unavailable':
    case 'network':
      return tr(
        t(
          'Le téléchargement s’est interrompu. Vérifie ta connexion et réessaie : il reprendra où il s’est arrêté.',
          'The download was interrupted. Check your connection and try again: it will resume where it stopped.',
        ),
      );
  }
}
