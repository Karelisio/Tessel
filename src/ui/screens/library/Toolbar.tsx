import { AnimatePresence, motion } from 'framer-motion';
import { CATEGORY_IDS, getCategory, type CategoryId } from '@/content/categories';
import { DIFFICULTIES } from '@/content/library/types';
import { locale, tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { duration, spring } from '@/theme/motion/tokens';
import { Chip } from '@/ui/kit';
import { IconClose, IconSearch } from '@/ui/kit/icons';
import { IconLock } from '@/ui/meta/icons';
import { filtersActive } from './data';
import { categoryLevel, DIFFICULTY_NAMES } from './labels';
import { IconFilter } from './icons';
import { useShake } from './shake';
import { NO_FILTERS, type Filters, type StatusFilter } from './types';

const STATUSES: readonly { id: StatusFilter; label: ReturnType<typeof t> }[] = [
  { id: 'all', label: t('Tout', 'All') },
  { id: 'todo', label: t('À faire', 'To do') },
  { id: 'doing', label: t('En cours', 'In progress') },
  { id: 'done', label: t('Terminées', 'Finished') },
];

function CategoryChip({
  id,
  selected,
  locked,
  onSelect,
  onLocked,
}: {
  id: CategoryId;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onLocked: () => void;
}) {
  const { controls, shake } = useShake();
  const name = getCategory(id).name[locale()];
  const level = categoryLevel(id);
  return (
    <motion.button
      className="lib-cat"
      data-locked={locked}
      aria-pressed={selected}
      aria-disabled={locked}
      aria-label={
        locked
          ? tr(
              t(
                `${name}, verrouillé${level ? `, niveau ${level}` : ''}`,
                `${name}, locked${level ? `, level ${level}` : ''}`,
              ),
            )
          : name
      }
      animate={controls}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', ...spring.snappy }}
      onClick={() => {
        if (locked) {
          shake();
          onLocked();
        } else {
          onSelect();
        }
      }}
    >
      {locked && <IconLock size={14} />}
      <span>{name}</span>
      {locked && level !== undefined && <small>{tr(t(`Niv. ${level}`, `Lv. ${level}`))}</small>}
    </motion.button>
  );
}

/** Recherche, catégories (les verrouillées à la fin) et filtres. Collant sous la barre du titre. */
export function Toolbar({
  filters,
  onChange,
  unlocked,
  filtersOpen,
  onToggleFilters,
  onLockedCategory,
  hint,
  stuck,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  unlocked: ReadonlySet<string>;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onLockedCategory: (id: CategoryId) => void;
  hint: string | null;
  stuck: boolean;
}) {
  const open = CATEGORY_IDS.filter((id) => unlocked.has(id));
  const locked = CATEGORY_IDS.filter((id) => !unlocked.has(id)).sort(
    (a, b) => (categoryLevel(a) ?? 999) - (categoryLevel(b) ?? 999),
  );
  const active = filtersActive(filters);
  return (
    <div className="lib-toolbar" data-stuck={stuck}>
      <div className="lib-toolbar__row">
        <label className="lib-search">
          <IconSearch size={20} />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            value={filters.query}
            placeholder={tr(t('Chercher une œuvre', 'Search artworks'))}
            aria-label={tr(t('Chercher une œuvre', 'Search artworks'))}
            onChange={(e) => {
              onChange({ query: e.target.value });
            }}
          />
          <AnimatePresence>
            {filters.query && (
              <motion.button
                type="button"
                className="lib-search__clear"
                aria-label={tr(t('Effacer la recherche', 'Clear search'))}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                whileTap={{ scale: 0.86 }}
                onClick={() => {
                  onChange({ query: '' });
                }}
              >
                <IconClose size={16} />
              </motion.button>
            )}
          </AnimatePresence>
        </label>
        <motion.button
          className="lib-filter-btn"
          aria-label={tr(t('Filtres', 'Filters'))}
          aria-expanded={filtersOpen}
          aria-pressed={filtersOpen || active}
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', ...spring.snappy }}
          onClick={onToggleFilters}
        >
          <IconFilter size={22} />
          {active && <span className="lib-filter-btn__dot" />}
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {filtersOpen && (
          <motion.div
            className="lib-filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duration.md / 1000 }}
          >
            <div className="lib-filters__inner">
              <div className="lib-filters__group">
                <span className="lib-filters__label">{tr(t('Difficulté', 'Difficulty'))}</span>
                <div className="lib-chips">
                  <Chip
                    selected={filters.difficulty === null}
                    onClick={() => {
                      onChange({ difficulty: null });
                    }}
                  >
                    {tr(t('Toutes', 'Any'))}
                  </Chip>
                  {DIFFICULTIES.map((d) => (
                    <Chip
                      key={d}
                      selected={filters.difficulty === d}
                      onClick={() => {
                        onChange({ difficulty: d });
                      }}
                    >
                      {DIFFICULTY_NAMES[d][locale()]}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="lib-filters__group">
                <span className="lib-filters__label">{tr(t('Avancement', 'Progress'))}</span>
                <div className="lib-chips">
                  {STATUSES.map((s) => (
                    <Chip
                      key={s.id}
                      selected={filters.status === s.id}
                      onClick={() => {
                        onChange({ status: s.id });
                      }}
                    >
                      {s.label[locale()]}
                    </Chip>
                  ))}
                </div>
              </div>
              {active && (
                <button
                  className="lib-filters__reset"
                  onClick={() => {
                    onChange({ difficulty: NO_FILTERS.difficulty, status: NO_FILTERS.status });
                  }}
                >
                  {tr(t('Réinitialiser les filtres', 'Reset filters'))}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lib-cats" role="group" aria-label={tr(t('Catégories', 'Categories'))}>
        <Chip
          selected={filters.category === null}
          onClick={() => {
            onChange({ category: null });
          }}
        >
          {tr(t('Toutes', 'All'))}
        </Chip>
        {open.map((id) => (
          <CategoryChip
            key={id}
            id={id}
            selected={filters.category === id}
            locked={false}
            onSelect={() => {
              onChange({ category: filters.category === id ? null : id });
            }}
            onLocked={() => {
              onLockedCategory(id);
            }}
          />
        ))}
        {locked.map((id) => (
          <CategoryChip
            key={id}
            id={id}
            selected={false}
            locked
            onSelect={() => undefined}
            onLocked={() => {
              onLockedCategory(id);
            }}
          />
        ))}
      </div>

      <AnimatePresence>
        {hint && (
          <motion.p
            key={hint}
            className="lib-hint"
            role="status"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: duration.sm / 1000 }}
          >
            <IconLock size={16} />
            <span>{hint}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
