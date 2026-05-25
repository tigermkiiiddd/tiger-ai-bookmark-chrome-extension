import { buildCategoryPathByIdMap, getCategoryPath, getCategoryFilterScopeIds } from '../../utils/categoryTreeBuilder';
import { bookmarkMatchesStatusFilters } from '../../utils/statusFilter';
import { buildTagPathByIdMap } from '../../utils/tagPath';
import type { Bookmark, FilterOptions, Category, Tag } from '../../types';

export interface FilterInputs {
  bookmarks: Bookmark[];
  searchQuery: string;
  activeFilters: FilterOptions;
  sortBy: 'createdAt' | 'updatedAt' | 'title' | 'category';
  sortOrder: 'asc' | 'desc';
  tags: Tag[];
  categories: Category[];
  categoryPathById?: Map<string, string>;
  tagPathById?: Map<string, string>;
}

export interface FilterStateSlice {
  bookmarks: Bookmark[];
  searchQuery: string;
  activeFilters: FilterOptions;
  sortBy: FilterInputs['sortBy'];
  sortOrder: FilterInputs['sortOrder'];
  tags: Tag[];
  categories: Category[];
}

/** 获取某标签的所有后代标签 */
function getTagDescendants(tagId: string, tags: Tag[]): Tag[] {
  const children = tags.filter(t => t.parentId === tagId);
  const result: Tag[] = [];
  for (const child of children) {
    result.push(child, ...getTagDescendants(child.id, tags));
  }
  return result;
}

/** 多个筛选标签的并集 scope（每个选中项均含其子孙） */
function getTagFilterScopeIds(filterTagIds: string[], tags: Tag[]): Set<string> {
  const scope = new Set<string>();
  for (const id of filterTagIds) {
    scope.add(id);
    for (const descendant of getTagDescendants(id, tags)) {
      scope.add(descendant.id);
    }
  }
  return scope;
}

/** 将可能是 name 的旧 tag filter 值转换为 id */
function resolveTagFilterIds(rawValues: string[], tags: Tag[]): string[] {
  const tagIdSet = new Set(tags.map(t => t.id));
  const nameToIdMap = new Map(tags.map(t => [t.name, t.id]));
  return rawValues
    .map((v: string) => {
      if (tagIdSet.has(v)) return v;
      return nameToIdMap.get(v);
    })
    .filter(Boolean) as string[];
}

export function computeFilteredBookmarks(state: FilterStateSlice): Bookmark[] {
  const categoryPathById = buildCategoryPathByIdMap(state.categories);
  const tagPathById = buildTagPathByIdMap(state.tags);
  return selectFilteredBookmarks({
    ...state,
    categoryPathById,
    tagPathById,
  });
}

export function selectFilteredBookmarks(inputs: FilterInputs): Bookmark[] {
  let filteredBookmarks = inputs.bookmarks;
  const tagPathById = inputs.tagPathById ?? buildTagPathByIdMap(inputs.tags);

  if (inputs.searchQuery) {
    const query = inputs.searchQuery.toLowerCase();
    filteredBookmarks = filteredBookmarks.filter((bookmark: any) => {
      const tagNames = bookmark.tagIds?.map((id: string) => tagPathById.get(id) || id) || [];
      return (
        bookmark.title.toLowerCase().includes(query) ||
        bookmark.url.toLowerCase().includes(query) ||
        bookmark.description?.toLowerCase().includes(query) ||
        tagNames.some((tag: string) => tag.toLowerCase().includes(query)) ||
        bookmark.aiGenerated?.summary?.toLowerCase().includes(query)
      );
    });
  }

  if ((inputs.activeFilters.tags || []).length > 0) {
    const tagIds = resolveTagFilterIds(inputs.activeFilters.tags || [], inputs.tags);
    const tagScope = getTagFilterScopeIds(tagIds, inputs.tags);
    filteredBookmarks = filteredBookmarks.filter((bookmark: any) =>
      bookmark.tagIds?.some((tagId: string) => tagScope.has(tagId))
    );
  }

  if ((inputs.activeFilters.categories || []).length > 0) {
    const categoryScope = getCategoryFilterScopeIds(
      inputs.activeFilters.categories || [],
      inputs.categories
    );
    filteredBookmarks = filteredBookmarks.filter(
      (bookmark: any) => bookmark.categoryId && categoryScope.has(bookmark.categoryId)
    );
  }

  if ((inputs.activeFilters.status || []).length > 0) {
    filteredBookmarks = filteredBookmarks.filter((bookmark: any) =>
      bookmarkMatchesStatusFilters(
        bookmark,
        inputs.activeFilters.status || []
      )
    );
  }

  const sortedBookmarks = [...filteredBookmarks].sort((a: any, b: any) => {
    let result = 0;
    switch (inputs.sortBy) {
      case 'createdAt': result = a.createdAt - b.createdAt; break;
      case 'updatedAt': result = a.updatedAt - b.updatedAt; break;
      case 'title': result = a.title.localeCompare(b.title, 'zh-CN'); break;
      case 'category': {
        const pathA = inputs.categoryPathById?.get(a.categoryId || '') ?? getCategoryPath(a.categoryId, inputs.categories);
        const pathB = inputs.categoryPathById?.get(b.categoryId || '') ?? getCategoryPath(b.categoryId, inputs.categories);
        result = pathA.localeCompare(pathB, 'zh-CN');
        break;
      }
    }
    return inputs.sortOrder === 'desc' ? -result : result;
  });

  return sortedBookmarks;
}
