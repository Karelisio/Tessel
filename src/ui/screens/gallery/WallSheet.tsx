import { motion } from 'framer-motion';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { unlockLevel } from '@/meta/unlocks';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { Sheet } from '@/ui/kit';
import { IconCheck, IconLock } from '@/ui/meta/icons';
import type { Notify } from './Toast';
import { WALLS, wallStyle, type WallDef } from './walls';

/** Aperçu d'un mur : sa matière, avec deux petits cadres accrochés. */
export function WallSwatch({ wall }: { wall: WallDef }) {
  return (
    <span className="gg-swatch" data-dark={wall.dark} style={wallStyle(wall, 0.5)} aria-hidden>
      <i className="gg-swatch__frame gg-swatch__frame--a" />
      <i className="gg-swatch__frame gg-swatch__frame--b" />
    </span>
  );
}

function requirement(wall: WallDef): string {
  const level = unlockLevel(wall.key);
  return level === undefined ? tr(t('Récompense', 'Reward')) : `${tr(t('Niveau', 'Level'))} ${String(level)}`;
}

function unlockHint(wall: WallDef): string {
  const level = unlockLevel(wall.key);
  return level === undefined
    ? tr(t('À gagner avec une récompense spéciale.', 'Earn it with a special reward.'))
    : `${tr(t('Se débloque au niveau', 'Unlocks at level'))} ${String(level)}.`;
}

/** Choix du mur : les murs verrouillés sont grisés avec le niveau qui les débloque. */
export function WallSheet({
  open,
  onClose,
  current,
  unlocked,
  onChoose,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  current: WallDef;
  unlocked: ReadonlySet<string>;
  onChoose: (key: string) => void;
  notify: Notify;
}) {
  return (
    <Sheet open={open} onClose={onClose} label={tr(t('Changer de mur', 'Change wall'))}>
      <h2 className="gg-sheet__title">{tr(t('Choisis ton mur', 'Pick your wall'))}</h2>
      <p className="gg-sheet__hint">
        {tr(t('De nouveaux murs se débloquent en montant de niveau.', 'New walls unlock as you level up.'))}
      </p>
      <div className="gg-walls" role="list">
        {WALLS.map((wall, i) => {
          const isOpen = unlocked.has(wall.key);
          const selected = wall.key === current.key;
          return (
            <motion.button
              key={wall.key}
              type="button"
              role="listitem"
              className="gg-wallopt"
              data-locked={!isOpen}
              data-selected={selected}
              aria-pressed={selected}
              aria-label={`${tr(wall.name)}${isOpen ? '' : `, ${requirement(wall)}`}`}
              initial={{ opacity: 0, y: 14, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', ...spring.gentle, delay: staggerDelay(i, 28) / 1000 }}
              onClick={() => {
                if (isOpen) {
                  onChoose(wall.key);
                  window.setTimeout(onClose, 260);
                } else {
                  notify(`${tr(wall.name)} · ${unlockHint(wall)}`, 'soft');
                }
              }}
            >
              <WallSwatch wall={wall} />
              {selected && (
                <motion.span
                  className="gg-wallopt__check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', ...spring.bouncy }}
                >
                  <IconCheck size={14} />
                </motion.span>
              )}
              {!isOpen && (
                <span className="gg-wallopt__lock">
                  <IconLock size={16} />
                  <small>{requirement(wall)}</small>
                </span>
              )}
              <span className="gg-wallopt__name">{tr(wall.name)}</span>
            </motion.button>
          );
        })}
      </div>
    </Sheet>
  );
}
