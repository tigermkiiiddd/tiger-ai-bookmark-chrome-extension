import type { Bookmark, Category, CategoryArchiveContext } from '../types/index.js';
import { buildBookmarkCountMap } from './categoryTreeBuilder.js';

export function buildCategoryArchiveContext(state: {
  categories: Category[];
  bookmarks: Bookmark[];
}): CategoryArchiveContext {
  return {
    categories: state.categories,
    bookmarkCountByCategoryId: buildBookmarkCountMap(state.bookmarks),
  };
}
