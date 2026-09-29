import { motion } from 'framer-motion';
import { useState } from 'react';
import { useCompletedArtworks, useLibrary } from '@/app/queries';
import {
  COLLECTION_REWARDS,
  COLLECTIONS,
  collectionProgress,
  eventCollectionRewards,
  type CollectionDef,
} from '@/content/collections';
import { daysLeft, EVENTS, isActive, occurrence, type SeasonalEvent } from '@/content/events';
import type { LibraryEntry, LibraryIndex } from '@/content/library/types';
import { libraryRef } from '@/content/refs';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { catalogItem } from '@/meta/catalog';
import { reward } from '@/meta/rewards';
import { useNav } from '@/store/nav';
import { spring } from '@/theme/motion/tokens';
import { Button, Card, Chip, ProgressRing, Screen, SectionHeader, Sheet, Skeleton } from '@/ui/kit';
import { Thumb } from '@/ui/library/Thumb';
import { rewardLabel } from '@/ui/meta/labels';
import { formatDay } from './profile/format';
import { IconCheckBold } from './profile/icons';
import { MosaicCard } from './profile/MosaicCard';
import { useMetaView } from './profile/useMetaView';
import { CountUp } from './profile/widgets';
import './profile/collections.css';

type Filter = 'all' | 'progress' | 'done';

const isDone = (def: CollectionDef, completed: ReadonlySet<string>) =>
  collectionProgress(def, completed) === def.artworks.length;

