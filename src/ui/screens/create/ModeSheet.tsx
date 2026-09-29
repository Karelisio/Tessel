import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { MODE_NAMES } from '@/meta/format';
import { unlockLevel } from '@/meta/unlocks';
import { MODE_IDS, type ModeId } from '@/modes/types';
import { Sheet } from '@/ui/kit';
import { IconLock } from '@/ui/meta/icons';
import { useUnlockedModes } from './useModes';

const DESCRIPTIONS: Record<ModeId, () => string> = {
  pixel: () => tr(t('Des cases lisses, toutes simples', 'Smooth squares, nice and simple')),
  diamond: () => tr(t('Des diamants qui scintillent', 'Sparkling diamond drills')),
  crossstitch: () => tr(t('Une croix après l’autre', 'One cross after another')),
  mosaic: () => tr(t('Des tesselles posées à la main', 'Hand-laid tesserae')),
};

/** Choix du mode de jeu (les modes verrouillés montrent leur niveau). */
export function ModeSheet({
  open,
  onClose,
  onPick,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (mode: ModeId) => void;
  title?: ReactNode;
}) {
  const unlocked = useUnlockedModes();
  return (
    <Sheet open={open} onClose={onClose} label={tr(t('Mode de jeu', 'Game mode'))}>
      <div className="cr-sheet-head">
        <h3>{title ?? tr(t('Comment veux-tu la colorier ?', 'How do you want to color it?'))}</h3>
        <p>{tr(t('Chaque mode garde sa propre progression.', 'Each mode keeps its own progress.'))}</p>
      </div>
      <div className="cr-modes">
        {MODE_IDS.map((m) => {
          const locked = !unlocked.includes(m);
          const level = unlockLevel(`mode:${m}`);
          return (
            <motion.button
              key={m}
              className="cr-mode"
              data-locked={locked}
              disabled={locked}
              aria-label={`${tr(MODE_NAMES[m])}${locked && level ? `, ${tr(t('niveau', 'level'))} ${String(level)}` : ''}`}
              {...(!locked && { whileTap: { scale: 0.95 } })}
              onClick={() => {
                onPick(m);
              }}
            >
              <span className={`cr-mode__swatch cr-mode__swatch--${m}`} />
              <strong>{tr(MODE_NAMES[m])}</strong>
              <small>
                {locked ? (
                  <>
                    <IconLock size={13} /> {tr(t('Niveau', 'Level'))} {level ?? ''}
                  </>
                ) : (
                  DESCRIPTIONS[m]()
                )}
              </small>
            </motion.button>
          );
        })}
      </div>
    </Sheet>
  );
}
