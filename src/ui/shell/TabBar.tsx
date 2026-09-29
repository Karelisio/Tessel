import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { tr } from '@/i18n/locale';
import { t, type I18nText } from '@/i18n/text';
import { TABS, useNav, type TabId } from '@/store/nav';
import { spring } from '@/theme/motion/tokens';
import { IconCreate, IconDaily, IconGallery, IconLibrary, IconProfile } from '@/ui/kit/icons';

const TAB_INFO: Record<TabId, { label: I18nText; icon: ReactNode }> = {
  library: { label: t('Bibliothèque', 'Library'), icon: <IconLibrary /> },
  daily: { label: t('Du jour', 'Daily'), icon: <IconDaily /> },
  gallery: { label: t('Galerie', 'Gallery'), icon: <IconGallery /> },
  create: { label: t('Créer', 'Create'), icon: <IconCreate /> },
  profile: { label: t('Profil', 'Profile'), icon: <IconProfile /> },
};

/** Barre de navigation Material 3 : indicateur en pilule qui glisse d'un onglet à l'autre, pastilles. */
export function TabBar({ badges }: { badges: Partial<Record<TabId, boolean>> }) {
  const tab = useNav((s) => s.tab);
  const setTab = useNav((s) => s.setTab);
  return (
    <nav className="tabbar" aria-label="Navigation">
      {TABS.map((id) => {
        const active = id === tab;
        const info = TAB_INFO[id];
        return (
          <motion.button
            key={id}
            className="tabbar__item"
            aria-current={active ? 'page' : undefined}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setTab(id);
            }}
          >
            <span className="tabbar__icon">
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="tabbar__pill"
                  transition={{ type: 'spring', ...spring.snappy }}
                />
              )}
              <motion.span
                animate={{ y: active ? -1 : 0, scale: active ? 1.06 : 1 }}
                transition={{ type: 'spring', ...spring.bouncy }}
                style={{ display: 'grid', position: 'relative' }}
              >
                {info.icon}
              </motion.span>
              {badges[id] && <span className="tabbar__dot" />}
            </span>
            <span className="tabbar__label">{tr(info.label)}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}