function Detail({
  title,
  ids,
  completed,
  library,
  rewards,
  playable,
  onClose,
}: {
  title: string;
  ids: readonly string[];
  completed: ReadonlySet<string>;
  library: LibraryIndex | null;
  rewards: string[];
  playable: boolean;
  onClose: () => void;
}) {
  const byId = new Map<string, LibraryEntry>(library?.artworks.map((a) => [a.id, a]) ?? []);
  const done = ids.filter((i) => completed.has(i)).length;
  return (
    <div className="col-sheet">
      <h3>{title}</h3>
      <p className="col-sheet__sub">
        {done} / {ids.length} {tr(t('œuvres terminées', 'artworks completed'))}
      </p>
      <ul className="col-sheet__grid">
        {ids.map((id) => {
          const entry = byId.get(id);
          const ok = completed.has(id);
          const label = entry ? tr(entry.title) : id;
          const canOpen = !ok && playable && entry !== undefined && library !== null;
          return (
            <li key={id}>
              <motion.button
                className="col-sheet__item"
                data-missing={!ok}
                disabled={!canOpen}
                aria-label={canOpen ? `${tr(t('Colorier', 'Color'))} ${label}` : label}
                {...(canOpen && { whileTap: { scale: 0.94 } })}
                transition={{ type: 'spring', ...spring.snappy }}
                onClick={() => {
                  if (!entry || !library) return;
                  onClose();
                  useNav.getState().open(libraryRef(entry, 'easy', library));
                }}
              >
                <span className="col-thumb" data-missing={!ok}>
                  <Thumb id={id} size={92} />
                  {ok && (
                    <span className="col-thumb__check">
                      <IconCheckBold size={14} />
                    </span>
                  )}
                </span>
                <span className="col-sheet__name">{label}</span>
              </motion.button>
            </li>
          );
        })}
      </ul>
      <div className="col-sheet__rewards">
        <span className="pf-eyebrow">{tr(t('Récompenses', 'Rewards'))}</span>
        <ul>
          {rewards.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <Button variant="tonal" onClick={onClose}>
        {tr(t('Fermer', 'Close'))}
      </Button>
    </div>
  );
}

interface Selection {
  title: string;
  ids: readonly string[];
  rewards: string[];
  playable: boolean;
}

function EventCard({
  event,
  index,
  entries,
  completed,
  day,
  onSelect,
}: {
  event: SeasonalEvent;
  index: number;
  entries: readonly LibraryEntry[];
  completed: ReadonlySet<string>;
  day: string;
  onSelect: (s: Selection) => void;
}) {
  const active = isActive(event, day);
  const occ = occurrence(event, day);
  const items = entries.map((e) => ({ id: e.id, done: completed.has(e.id) }));
  const frame = catalogItem(event.frame);
  const status = active
    ? `${tr(t('En cours', 'Live'))} · ${daysLeft(event, day)} ${tr(t('j restants', 'days left'))}`
    : `${formatDay(occ.start)} – ${formatDay(occ.end)}`;
  return (
    <MosaicCard
      index={index}
      name={event.name}
      items={items}
      note={status}
      badge={active ? <span className="col-live">{tr(t('En cours', 'Live'))}</span> : null}
      onClick={() => {
        onSelect({
          title: tr(event.name),
          ids: items.map((i) => i.id),
          playable: active,
          rewards: [
            ...eventCollectionRewards(null).map(rewardLabel),
            ...(frame ? [rewardLabel(reward.unlock(event.frame))] : []),
          ],
        });
      }}
    />
  );
}

export default function CollectionsScreen() {
  const completed = useCompletedArtworks();
  const library = useLibrary();
  const meta = useMetaView();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Selection | null>(null);
  const [open, setOpen] = useState(false);

  const ready = completed !== undefined;
  const doneCount = completed ? COLLECTIONS.filter((c) => isDone(c, completed)).length : 0;
  const visible = COLLECTIONS.filter((c) => {
    if (!completed || filter === 'all') return true;
    return filter === 'done' ? isDone(c, completed) : !isDone(c, completed);
  });
  const events = EVENTS.map((e) => ({
    event: e,
    entries: library?.artworks.filter((a) => a.event === e.id) ?? [],
  })).filter((e) => e.entries.length > 0);
  const day = meta?.snap.day;
  const editions = meta?.stat('events.collections') ?? 0;
  const collectionRewards = COLLECTION_REWARDS.map(rewardLabel);

  return (
    <Screen
      title={tr(t('Collections', 'Collections'))}
      className="col"
      onBack={() => {
        useNav.getState().pop();
      }}
    >
      <div className="pf-stack">
        <Card index={0} className="col-summary">
          <ProgressRing value={doneCount / COLLECTIONS.length} size={84} stroke={7}>
            <span className="col-summary__pct">{Math.round((doneCount / COLLECTIONS.length) * 100)} %</span>
          </ProgressRing>
          <div className="col-summary__text">
            <strong>
              {ready ? <CountUp value={doneCount} /> : <Skeleton width={36} height={26} />} /{' '}
              {COLLECTIONS.length}
            </strong>
            <span>{tr(t('collections terminées', 'collections completed'))}</span>
            <small>{collectionRewards.join(' · ')}</small>
          </div>
        </Card>
        <div
          className="ach-filters"
          role="group"
          aria-label={tr(t('Filtrer les collections', 'Filter collections'))}
        >
          {(
            [
              ['all', tr(t('Toutes', 'All'))],
              ['progress', tr(t('En cours', 'In progress'))],
              ['done', tr(t('Terminées', 'Completed'))],
            ] as const
          ).map(([id, label]) => (
            <Chip
              key={id}
              selected={filter === id}
              onClick={() => {
                setFilter(id);
              }}
            >
              {label}
            </Chip>
          ))}
        </div>
        {!completed &&
          [0, 1, 2].map((i) => (
            <Card key={i} index={i + 1}>
              <Skeleton width="55%" height={20} />
              <div style={{ height: 14 }} />
              <div className="col-skeleton">
                {Array.from({ length: 6 }, (_, k) => (
                  <Skeleton key={k} width={48} height={48} radius={14} />
                ))}
              </div>
            </Card>
          ))}
        {completed && visible.length === 0 && (
          <p className="pf-muted" style={{ textAlign: 'center' }}>
            {filter === 'done'
              ? tr(t('Aucune collection terminée pour l’instant.', 'No completed collection yet.'))
              : tr(t('Tout est terminé, bravo !', 'Everything is done, well played!'))}
          </p>
        )}
        {completed &&
          visible.map((def, i) => (
            <MosaicCard
              key={def.id}
              index={i + 1}
              name={def.name}
              items={def.artworks.map((id) => ({ id, done: completed.has(id) }))}
              onClick={() => {
                setSelected({
                  title: tr(def.name),
                  ids: def.artworks,
                  rewards: collectionRewards,
                  playable: true,
                });
                setOpen(true);
              }}
            />
          ))}
      </div>
      {completed && day && events.length > 0 && (
        <>
          <SectionHeader
            title={tr(t('Événements de saison', 'Seasonal events'))}
            action={
              <span className="pf-muted" style={{ margin: 0 }}>
                {editions} {tr(t('éditions terminées', 'editions completed'))}
              </span>
            }
          />
          <div className="pf-stack">
            {events.map((e, i) => (
              <EventCard
                key={e.event.id}
                event={e.event}
                index={i}
                entries={e.entries}
                completed={completed}
                day={day}
                onSelect={(s) => {
                  setSelected(s);
                  setOpen(true);
                }}
              />
            ))}
          </div>
        </>
      )}
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        label={tr(t('Détail de la collection', 'Collection details'))}
      >
        {selected && completed && (
          <Detail
            {...selected}
            completed={completed}
            library={library}
            onClose={() => {
              setOpen(false);
            }}
          />
        )}
      </Sheet>
    </Screen>
  );
}
