import type { CategoryId } from '@/content/categories';
import type { Difficulty } from '@/content/library/types';

export type StatusFilter = 'all' | 'todo' | 'doing' | 'done';

export interface Filters {
  query: string;
  category: CategoryId | null;
  difficulty: Difficulty | null;
  status: StatusFilter;
}

export const NO_FILTERS: Filters = { query: '', category: null, difficulty: null, status: 'all' };
