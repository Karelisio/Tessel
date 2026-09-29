import { motion } from 'framer-motion';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { formatNumber } from '@/meta/format';
import type { Quest } from '@/meta/quests';
import { useMetaStore, type MetaSnapshot } from '@/store/meta';
import { useNav } from '@/store/nav';
import { Card, ProgressRing, Screen, SectionHeader, Skeleton } from '@/ui/kit';
import { useReroll } from './daily/hooks';
import { PeriodBonus, QuestItem } from './daily/QuestItem';
import './daily/daily.css';

function Summary({
  daily,
  weekly,
  index,
}: {
  daily: readonly Quest[];
  weekly: readonly Quest[];
  index: number;
}) {
  const count = (list: readonly Quest[]) => list.filter((q) => q.doneAt !== null).length;
  const rings = [
    { label: tr(t('Aujourd’hui', 'Today')), list: daily },
    { label: tr(t('Cette semaine', 'This week')), list: weekly },
  ];
  return (
    <Card index={index} className="daily-summary">
      {rings.map(({ label, list }) => {
        const done = count(list);
        return (
          <div
            key={label}
            className="daily-summary__item"
            role="img"
            aria-label={`${label} : ${done} / ${list.length}`}
          >
            <ProgressRing
              value={list.length > 0 ? done / list.length : 0}
              size={56}
              stroke={6}
              color="var(--tertiary)"
            >
              {done}/{list.length}
            </ProgressRing>
            <span>{label}</span>
          </div>
        );
      })}
    </Card>
  );
}

function QuestsContent({ snap }: { snap: MetaSnapshot }) {
  const reroll = useReroll();
  const daily = snap.quests.filter((q) => q.period === 'daily');
  const weekly = snap.quests.filter((q) => q.period === 'weekly');
  const level = snap.level.level;
  const left = snap.weekDaysLeft;
  const doneOf = (list: readonly Quest[]) => list.filter((q) => q.doneAt !== null).length;
  const n = (v: number) => formatNumber(v, locale());
  return (
    <div className="daily-page">
      <div className="daily-block">
        <Summary daily={daily} weekly={weekly} index={0} />
      </div>

      <SectionHeader title={tr(t('Quêtes du jour', 'Daily quests'))} />
      <div className="daily-block">
        <ul className="daily-quests">
          {daily.map((q, i) => (
            <QuestItem
              key={q.id}
              q={q}
              level={level}
              canReroll={snap.canReroll}
              onReroll={reroll}
              index={i + 1}
              detailed
            />
          ))}
        </ul>
        {daily.length > 0 && <PeriodBonus period="daily" done={doneOf(daily)} total={daily.length} />}
        <p className="daily-note">
          {tr(t('De nouvelles quêtes arrivent demain.', 'New quests arrive tomorrow.'))}
        </p>
      </div>

      <SectionHeader
        title={tr(t('Quêtes de la semaine', 'Weekly quests'))}
        action={
          <span className="daily-muted">
            {left <= 1
              ? tr(t('dernier jour', 'last day'))
              : tr(t(`encore ${n(left)} jours`, `${n(left)} days left`))}
          </span>
        }
      />
      <div className="daily-block">
        <ul className="daily-quests">
          {weekly.map((q, i) => (
            <QuestItem
              key={q.id}
              q={q}
              level={level}
              canReroll={snap.canReroll}
              onReroll={reroll}
              index={i + 4}
              detailed
            />
          ))}
        </ul>
        {weekly.length > 0 && <PeriodBonus period="weekly" done={doneOf(weekly)} total={weekly.length} />}
      </div>

      <motion.p className="daily-note daily-note--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {snap.canReroll
          ? tr(
              t(
                'Une quête ne te plaît pas ? Touche la flèche pour la remplacer, une fois par jour.',
                'Not feeling a quest? Tap the arrow to swap it, once a day.',
              ),
            )
          : tr(
              t(
                'Remplacement du jour utilisé : il revient demain.',
                'Today’s swap is used: it’s back tomorrow.',
              ),
            )}
      </motion.p>
    </div>
  );
}

/** Sous-page : quêtes du jour et de la semaine. */
export default function QuestsScreen() {
  const snap = useMetaStore((s) => s.snap);
  return (
    <Screen
      title={tr(t('Quêtes', 'Quests'))}
      className="daily"
      onBack={() => {
        useNav.getState().pop();
      }}
    >
      {snap ? (
        <QuestsContent snap={snap} />
      ) : (
        <div className="daily-skeleton" aria-busy>
          <Skeleton height={100} radius={24} />
          <Skeleton height={84} radius={20} />
          <Skeleton height={84} radius={20} />
          <Skeleton height={84} radius={20} />
        </div>
      )}
    </Screen>
  );
}
