export const uiInitialState = {
  pageSize: 20,
  displayedCount: 20,
  expandedCategories: [] as string[],
};

export function createUISlice(
  set: (partial: any) => void,
  get: () => any
) {
  return {
    loadMore: () => {
      const { displayedCount, pageSize } = get();
      set({ displayedCount: displayedCount + pageSize });
    },

    resetPagination: () => {
      set({ displayedCount: 20 });
    },

    toggleCategoryExpansion: (categoryId: string) => {
      const { expandedCategories } = get();
      set({
        expandedCategories: expandedCategories.includes(categoryId)
          ? expandedCategories.filter((id: string) => id !== categoryId)
          : [...expandedCategories, categoryId]
      });
    },

    setError: (error: string | null) => {
      set({ error });
    },

    clearError: () => {
      set({ error: null });
    },

    clearLastBatchResult: () => {
      set({ lastBatchResult: null });
    },
  };
}
