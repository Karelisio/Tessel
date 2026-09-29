import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useProjects } from '@/app/queries';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import type { UnlockKey } from '@/meta/catalog';
import { useMetaStore } from '@/store/meta';
import { useSettings } from '@/store/settings';
import { Button, Chip, IconButton, Screen } from '@/ui/kit';
import { ArtFrame, GhostItem } from './gallery/ArtFrame';
import { Detail } from './gallery/Detail';
import { EmptyWall } from './gallery/EmptyWall';
import { FilterSheet } from './gallery/FilterSheet';
import { IconSliders, IconWall } from './gallery/icons';
import { attachLight } from './gallery/light';
import { arrange, modeName, NO_FILTER, present, type Filters, type SortKey } from './gallery/model';
import { prefetchThumbs } from './gallery/thumbs';
import { useToast } from './gallery/Toast';
import { WallSheet } from './gallery/WallSheet';
import { useWallChoice, wallStyle } from './gallery/walls';
import './gallery/gallery.css';

const STARTER_WALLS: readonly UnlockKey[] = ['wall:platre', 'wall:bois-clair'];

/** Galerie : les œuvres terminées, encadrées, exposées sur un mur qu'on choisit et qui reçoit la lumière. */
export default function GalleryScreen() {
  const reducedOs = useReducedMotion();
  const reducedSetting = useSettings((s) => s.reducedMotion);
  const reduced = reducedOs || reducedSetting;
  const projects = useProjects({ completed: true });
  const service = useMetaStore((s) => s.service);
  useMetaStore((s) => s.snap); // se remet à jour quand un déblocage arrive
  const unlockedFrames = service?.unlocked('frame') ?? [];
  const unlockedWalls = new Set<string>([...STARTER_WALLS, ...(service?.unlocked('wall') ?? [])]);
  const [wall, chooseWall] = useWallChoice(unlockedWalls);
  const [sort, setSort] = useState<SortKey>('recent');
  const [filters, setFilters] = useState<Filters>(NO_FILTER);
  const [panel, setPanel] = useState<'wall' | 'filter' | null>(null);
  const [opened, setOpened] = useState<{ id: string; from: DOMRect | null } | null>(null);
  const openId = opened?.id ?? null;
  const { notify, toast } = useToast();

  const root = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);

  const shown = useMemo(
    () => (projects ? arrange(projects, sort, filters) : undefined),
    [projects, sort, filters],
  );
  const { modes, categories } = useMemo(() => present(projects ?? []), [projects]);
  const detail = openId !== null ? projects?.find((p) => p.id === openId) : undefined;

  // éclairage : halo qui glisse avec le défilement, ombres des cadres, reflets des diamants
  useEffect(() => {
    const scroller = root.current?.closest<HTMLElement>('.screen__scroll');
    const light = halo.current;
    if (!scroller || !light) return;
    return attachLight({ scroller, halo: light, idle: !reduced });
  }, [reduced]);

  // le reste des miniatures se prépare en arrière-plan, une fois les premières servies
  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => {
      prefetchThumbs(
        shown.slice(0, 60).map((p) => ({ id: p.id, updatedAt: p.updatedAt, frame: p.frame, size: 480 })),
      );
    }, 900);
    return () => {
      window.clearTimeout(timer);
    };
  }, [shown]);

  const total = projects?.length ?? 0;
  const count = shown?.length ?? 0;
  const filtered = filters.mode !== null || filters.category !== null;
  const customized = filtered || sort !== 'recent';
  const counter =
    projects === undefined
      ? ''
      : filtered
        ? `${count} ${tr(t('sur', 'of'))} ${total} ${total > 1 ? tr(t('œuvres', 'artworks')) : tr(t('œuvre', 'artwork'))}`
        : `${total} ${total > 1 ? tr(t('œuvres exposées', 'artworks on display')) : tr(t('œuvre exposée', 'artwork on display'))}`;

  return (
    <>
      <Screen
        title={tr(t('Galerie', 'Gallery'))}
        className="gg-screen"
        actions={
          <>
            <IconButton
              label={tr(t('Trier et filtrer', 'Sort and filter'))}
              onClick={() => {
                setPanel('filter');
              }}
            >
              <IconSliders size={22} />
              {customized && <span className="gg-dot" aria-hidden />}
            </IconButton>
            <IconButton
              label={tr(t('Changer de mur', 'Change wall'))}
              onClick={() => {
                setPanel('wall');
              }}
            >
              <IconWall size={22} />
            </IconButton>
          </>
        }
      >
        <div ref={root} className="gg-root">
          <div className="gg-head">
            <p className="gg-count" aria-live="polite">
              {counter || ' '}
              {counter && <span> · {tr(wall.name)}</span>}
            </p>
            {modes.length > 1 && (
              <div className="gg-chips" role="group" aria-label={tr(t('Filtrer par mode', 'Filter by mode'))}>
                <Chip
                  selected={filters.mode === null}
                  onClick={() => {
                    setFilters({ ...filters, mode: null });
                  }}
                >
                  {tr(t('Tous', 'All'))}
                </Chip>
                {modes.map((m) => (
                  <Chip
                    key={m}
                    selected={filters.mode === m}
                    onClick={() => {
                      setFilters({ ...filters, mode: filters.mode === m ? null : m });
                    }}
                  >
                    {modeName(m)}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          <div className="gg-wall" data-dark={wall.dark}>
            <AnimatePresence initial={false}>
              <motion.div
                key={wall.id}
                className="gg-wall__bg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0.99 }}
                transition={{ duration: 0.55 }}
              >
                <div className="gg-wall__tex" style={wallStyle(wall)} />
              </motion.div>
            </AnimatePresence>
            <div className="gg-light gg-light--vignette" aria-hidden />
            <div className="gg-light gg-light--halo" aria-hidden>
              <div ref={halo} className="gg-halo" />
            </div>

            <div className="gg-rail">
              {shown === undefined && (
                <div className="gg-grid" aria-busy="true">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <GhostItem key={i} index={i} />
                  ))}
                </div>
              )}
              {shown && total === 0 && <EmptyWall />}
              {shown && total > 0 && count === 0 && (
                <div className="gg-nomatch">
                  <div className="gg-cartel gg-cartel--big">
                    <strong>{tr(t('Aucune œuvre ne correspond', 'No artwork matches'))}</strong>
                    <span>
                      {tr(
                        t(
                          'Essaie d’autres filtres pour retrouver tes créations.',
                          'Try other filters to find your creations.',
                        ),
                      )}
                    </span>
                  </div>
                  <Button
                    variant="filled"
                    onClick={() => {
                      setFilters(NO_FILTER);
                    }}
                  >
                    {tr(t('Tout afficher', 'Show all'))}
                  </Button>
                </div>
              )}
              {shown && count > 0 && (
                <div className="gg-grid">
                  {shown.map((p, i) => (
                    <ArtFrame
                      key={p.id}
                      project={p}
                      index={i}
                      opened={openId === p.id}
                      onOpen={(id, from) => {
                        setOpened({ id, from });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Screen>

      {createPortal(
        <AnimatePresence>
          {detail && (
            <Detail
              key={detail.id}
              project={detail}
              from={opened?.from ?? null}
              unlockedFrames={unlockedFrames}
              notify={notify}
              onClose={() => {
                setOpened(null);
              }}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}

      <WallSheet
        open={panel === 'wall'}
        onClose={() => {
          setPanel(null);
        }}
        current={wall}
        unlocked={unlockedWalls}
        onChoose={chooseWall}
        notify={notify}
      />
      <FilterSheet
        open={panel === 'filter'}
        onClose={() => {
          setPanel(null);
        }}
        sort={sort}
        onSort={setSort}
        filters={filters}
        onFilters={setFilters}
        modes={modes}
        categories={categories}
        count={count}
      />
      {toast}
    </>
  );
}
