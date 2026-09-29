import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useLibrary, useProjects } from '@/app/queries';
import { getCategory, type CategoryId } from '@/content/categories';
import { activeEvents, daysLeft } from '@/content/events';
import type { LibraryEntry } from '@/content/library/types';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useMetaStore } from '@/store/meta';
import { Button, EmptyState, Screen, SectionHeader } from '@/ui/kit';
import { IconSearch } from '@/ui/kit/icons';
import { ChooseSheet } from './library/ChooseSheet';
import { applyFilters, buildStates, hash } from './library/data';
import { EventBanner } from './library/EventBanner';
import { ResumeHero, SuggestHero } from './library/Hero';
import { ImportCard } from './library/ImportCard';
import { categoryLevel } from './library/labels';
import { InProgressRow } from './library/ProgressRow';
import { ensureBaseline, markSeen, useSeen } from './library/seen';
import { HeroSkeleton, LibrarySkeleton } from './library/Skeletons';
import { Toolbar } from './library/Toolbar';
import { NO_FILTERS, type Filters } from './library/types';
import { WorkGrid } from './library/WorkGrid';
import './library/library-screen.css';

/** Bibliothèque : reprendre, événement du moment, catégories, recherche et grille des œuvres. */
export default function LibraryScreen() {
  const library = useLibrary();
  const projects = useProjects();
  const snap = useMetaStore((s) => s.snap);
  const seen = useSeen();

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const [sheet, setSheet] = useState<{ entry: LibraryEntry; open: boolean; from: Element | null } | null>(
    null,
  );
  const anchor = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<number | undefined>(undefined);

  const deferredQuery = useDeferredValue(filters.query);
  const ready = library !== null && snap !== null;

  // Premier passage : les œuvres déjà accessibles ne brillent pas, seules les suivantes le feront.
  useEffect(() => {
    if (!library || !snap) return;
    ensureBaseline(() =>
      library.artworks
        .filter((a) => a.event === undefined && snap.categories.includes(a.category))
        .map((a) => a.id),
    );
  }, [library, snap]);

  // Barre de recherche « collée » : fond et ombre légère une fois sous le titre.
  useEffect(() => {
    const el = anchor.current;
    if (!el || !ready) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e) setStuck(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0));
      },
      { rootMargin: '-64px 0px 0px 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [ready]);

  useEffect(
    () => () => {
      window.clearTimeout(hintTimer.current);
    },
    [],
  );

  if (!ready) {
    return (
      <Screen title={tr(t('Bibliothèque', 'Library'))}>
        <LibrarySkeleton />
      </Screen>
    );
  }

  const lang = locale();
  const states = buildStates(projects);
  const unlocked = new Set<string>(snap.categories);
  const events = activeEvents(snap.day);
  const activeEventIds = new Set(events.map((e) => e.id));
  const available = library.artworks.filter(
    (a) => unlocked.has(a.category) && (a.event === undefined || activeEventIds.has(a.event)),
  );
  const lockedCount = library.artworks.filter((a) => !unlocked.has(a.category)).length;

  const openProjects = (projects ?? []).filter((p) => p.completedAt === null && p.filled > 0);
  const [resume, ...others] = openProjects;
  const anyDone = (projects ?? []).some((p) => p.completedAt !== null);

  const suggestions = available.filter((a) => a.event === undefined && !states.has(a.id));
  const suggestion = suggestions[hash(snap.day) % Math.max(1, suggestions.length)];

  const results = applyFilters(available, states, { ...filters, query: deferredQuery });
  const filtering =
    filters.category !== null ||
    filters.query !== '' ||
    filters.status !== 'all' ||
    filters.difficulty !== null;
  const gridKey = `${filters.category ?? '*'}|${deferredQuery}|${filters.difficulty ?? '*'}|${filters.status}`;

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    anchor.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const pick = (entry: LibraryEntry, from: Element | null) => {
    markSeen(entry.id);
    setSheet({ entry, open: true, from });
  };
  const lockedCategory = (id: CategoryId) => {
    const level = categoryLevel(id);
    const name = getCategory(id).name[lang];
    const left = level === undefined ? 0 : Math.max(1, level - snap.level.level);
    setHint(
      level === undefined
        ? tr(t(`${name} n’est pas encore débloqué.`, `${name} is not unlocked yet.`))
        : tr(
            t(
              `${name} s’ouvre au niveau ${level}. Encore ${left} niveau${left > 1 ? 'x' : ''} à colorier, tranquillement.`,
              `${name} opens at level ${level}. ${left} more level${left > 1 ? 's' : ''} to go, no rush.`,
            ),
          ),
    );
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => {
      setHint(null);
    }, 3200);
  };

  return (
    <>
      <Screen title={tr(t('Bibliothèque', 'Library'))}>
        <div className="lib">
          <div className="lib__top">
            {projects === undefined ? (
              <HeroSkeleton />
            ) : resume ? (
              <ResumeHero project={resume} library={library} />
            ) : suggestion ? (
              <SuggestHero entry={suggestion} first={!anyDone} onPick={pick} />
            ) : null}
          </div>

          {others.length > 0 && <InProgressRow projects={others} library={library} />}

          {events.map((e) => {
            const entries = library.artworks.filter((a) => a.event === e.id);
            return entries.length > 0 ? (
              <div className="lib__top" key={e.id}>
                <EventBanner
                  event={e}
                  left={daysLeft(e, snap.day)}
                  entries={entries}
                  states={states}
                  onPick={pick}
                />
              </div>
            ) : null;
          })}

          <div className="lib__top lib__import">
            <ImportCard index={3} />
          </div>

          <div ref={anchor} className="lib__anchor" />
          <Toolbar
            filters={filters}
            onChange={update}
            unlocked={unlocked}
            filtersOpen={filtersOpen}
            onToggleFilters={() => {
              setFiltersOpen((o) => !o);
            }}
            onLockedCategory={lockedCategory}
            hint={hint}
            stuck={stuck}
          />

          <SectionHeader
            title={
              filters.category === null
                ? tr(t('Toutes les œuvres', 'All artworks'))
                : getCategory(filters.category).name[lang]
            }
            action={<span className="lib-count">{results.length}</span>}
          />

          {results.length === 0 ? (
            <EmptyState
              icon={<IconSearch size={32} />}
              title={tr(t('Rien par ici', 'Nothing here'))}
              text={tr(
                t(
                  'Aucune œuvre ne correspond. Essaie un autre mot, ou assouplis les filtres.',
                  'No artwork matches. Try another word, or loosen the filters.',
                ),
              )}
              action={
                <Button
                  variant="tonal"
                  onClick={() => {
                    setFilters(NO_FILTERS);
                  }}
                >
                  {tr(t('Tout effacer', 'Clear all'))}
                </Button>
              }
            />
          ) : (
            <WorkGrid
              key={gridKey}
              entries={results}
              states={states}
              difficulty={filters.difficulty}
              seen={seen}
              showCategory={filters.category === null}
              onPick={pick}
            />
          )}

          {!filtering && lockedCount > 0 && (
            <p className="lib-footnote">
              {tr(
                t(
                  `${lockedCount} autres œuvres t’attendent dans les catégories à débloquer.`,
                  `${lockedCount} more artworks await in the categories still to unlock.`,
                ),
              )}
            </p>
          )}
        </div>
      </Screen>
      <ChooseSheet
        entry={sheet?.entry ?? null}
        from={sheet?.from ?? null}
        open={sheet?.open ?? false}
        onClose={() => {
          setSheet((s) => (s ? { ...s, open: false } : s));
        }}
        library={library}
        states={states}
        modes={snap.modes}
        level={snap.level.level}
        preferred={filters.difficulty}
      />
    </>
  );
}
