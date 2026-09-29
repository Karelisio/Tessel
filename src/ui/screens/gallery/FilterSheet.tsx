import type { CategoryDef } from '@/content/categories';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import type { ModeId } from '@/modes/types';
import { Button, Chip, Sheet } from '@/ui/kit';
import { modeName, NO_FILTER, SORT_KEYS, sortLabel, type Filters, type SortKey } from './model';

/** Tri et filtres de l'exposition. */
export function FilterSheet({
  open,
  onClose,
  sort,
  onSort,
  filters,
  onFilters,
  modes,
  categories,
  count,
}: {
  open: boolean;
  onClose: () => void;
  sort: SortKey;
  onSort: (k: SortKey) => void;
  filters: Filters;
  onFilters: (f: Filters) => void;
  modes: readonly ModeId[];
  categories: readonly CategoryDef[];
  count: number;
}) {
  const active = filters.mode !== null || filters.category !== null;
  return (
    <Sheet open={open} onClose={onClose} label={tr(t('Trier et filtrer', 'Sort and filter'))}>
      <h2 className="gg-sheet__title">{tr(t('Trier et filtrer', 'Sort and filter'))}</h2>

      <h3 className="gg-sheet__group">{tr(t('Ordre', 'Order'))}</h3>
      <div className="gg-chips gg-chips--wrap" role="group" aria-label={tr(t('Ordre', 'Order'))}>
        {SORT_KEYS.map((k) => (
          <Chip
            key={k}
            selected={sort === k}
            onClick={() => {
              onSort(k);
            }}
          >
            {sortLabel(k)}
          </Chip>
        ))}
      </div>

      {modes.length > 1 && (
        <>
          <h3 className="gg-sheet__group">{tr(t('Mode', 'Mode'))}</h3>
          <div className="gg-chips gg-chips--wrap" role="group" aria-label={tr(t('Mode', 'Mode'))}>
            <Chip
              selected={filters.mode === null}
              onClick={() => {
                onFilters({ ...filters, mode: null });
              }}
            >
              {tr(t('Tous', 'All'))}
            </Chip>
            {modes.map((m) => (
              <Chip
                key={m}
                selected={filters.mode === m}
                onClick={() => {
                  onFilters({ ...filters, mode: filters.mode === m ? null : m });
                }}
              >
                {modeName(m)}
              </Chip>
            ))}
          </div>
        </>
      )}

      {categories.length > 1 && (
        <>
          <h3 className="gg-sheet__group">{tr(t('Catégorie', 'Category'))}</h3>
          <div className="gg-chips gg-chips--wrap" role="group" aria-label={tr(t('Catégorie', 'Category'))}>
            <Chip
              selected={filters.category === null}
              onClick={() => {
                onFilters({ ...filters, category: null });
              }}
            >
              {tr(t('Toutes', 'All'))}
            </Chip>
            {categories.map((c) => (
              <Chip
                key={c.id}
                selected={filters.category === c.id}
                onClick={() => {
                  onFilters({ ...filters, category: filters.category === c.id ? null : c.id });
                }}
              >
                {tr(c.name)}
              </Chip>
            ))}
          </div>
        </>
      )}

      <div className="gg-sheet__foot">
        {active && (
          <Button
            variant="text"
            onClick={() => {
              onFilters(NO_FILTER);
            }}
          >
            {tr(t('Tout afficher', 'Show all'))}
          </Button>
        )}
        <Button variant="filled" onClick={onClose}>
          {count} {count > 1 ? tr(t('œuvres', 'artworks')) : tr(t('œuvre', 'artwork'))}
        </Button>
      </div>
    </Sheet>
  );
}
