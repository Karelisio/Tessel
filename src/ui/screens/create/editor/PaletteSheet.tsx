import { motion } from 'framer-motion';
import { PALETTES, paletteColors } from '@/create/palettes';
import type { Editor } from '@/create/Editor';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { catalogItem, type UnlockKey } from '@/meta/catalog';
import { unlockLevel } from '@/meta/unlocks';
import { useMetaStore } from '@/store/meta';
import { Sheet } from '@/ui/kit';
import { IconLock } from '@/ui/meta/icons';
import { css } from '../color';
import { paletteChoices } from '../palettes';

/** Palettes : les débloquées s'appliquent, les autres montrent le niveau qui les offre. */
export function PaletteSheet({
  open,
  onClose,
  editor,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  editor: Editor;
  onApplied: (name: string) => void;
}) {
  useMetaStore((s) => s.snap);
  const service = useMetaStore((s) => s.service);
  const choices = paletteChoices(service);
  return (
    <Sheet open={open} onClose={onClose} label={tr(t('Palettes', 'Palettes'))}>
      <div className="cr-sheet-head">
        <h3>{tr(t('Palettes', 'Palettes'))}</h3>
        <p>
          {tr(
            t(
              'Tes cases gardent leur place : chaque couleur prend la plus proche de la nouvelle palette.',
              'Your squares stay where they are: each color takes the closest one in the new palette.',
            ),
          )}
        </p>
      </div>
      <div className="cr-palettes">
        {choices.map(({ key, unlocked }) => {
          const name = tr(catalogItem(key as UnlockKey)?.name ?? t(key, key));
          const level = unlockLevel(key as UnlockKey);
          return (
            <motion.button
              key={key}
              className="cr-pal"
              data-locked={!unlocked}
              disabled={!unlocked}
              aria-label={
                unlocked
                  ? name
                  : `${name}, ${tr(t('verrouillée', 'locked'))}${level ? `, ${tr(t('niveau', 'level'))} ${String(level)}` : ''}`
              }
              {...(unlocked && { whileTap: { scale: 0.98 } })}
              onClick={() => {
                editor.applyPalette(paletteColors(key));
                onApplied(name);
                onClose();
              }}
            >
              <span className="cr-pal__head">
                <strong>{name}</strong>
                {!unlocked && (
                  <span className="cr-pal__lock">
                    <IconLock size={14} />
                    {level ? `${tr(t('Niveau', 'Level'))} ${String(level)}` : ''}
                  </span>
                )}
              </span>
              <span className="cr-pal__strip" aria-hidden>
                {(PALETTES[key] ?? []).map((c, i) => (
                  <span key={i} style={{ background: css(c) }} />
                ))}
              </span>
            </motion.button>
          );
        })}
      </div>
    </Sheet>
  );
}
