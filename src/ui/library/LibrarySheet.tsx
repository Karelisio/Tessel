import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { CATEGORIES } from '@/content/categories';
import { dailyArtwork } from '@/content/daily';
import { activeEvents, daysLeft } from '@/content/events';
import { DIFFICULTIES, type Difficulty, type LibraryEntry, type LibraryIndex } from '@/content/library/types';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { unlockLevel } from '@/meta/unlocks';
import { useMetaStore } from '@/store/meta';
import { spring } from '@/theme/motion/tokens';
import { IconLock } from '@/ui/meta/icons';
import { Thumb } from './Thumb';
import './library.css';

const DIFF_NAMES: Record<Difficulty, ReturnType<typeof t>> = {
  easy: t('Facile', 'Easy'),
  medium: t('Moyen', 'Medium'),
  hard: t('Difficile', 'Hard'),
  expert: t('Expert', 'Expert'),
};

interface Props {
  open: boolean;
  index: LibraryIndex | null;
  onClose: () => void;
  onPlay: (entry: LibraryEntry, difficulty: Difficulty) => void;
  onDaily: () => void;
  onImport: () => void;
}

function Card({ entry, locked, onPick }: { entry: LibraryEntry; locked: boolean; onPick: () => void }) {
  return (
    <motion.button className="lib-card" data-locked={locked} whileTap={{ scale: 0.94 }} onClick={onPick}>
      <Thumb id={entry.id} size={104} />
      <span className="lib-card__title">{tr(entry.title)}</span>
    </motion.button>
  );
}

/** Bibliothèque minimale (avant l'écran définitif) : œuvre du jour, événement, catégories. */
export function LibrarySheet({ open, index, onClose, onPlay, onDaily, onImport }: Props) {
  const snap = useMetaStore((s) => s.snap);
  const [picked, setPicked] = useState<LibraryEntry | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const day = snap?.day ?? '2026-01-01';
  const daily = useMemo(() => dailyArtwork(day), [day]);
  const loadDaily = useMemo(() => () => Promise.resolve(daily.grid()), [daily]);
  const events = activeEvents(day);
  const unlocked = new Set(snap?.categories ?? []);
  const groups = useMemo(() => {
    const all = index?.artworks ?? [];
    return CATEGORIES.map((c) => ({
      c,
      items: all.filter((a) => a.category === c.id && a.event === undefined),
    })).filter((g) => g.items.length > 0);
  }, [index]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            className="library-sheet"
            role="dialog"
            aria-label={tr(t('Bibliothèque', 'Library'))}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', ...spring.sheet }}
          >
            <div className="sheet-grip" />
            <header className="lib-head">
              <h2>{tr(t('Bibliothèque', 'Library'))}</h2>
              <button className="btn btn--small" onClick={onImport}>
                {tr(t('Importer une photo', 'Import a photo'))}
              </button>
            </header>

            <motion.button className="lib-daily" whileTap={{ scale: 0.97 }} onClick={onDaily}>
              <Thumb id={daily.id} load={loadDaily} size={88} />
              <span>
                <small>{tr(t('Œuvre du jour', 'Daily artwork'))}</small>
                <strong>{tr(daily.title)}</strong>
              </span>
            </motion.button>

            {events.map((e) => {
              const items = (index?.artworks ?? []).filter((a) => a.event === e.id);
              if (items.length === 0) return null;
              return (
                <section key={e.id} className="lib-group lib-group--event">
                  <h3>
                    {tr(e.name)}{' '}
                    <span className="ps-muted">
                      · {tr(t(`encore ${daysLeft(e, day)} j`, `${daysLeft(e, day)} days left`))}
                    </span>
                  </h3>
                  <div className="lib-row">
                    {items.map((a) => (
                      <Card
                        key={a.id}
                        entry={a}
                        locked={false}
                        onPick={() => {
                          setPicked(a);
                        }}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {groups.map(({ c, items }) => {
              const locked = snap !== null && !unlocked.has(c.id);
              return (
                <section key={c.id} className="lib-group">
                  <h3>
                    {tr(c.name)}
                    {locked && (
                      <span className="lib-lock">
                        <IconLock size={13} /> {tr(t('Niveau', 'Level'))}{' '}
                        {unlockLevel(`category:${c.id}`) ?? ''}
                      </span>
                    )}
                  </h3>
                  <div className="lib-row">
                    {items.map((a) => (
                      <Card
                        key={a.id}
                        entry={a}
                        locked={locked}
                        onPick={() => {
                          if (!locked) setPicked(a);
                        }}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            <AnimatePresence>
              {picked && (
                <motion.div
                  className="lib-pick"
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 40, opacity: 0 }}
                  transition={{ type: 'spring', ...spring.snappy }}
                >
                  <div className="lib-pick__head">
                    <Thumb id={picked.id} size={64} />
                    <div>
                      <strong>{tr(picked.title)}</strong>
                      {picked.credit && (
                        <small>
                          {picked.credit.artist} · {picked.credit.museum}
                        </small>
                      )}
                    </div>
                    <button
                      className="lib-pick__close"
                      aria-label={tr(t('Fermer', 'Close'))}
                      onClick={() => {
                        setPicked(null);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="lib-diffs" role="group">
                    {DIFFICULTIES.map((d) => {
                      const v = picked.variants[d];
                      return (
                        <button
                          key={d}
                          className="lib-diff"
                          aria-pressed={difficulty === d}
                          onClick={() => {
                            setDifficulty(d);
                          }}
                        >
                          <strong>{tr(DIFF_NAMES[d])}</strong>
                          <small>
                            {v.width}×{v.height} · {v.colors} {tr(t('couleurs', 'colors'))}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                  <motion.button
                    className="btn btn--primary"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onPlay(picked, difficulty);
                      setPicked(null);
                    }}
                  >
                    {tr(t('Colorier', 'Start coloring'))}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
