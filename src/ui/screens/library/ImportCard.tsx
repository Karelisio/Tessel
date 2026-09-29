import { motion } from 'framer-motion';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useNav } from '@/store/nav';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { IconChevron } from '@/ui/kit/icons';
import { IconPhoto } from './icons';

/** Entrée « Importer une photo ». */
export function ImportCard({ index }: { index: number }) {
  return (
    <motion.button
      className="lib-import"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', ...spring.gentle, delay: staggerDelay(index) / 1000 }}
      onClick={() => {
        useNav.getState().openImport();
      }}
    >
      <span className="lib-import__icon">
        <IconPhoto size={24} />
      </span>
      <span className="lib-import__text">
        <strong>{tr(t('Importer une photo', 'Import a photo'))}</strong>
        <small>{tr(t('Transforme un souvenir en coloriage', 'Turn a memory into a colouring page'))}</small>
      </span>
      <IconChevron size={18} />
    </motion.button>
  );
}
