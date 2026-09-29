import { motion } from 'framer-motion';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useNav } from '@/store/nav';
import { spring } from '@/theme/motion/tokens';
import { Button } from '@/ui/kit';
import { IconPlus } from './icons';

/** Mur nu : un cadre vide accroché à son clou, en attendant la première œuvre. */
export function EmptyWall() {
  return (
    <div className="gg-empty">
      <motion.div
        className="gg-empty__hang"
        initial={{ opacity: 0, y: -30, rotate: 4 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: 'spring', ...spring.bouncy, damping: 10 }}
      >
        <motion.div
          className="gg-empty__sway"
          animate={{ rotate: [0.9, -0.9, 0.9] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="gg-empty__nail" aria-hidden />
          <span className="gg-empty__cord gg-empty__cord--l" aria-hidden />
          <span className="gg-empty__cord gg-empty__cord--r" aria-hidden />
          <div className="gg-empty__frame" aria-hidden>
            <div className="gg-empty__mat">
              <IconPlus size={30} />
            </div>
          </div>
        </motion.div>
      </motion.div>
      <motion.div
        className="gg-cartel gg-cartel--big"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', ...spring.gentle, delay: 0.25 }}
      >
        <strong>
          {tr(t('Ta première œuvre terminée viendra ici', 'Your first finished artwork will hang here'))}
        </strong>
        <span>
          {tr(
            t(
              'Colorie une image jusqu’au bout, elle sera encadrée et exposée sur ce mur.',
              'Color a picture all the way through and it will be framed and displayed on this wall.',
            ),
          )}
        </span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', ...spring.gentle, delay: 0.35 }}
      >
        <Button
          variant="filled"
          onClick={() => {
            useNav.getState().setTab('library');
          }}
        >
          {tr(t('Aller à la bibliothèque', 'Go to the library'))}
        </Button>
      </motion.div>
    </div>
  );
}
