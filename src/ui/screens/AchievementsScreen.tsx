import { motion } from 'framer-motion';
import { useState } from 'react';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import type { AchievementDef } from '@/meta/achievements';
import { ACHIEVEMENTS } from '@/meta/achievements.data';
import { useNav } from '@/store/nav';
import { spring } from '@/theme/motion/tokens';
import { Card, Chip, EmptyState, ProgressRing, Screen, Skeleton } from '@/ui/kit';
import { IconTrophy } from '@/ui/meta/icons';
import { achievementTitle } from '@/ui/meta/labels';
import { AchievementSheet, type AchievementStatus } from './profile/AchievementSheet';
import { FAMILY_NAMES } from './profile/families';
import { fmt, formatMinutes } from './profile/format';
import { AchievementGlyph } from './profile/glyphs';
import { Medal } from './profile/Medal';
import { useMetaView, type MetaView } from './profile/useMetaView';
import { Bar, CountUp } from './profile/widgets';
import './profile/achievements.css';

type Filter = 'all' | 'earned' | 'progress';

/** Familles dans l'ordre des données. */
const GROUPS: readonly { id: string; defs: readonly AchievementDef[] }[] = (() => {
  const map = new Map<string, AchievementDef[]>();
  for (const d of ACHIEVEMENTS) map.set(d.group, [...(map.get(d.group) ?? []), d]);
  return [...map].map(([id, defs]) => ({ id, defs }));
})();

const compact = (n: number) =>
  new Intl.NumberFormat(tr(t('fr-FR', 'en-US')), { notation: 'compact', maximumFractionDigits: 1 }).format(n);

function statusOf(meta: MetaView, def: AchievementDef, index: number, count: number): AchievementStatus {
  return {
    def,
    earnedAt: meta.service.achievementUnlockedAt(def.id),
    value: meta.stat(def.metric),
    index,
    count,
  };
}

function isInProgress(list: readonly AchievementStatus[], s: AchievementStatus): boolean {
  if (s.earnedAt !== undefined || s.def.kind === 'secret') return false;
  const previous = list[s.index - 2];
  return s.value > 0 || (previous?.earnedAt !== undefined && s.def.kind === 'tiered');
}

