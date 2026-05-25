import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useBookmarkStore } from '../../store';
import { getCategoryPath } from '../../utils/categoryTreeBuilder';
import { formatTagPath } from '../../utils/tagPath';
import { STATUS_FILTER_LABELS } from '../../utils/statusFilter';
import type { StatusFilterValue } from '../../types';

const ScopeBar: React.FC = () => {
  const searchQuery = useBookmarkStore(s => s.searchQuery);
  const activeFilters = useBookmarkStore(s => s.activeFilters);
  const categories = useBookmarkStore(s => s.categories);
  const tags = useBookmarkStore(s => s.tags);
  const setSearchQuery = useBookmarkStore(s => s.setSearchQuery);
  const setActiveFilters = useBookmarkStore(s => s.setActiveFilters);
  const clearFilters = useBookmarkStore(s => s.clearFilters);

  const [draftQuery, setDraftQuery] = useState(searchQuery);

  useEffect(() => {
    setDraftQuery(searchQuery);
  }, [searchQuery]);

  const tagIdSet = useMemo(() => new Set(tags.map(t => t.id)), [tags]);
  const tagNameToIdMap = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);

  const getTagLabel = useCallback(
    (value: string) => {
      const tagId = tagIdSet.has(value) ? value : undefined;
      const tag = tagId ? tagNameToIdMap.get(tagId) : undefined;
      return tag ? formatTagPath(tag.id, tags) : value;
    },
    [tagIdSet, tagNameToIdMap, tags]
  );

  const getCategoryLabel = useCallback(
    (id: string) => {
      const cat = categories.find(c => c.id === id);
      return cat ? getCategoryPath(id, categories) : id;
    },
    [categories]
  );

  const removeFilter = useCallback(
    (key: 'tags' | 'categories' | 'status', value: string) => {
      setActiveFilters({
        ...activeFilters,
        [key]: (activeFilters[key] || []).filter((v: string) => v !== value),
      });
    },
    [activeFilters, setActiveFilters]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setSearchQuery(draftQuery);
      }
    },
    [draftQuery, setSearchQuery]
  );

  const handleClearInput = useCallback(() => {
    setDraftQuery('');
    setSearchQuery('');
  }, [setSearchQuery]);

  const hasFilters =
    searchQuery ||
    (activeFilters.tags || []).length > 0 ||
    (activeFilters.categories || []).length > 0 ||
    (activeFilters.status || []).length > 0;

  return (
    <div className="p-3 space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索书签..."
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 focus:ring-2 focus:ring-primary focus:border-primary"
        />
        {draftQuery && (
          <button
            onClick={handleClearInput}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        )}
      </div>

      {hasFilters && (
        <div className="flex flex-wrap gap-1.5">
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              &quot;{searchQuery}&quot;
              <button onClick={handleClearInput} className="p-0.5 rounded-full hover:bg-primary/20">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {(activeFilters.categories || []).map(id => (
            <span key={`cat-${id}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-full">
              {getCategoryLabel(id)}
              <button onClick={() => removeFilter('categories', id)} className="p-0.5 rounded-full hover:bg-green-200 dark:hover:bg-green-800">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {(activeFilters.tags || []).map(v => (
            <span key={`tag-${v}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full">
              {getTagLabel(v)}
              <button onClick={() => removeFilter('tags', v)} className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {(activeFilters.status || []).map(s => (
            <span key={`st-${s}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-full">
              {STATUS_FILTER_LABELS[s as StatusFilterValue] || s}
              <button onClick={() => removeFilter('status', s)} className="p-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={clearFilters}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary px-1"
          >
            清除
          </button>
        </div>
      )}
    </div>
  );
};

export default ScopeBar;
