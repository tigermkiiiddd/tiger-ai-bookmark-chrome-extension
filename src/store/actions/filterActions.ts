import type { FilterOptions } from '../../types/index';
import { computeFilteredBookmarks, type FilterStateSlice } from '../selectors/filteredBookmarksSelector';

const FILTER_INPUT_KEYS = new Set([
  'bookmarks',
  'searchQuery',
  'activeFilters',
  'sortBy',
  'sortOrder',
  'tags',
  'categories',
]);

function valueChanged(a: unknown, b: unknown): boolean {
  if (a === b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return true;
    return a.some((v, i) => v !== b[i]);
  }
  return true;
}

/* ---- batch 机制：首次加载时合并多次 set() 为一次重算 ---- */
let _batchLevel = 0;
let _storeSet: ((partial: any) => void) | null = null;
let _storeGet: (() => any) | null = null;

export function initBatchStore(set: (partial: any) => void, get: () => any) {
  _storeSet = set;
  _storeGet = get;
}

export function beginBatch() {
  _batchLevel++;
}

export function endBatch() {
  _batchLevel = Math.max(0, _batchLevel - 1);
  if (_batchLevel === 0 && _storeSet && _storeGet) {
    const state = _storeGet();
    _storeSet({ filteredBookmarks: computeFilteredBookmarks(state) });
  }
}

export function mergeWithFilteredBookmarks(
  state: Record<string, unknown>,
  partial: Record<string, unknown>
): Record<string, unknown> {
  if (_batchLevel > 0) return partial;

  const needsRecompute = Object.keys(partial).some(
    key => FILTER_INPUT_KEYS.has(key) && valueChanged(state[key], partial[key])
  );
  if (!needsRecompute) return partial;

  const next = { ...state, ...partial } as FilterStateSlice & Record<string, unknown>;
  return {
    ...partial,
    filteredBookmarks: computeFilteredBookmarks(next),
  };
}

export function createFilterActions(
  set: (partial: any) => void,
  get: () => any,
) {
  initBatchStore(set, get);

  const setWithFilter = (partial: Record<string, unknown>) => {
    set(mergeWithFilteredBookmarks(get(), partial));
  };

  return {
    setSearchQuery: (query: string) => {
      setWithFilter({ searchQuery: query, displayedCount: 20 });
    },

    setActiveFilters: (filters: FilterOptions) => {
      setWithFilter({ activeFilters: filters, displayedCount: 20 });
    },

    clearFilters: () => {
      setWithFilter({
        searchQuery: '',
        activeFilters: { tags: [], categories: [], status: [] },
        displayedCount: 20,
      });
    },

    getFilteredBookmarks: () => {
      return get().filteredBookmarks;
    },

    recomputeFilteredBookmarks: () => {
      const state = get();
      set({ filteredBookmarks: computeFilteredBookmarks(state) });
    },

    setSelectedBookmarks: (ids: string[]) => {
      set({ selectedBookmarks: ids });
    },

    toggleBookmarkSelection: (id: string) => {
      const state = get();
      const isSelected = state.selectedBookmarks.includes(id);
      const nextSet = isSelected
        ? new Set(state.selectedBookmarks.filter((selectedId: string) => selectedId !== id))
        : new Set([...state.selectedBookmarks, id]);
      const visible = state.filteredBookmarks;
      const ordered = visible.filter((b: any) => nextSet.has(b.id)).map((b: any) => b.id);
      set({ selectedBookmarks: ordered });
    },

    clearSelection: () => {
      set({ selectedBookmarks: [] });
    },

    setCurrentView: (view: 'grid' | 'list' | 'domain') => {
      set({ currentView: view });
    },

    setSortBy: (sortBy: 'createdAt' | 'category' | 'title' | 'updatedAt') => {
      setWithFilter({ sortBy });
    },

    setSortOrder: (order: 'asc' | 'desc') => {
      setWithFilter({ sortOrder: order });
    },

    openEditModal: (bookmark: any) => {
      set({ editingBookmark: bookmark, isEditModalOpen: true });
    },

    closeEditModal: () => {
      set({ editingBookmark: null, isEditModalOpen: false });
    },
  };
}
