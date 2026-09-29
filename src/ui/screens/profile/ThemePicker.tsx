import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { tr } from '@/i18n/locale';
import { t, type I18nText } from '@/i18n/text';
import { useSettings, type ThemeId } from '@/store/settings';
import { fallbackPalettes, materialTokens, systemDark } from '@/theme/applyTheme';
import { spring } from '@/theme/motion/tokens';
import { IconCheckBold } from './icons';
import './settings.css';

const THEMES: readonly { id: ThemeId; name: I18nText }[] = [
  { id: 'doux', name: t('Doux', 'Soft') },
  { id: 'material', name: t('Material You', 'Material You') },
  { id: 'clair', name: t('Clair', 'Light') },
  { id: 'sombre', name: t('Sombre', 'Dark') },
];

/** Mini-écran peint avec les jetons du thème (l'attribut data-theme les redéfinit localement). */
function Preview({ id, current }: { id: ThemeId; current: ThemeId }) {
  // Material You actif : les jetons du téléphone sont déjà sur <html> ; sinon, palette de repli
  const style: CSSProperties | undefined =
    id === 'material' && current !== 'material'
      ? materialTokens(fallbackPalettes(), systemDark())
      : undefined;
  return (
    <span className="set-mini" {...(id !== 'material' && { 'data-theme': id })} style={style} aria-hidden>
      <span className="set-mini__bar">
        <i />
        <b />
      </span>
      <span className="set-mini__card">
        <i />
        <i />
        <em />
      </span>
      <span className="set-mini__dots">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

export function ThemePicker() {
  const theme = useSettings((s) => s.theme);
  return (
    <div className="set-themes" role="group" aria-label={tr(t('Thème', 'Theme'))}>
      {THEMES.map((th) => {
        const selected = theme === th.id;
        return (
          <motion.button
            key={th.id}
            className="set-theme"
            aria-pressed={selected}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', ...spring.snappy }}
            onClick={() => {
              useSettings.getState().set({ theme: th.id });
            }}
          >
            <Preview id={th.id} current={theme} />
            <span className="set-theme__label">
              {tr(th.name)}
              {selected && (
                <motion.span
                  className="set-theme__check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', ...spring.bouncy }}
                >
                  <IconCheckBold size={12} />
                </motion.span>
              )}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
