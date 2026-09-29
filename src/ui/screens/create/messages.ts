import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';

export const emptyMessage = () =>
  tr(
    t(
      'Peins d’abord quelques cases : une toile vide ne peut pas encore se colorier.',
      'Paint a few squares first: an empty canvas cannot be played yet.',
    ),
  );
