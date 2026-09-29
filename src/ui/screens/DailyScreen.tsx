import { motion } from 'framer-motion';
import { useDailyHistory, useProjects } from '@/app/queries';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useMetaStore, type MetaSnapshot } from '@/store/meta';
import { useNav } from '@/store/nav';
import { Button, Screen, SectionHeader, Skeleton } from '@/ui/kit';
import { ChestTiles } from './daily/Chests';
import { EventBanners, NextEvent } from './daily/Events';
import { PastDays } from './daily/History';
import { Hero } from './daily/Hero';
import { useReroll } from './daily/hooks';
import { PeriodBonus, QuestItem } from './daily/QuestItem';
import { StreakCard } from './daily/StreakCard';
import './daily/daily.css';

function DailySkeleton() {
  return (
    <div className="daily-skeleton" aria-busy aria-label={tr(t('Chargement', 'Loading'))}>
      <Skeleton height={64} radius={20} />
      <Skeleton height={380} radius={24} />
      <Skeleton height={190} radius={24} />
      <Skeleton height={84} radius={20} />
      <Skeleton height={84} radius={20} />
    </div>
  );
}

function DailyContent({ snap }: { snap: MetaSnapshot }) {
  const projects = useProjects();
  const history = useDailyHistory(14);
  const reroll = useReroll();
  const daily = snap.quests.filter((q) => q.period === 'daily');
  const done = daily.filter((q) => q.doneAt !== null).length;
  return (
    <div className="daily-page">
      <EventBanners day={snap.day} />

      <div className="daily-block">
        <Hero key={snap.day} day={snap.day} projects={projects} index={0} />
      </div>

      <SectionHeader title={tr(t('Les jours précédents', 'Previous days'))} />
      <PastDays day={snap.day} projects={projects} />

      <SectionHeader title={tr(t('Ta série', 'Your streak'))} />
      <div className="daily-block">
        <StreakCard snap={snap} history={history} index={1} />
      </div>

      <SectionHeader
        title={tr(t('Quêtes du jour', 'Daily quests'))}
        action={
          <Button
            variant="text"
            onClick={() => {
              useNav.getState().push('quests');
            }}
          >
            {tr(t('Toutes les quêtes', 'All quests'))}
          </Button>
        }
      />
      <div className="daily-block">
        <ul className="daily-quests">
          {daily.map((q, i) => (
            <QuestItem
              key={q.id}
              q={q}
              level={snap.level.level}
              canReroll={snap.canReroll}
              onReroll={reroll}
              index={i}
            />
          ))}
        </ul>
        {daily.length > 0 && <PeriodBonus period="daily" done={done} total={daily.length} />}
      </div>

      <SectionHeader title={tr(t('Tes coffres', 'Your chests'))} />
      <div className="daily-block">
        <ChestTiles chests={snap.chests} index={2} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <NextEvent day={snap.day} />
      </motion.div>
    </div>
  );
}

/** Onglet « Du jour » : œuvre du jour, série, quêtes et coffres. */
export default function DailyScreen() {
  const snap = useMetaStore((s) => s.snap);
  return (
    <Screen title={tr(t('Du jour', 'Today'))} className="daily">
      {snap ? <DailyContent snap={snap} /> : <DailySkeleton />}
    </Screen>
  );
}
