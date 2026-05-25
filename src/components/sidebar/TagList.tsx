import React, { useMemo, useCallback } from 'react';
import { Tag as TagIcon } from 'lucide-react';
import { useBookmarkStore } from '../../store';
import { formatTagPath } from '../../utils/tagPath';
import { getCategoryFilterScopeIds } from '../../utils/categoryTreeBuilder';
import { bookmarkMatchesStatusFilters } from '../../utils/statusFilter';
import type { Tag } from '../../types';
import TagTree from './TagTree';

function getTagAncestorIds(tagId: string, tags: Tag[]): string[] {
  const result: string[] = [];
  const tagMap = new Map(tags.map(t => [t.id, t]));
  let current = tagMap.get(tagId);
  while (current?.parentId) {
    result.push(current.parentId);
    current = tagMap.get(current.parentId);
  }
  return result;
}

const TagList: React.FC = () => {
  const tags = useBookmarkStore(s => s.tags);
  const bookmarks = useBookmarkStore(s => s.bookmarks);
  const categories = useBookmarkStore(s => s.categories);
  const activeFilters = useBookmarkStore(s => s.activeFilters);
  const setActiveFilters = useBookmarkStore(s => s.setActiveFilters);

  const facetedTagCounts = useMemo(() => {
    const statusFilter = activeFilters.status || [];
    const categoryFilterIds = activeFilters.categories || [];
    const categoryScope = categoryFilterIds.length > 0
      ? getCategoryFilterScopeIds(categoryFilterIds, categories)
      : null;

    const counts = new Map<string, number>();
    for (const b of bookmarks) {
      if (categoryScope && (!b.categoryId || !categoryScope.has(b.categoryId))) continue;
      if (statusFilter.length > 0 && !bookmarkMatchesStatusFilters(b, statusFilter)) continue;

      const visited = new Set<string>();
      for (const tagId of (b.tagIds || [])) {
        if (!visited.has(tagId)) {
          counts.set(tagId, (counts.get(tagId) || 0) + 1);
          visited.add(tagId);
        }
        for (const ancestorId of getTagAncestorIds(tagId, tags)) {
          if (!visited.has(ancestorId)) {
            counts.set(ancestorId, (counts.get(ancestorId) || 0) + 1);
            visited.add(ancestorId);
          }
        }
      }
    }
    return counts;
  }, [bookmarks, activeFilters.status, activeFilters.categories, categories, tags]);

  const popularTags = useMemo(() =>
    [...tags]
      .map(tag => ({ tag, count: facetedTagCounts.get(tag.id) || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    [tags, facetedTagCounts]
  );

  const toggleTagFilter = useCallback((tagId: string) => {
    const currentTags = activeFilters.tags || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter(t => t !== tagId)
      : [...currentTags, tagId];
    setActiveFilters({ ...activeFilters, tags: newTags });
  }, [activeFilters, setActiveFilters]);

  return (
    <div className="px-2 py-2 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <TagIcon className="w-3.5 h-3.5" />
          标签
        </h3>
        <span className="text-[10px] text-gray-500">{tags.length}</span>
      </div>

      {popularTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 flex-shrink-0">
          {popularTags.map(({ tag, count }) => {
            const isActive = (activeFilters.tags || []).includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTagFilter(tag.id)}
                title={`${formatTagPath(tag.id, tags)} (${count})`}
                className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        <TagTree
          tags={tags}
          tagCounts={facetedTagCounts}
          selectedTagIds={activeFilters.tags || []}
          onToggleTag={toggleTagFilter}
        />
      </div>
    </div>
  );
};

export default TagList;