function GroupCard({
  id,
  list,
  visible,
  rank,
  onSelect,
}: {
  id: string;
  list: readonly AchievementStatus[];
  visible: readonly AchievementStatus[];
  rank: number;
  onSelect: (s: AchievementStatus) => void;
}) {
  const first = list[0]?.def;
  if (!first) return null;
  const earned = list.filter((s) => s.earnedAt !== undefined).length;
  const tiered = first.kind === 'tiered';
  const next = tiered ? list.find((s) => s.earnedAt === undefined) : undefined;
  const complete = earned === list.length;
  return (
    <Card index={rank} className="ach-group">
      <header className="ach-group__head">
        <span className="ach-group__icon" data-complete={complete}>
          <AchievementGlyph icon={first.icon} size={22} />
        </span>
        <div className="ach-group__title">
          <strong>{tr(FAMILY_NAMES[id] ?? t('Succès', 'Achievements'))}</strong>
          <small>
            {earned} / {list.length}
            {complete && ` · ${tr(t('Complet', 'Complete'))}`}
          </small>
        </div>
        <Bar value={earned / list.length} tone={complete ? 'done' : 'primary'} />
      </header>
      {next && (
        <div className="ach-group__next">
          <span>
            {tr(t('Prochain :', 'Next:'))} <b>{achievementTitle(next.def.id)}</b>
          </span>
          <span className="ach-group__count">
            {next.def.metric === 'playtime.minutes'
              ? `${formatMinutes(next.value)} / ${formatMinutes(next.def.target)}`
              : `${fmt(Math.min(next.value, next.def.target))} / ${fmt(next.def.target)}`}
          </span>
        </div>
      )}
      <ul className="ach-medals" data-layout={tiered ? 'tiers' : 'grid'}>
        {visible.map((s) => {
          const isEarned = s.earnedAt !== undefined;
          const secret = s.def.kind === 'secret' && !isEarned;
          const title = secret ? '???' : achievementTitle(s.def.id);
          return (
            <li key={s.def.id}>
              <motion.button
                className="ach-medal"
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', ...spring.snappy }}
                aria-label={`${title}${isEarned ? ` (${tr(t('obtenu', 'earned'))})` : ''}`}
                onClick={() => {
                  onSelect(s);
                }}
              >
                <Medal
                  icon={s.def.icon}
                  rank={s.def.rank}
                  earned={isEarned}
                  secret={secret}
                  size={tiered ? 42 : 46}
                />
                <span className="ach-medal__label" data-secret={secret}>
                  {tiered ? compact(s.def.target) : title}
                </span>
              </motion.button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function AchievementsScreen() {
  const meta = useMetaView();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<AchievementStatus | null>(null);
  const [open, setOpen] = useState(false);

  const groups = meta
    ? GROUPS.map((g) => ({
        id: g.id,
        list: g.defs.map((d, i) => statusOf(meta, d, i + 1, g.defs.length)),
      }))
    : [];
  const total = ACHIEVEMENTS.length;
  const earnedCount = groups.reduce((n, g) => n + g.list.filter((s) => s.earnedAt !== undefined).length, 0);
  const secretsFound = groups
    .flatMap((g) => g.list)
    .filter((s) => s.def.kind === 'secret' && s.earnedAt !== undefined).length;
  const visibleGroups = groups
    .map((g) => ({
      ...g,
      visible: g.list.filter((s) =>
        filter === 'all' ? true : filter === 'earned' ? s.earnedAt !== undefined : isInProgress(g.list, s),
      ),
    }))
    .filter((g) => g.visible.length > 0);
  const counts = {
    all: total,
    earned: earnedCount,
    progress: groups.reduce((n, g) => n + g.list.filter((s) => isInProgress(g.list, s)).length, 0),
  };

  return (
    <Screen
      title={tr(t('Succès', 'Achievements'))}
      className="ach"
      onBack={() => {
        useNav.getState().pop();
      }}
    >
      <div className="pf-stack">
        <Card index={0} className="ach-summary">
          <ProgressRing value={earnedCount / total} size={84} stroke={7}>
            <span className="ach-summary__pct">{Math.round((earnedCount / total) * 100)} %</span>
          </ProgressRing>
          <div className="ach-summary__text">
            <strong>
              {meta ? <CountUp value={earnedCount} /> : <Skeleton width={40} height={26} />} / {total}
            </strong>
            <span>{tr(t('succès obtenus', 'achievements earned'))}</span>
            <small>
              {secretsFound} / {GROUPS.find((g) => g.id === 'secret')?.defs.length ?? 0}{' '}
              {tr(t('secrets découverts', 'secrets found'))}
            </small>
          </div>
        </Card>
        <div
          className="ach-filters"
          role="group"
          aria-label={tr(t('Filtrer les succès', 'Filter achievements'))}
        >
          {(
            [
              ['all', tr(t('Tous', 'All'))],
              ['earned', tr(t('Obtenus', 'Earned'))],
              ['progress', tr(t('En cours', 'In progress'))],
            ] as const
          ).map(([id, label]) => (
            <Chip
              key={id}
              selected={filter === id}
              onClick={() => {
                setFilter(id);
              }}
            >
              {label} · {meta ? counts[id] : '–'}
            </Chip>
          ))}
        </div>
        {!meta &&
          [0, 1, 2].map((i) => (
            <Card key={i} index={i + 1}>
              <Skeleton width="50%" height={20} />
              <div style={{ height: 12 }} />
              <Skeleton height={44} radius={22} />
            </Card>
          ))}
        {meta && visibleGroups.length === 0 && (
          <EmptyState
            icon={<IconTrophy size={32} />}
            title={
              filter === 'earned'
                ? tr(t('Pas encore de succès', 'No achievements yet'))
                : tr(t('Rien en cours', 'Nothing in progress'))
            }
            text={tr(
              t(
                'Colorie quelques cases : les premiers succès arrivent vite.',
                'Color a few cells: the first achievements come quickly.',
              ),
            )}
          />
        )}
        {visibleGroups.map((g, i) => (
          <GroupCard
            key={g.id}
            id={g.id}
            list={g.list}
            visible={g.visible}
            rank={i + 1}
            onSelect={(s) => {
              setSelected(s);
              setOpen(true);
            }}
          />
        ))}
      </div>
      <AchievementSheet
        status={selected}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </Screen>
  );
}
