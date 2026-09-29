import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { getCategory } from '@/content/categories';
import type { Difficulty, LibraryEntry } from '@/content/library/types';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { ProgressRing } from '@/ui/kit';
import { Thumb } from '@/ui/library/Thumb';
import { IconCheck } from '@/ui/meta/icons';
import { fraction, percent, statusOf, type WorkState } from './data';
import { isNew, type useSeen } from './seen';

/** Œuvres affichées par « page » : la grille se prolonge en douceur au fil du défilement. */
const PAGE = 24;

function WorkCard({
  entry,
  rank,
  state,
  difficulty,
  fresh,
  showCategory,
  onPick,
}: {
  entry: LibraryEntry;
  rank: number;
  state: WorkState | undefined;
  difficulty: Difficulty | null;
  fresh: boolean;
  showCategory: boolean;
  onPick: (entry: LibraryEntry, from: Element | null) => void;
}) {
  const reduced = useReducedMotion();
  const lang = locale();
  const { status, project } = statusOf(state, difficulty);
  const isFresh = fresh && status === 'todo';
  const title = entry.title[lang];
  const extra =
    status === 'doing' && project
      ? tr(t(`, en cours, ${percent(project)} %`, `, in progress, ${percent(project)}%`))
      : status === 'done'
        ? tr(t(', terminée', ', finished'))
        : isFresh
          ? tr(t(', nouveau', ', new'))
          : '';
  return (
    <motion.button
      className="lib-card"
      aria-label={`${title}${extra}`}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', ...spring.gentle, delay: staggerDelay(rank % PAGE, 28, 340) / 1000 }}
      onClick={(e) => {
        onPick(entry, e.currentTarget.querySelector('.lib-card__art'));
      }}
    >
      <span className="lib-card__art" data-fresh={isFresh}>
        <Thumb id={entry.id} size={180} />
        {isFresh && (
          <>
            <span className="lib-card__shine" aria-hidden />
            <span className="lib-new">{tr(t('Nouveau', 'New'))}</span>
          </>
        )}
        {status === 'doing' && project && (
          <span className="lib-card__ring">
            <ProgressRing value={fraction(project)} size={38} stroke={4}>
              <span className="lib-card__pct">{percent(project)}</span>
            </ProgressRing>
          </span>
        )}
        {status === 'done' && (
          <span className="lib-check">
            <IconCheck size={16} />
          </span>
        )}
      </span>
      <span className="lib-card__title">{title}</span>
      {showCategory && <span className="lib-card__meta">{getCategory(entry.category).name[lang]}</span>}
    </motion.button>
  );
}

/**
 * Grille à deux colonnes, paginée de façon incrémentale (les vignettes ne se dessinent
 * de toute façon que lorsqu'elles deviennent visibles). À remonter (`key`) quand les filtres changent.
 */
export function WorkGrid({
  entries,
  states,
  difficulty,
  seen,
  showCategory,
  onPick,
}: {
  entries: readonly LibraryEntry[];
  states: ReadonlyMap<string, WorkState>;
  difficulty: Difficulty | null;
  seen: ReturnType<typeof useSeen>;
  showCategory: boolean;
  onPick: (entry: LibraryEntry, from: Element | null) => void;
}) {
  const [count, setCount] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  const more = count < entries.length;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    const io = new IntersectionObserver(
      (list) => {
        if (list.some((e) => e.isIntersecting)) setCount((c) => c + PAGE);
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [more, count]);
  return (
    <>
      <div className="lib-grid">
        {entries.slice(0, count).map((e, i) => (
          <WorkCard
            key={e.id}
            entry={e}
            rank={i}
            state={states.get(e.id)}
            difficulty={difficulty}
            fresh={isNew(seen, e.id)}
            showCategory={showCategory}
            onPick={onPick}
          />
        ))}
      </div>
      {more && <div ref={sentinel} className="lib-more" aria-hidden />}
    </>
  );
}
