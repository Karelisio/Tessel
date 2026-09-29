import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, type ComponentType } from 'react';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useMetaStore } from '@/store/meta';
import { useNav, type SubPage, type TabId } from '@/store/nav';
import { duration } from '@/theme/motion/tokens';
import { IconCreate, IconGallery } from '@/ui/kit/icons';
import { Skeleton } from '@/ui/kit';
import { PlaceholderScreen } from '@/ui/screens/Placeholder';
import { LivingBackground } from './LivingBackground';
import { TabBar } from './TabBar';
import './shell.css';

const LibraryScreen = lazy(() => import('@/ui/screens/LibraryScreen'));
const DailyScreen = lazy(() => import('@/ui/screens/DailyScreen'));
const ProfileScreen = lazy(() => import('@/ui/screens/ProfileScreen'));
const SUBPAGES: Record<SubPage, ComponentType> = {
  achievements: lazy(() => import('@/ui/screens/AchievementsScreen')),
  collections: lazy(() => import('@/ui/screens/CollectionsScreen')),
  stats: lazy(() => import('@/ui/screens/StatsScreen')),
  settings: lazy(() => import('@/ui/screens/SettingsScreen')),
  quests: lazy(() => import('@/ui/screens/QuestsScreen')),
};

function TabPage({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'library':
      return <LibraryScreen />;
    case 'daily':
      return <DailyScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'gallery':
      return (
        <PlaceholderScreen
          title={tr(t('Galerie', 'Gallery'))}
          icon={<IconGallery size={36} />}
          text={tr(
            t(
              'Tes œuvres terminées s’exposeront bientôt ici, dans leurs cadres.',
              'Your finished artworks will soon hang here, framed.',
            ),
          )}
        />
      );
    case 'create':
      return (
        <PlaceholderScreen
          title={tr(t('Créer', 'Create'))}
          icon={<IconCreate size={36} />}
          text={tr(t('L’atelier de pixel art arrive bientôt.', 'The pixel art studio is coming soon.'))}
        />
      );
  }
}

function Loading() {
  return (
    <div style={{ padding: 'calc(var(--safe-top) + 70px) 20px', display: 'grid', gap: 14 }}>
      <Skeleton width="55%" height={34} />
      <Skeleton height={150} radius={24} />
      <Skeleton height={110} radius={24} />
    </div>
  );
}

/** Coque à 5 onglets, sous-pages empilées avec glissement, fond vivant. */
export function Shell() {
  const tab = useNav((s) => s.tab);
  const stack = useNav((s) => s.stack);
  const playing = useNav((s) => s.playing);
  const snap = useMetaStore((s) => s.snap);
  const top = stack[stack.length - 1];
  const Sub = top ? SUBPAGES[top] : null;
  const dailyPending = snap !== null && snap.quests.some((q) => q.period === 'daily' && q.doneAt === null);
  return (
    <motion.div
      className="shell"
      initial={false}
      animate={{ opacity: playing ? 0 : 1, scale: playing ? 0.98 : 1 }}
      transition={{ duration: duration.md / 1000 }}
      style={{ pointerEvents: playing ? 'none' : 'auto', visibility: playing ? 'hidden' : 'visible' }}
      aria-hidden={playing}
    >
      <LivingBackground />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={tab}
          className="shell__page"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.md / 1000 }}
        >
          <Suspense fallback={<Loading />}>
            <TabPage tab={tab} />
          </Suspense>
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {Sub && top && (
          <motion.div
            key={top}
            className="shell__page shell__sub"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <LivingBackground />
            <Suspense fallback={<Loading />}>
              <Sub />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
      <TabBar
        badges={{
          daily: dailyPending,
          profile:
            (snap?.unseen ?? 0) > 0 ||
            (snap ? snap.chests.small + snap.chests.medium + snap.chests.large > 0 : false),
        }}
      />
    </motion.div>
  );
}
