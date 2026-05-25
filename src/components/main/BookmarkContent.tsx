import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import { Sparkles, Grid, List, Globe, ArrowUp, ArrowDown } from 'lucide-react';
import { useBookmarkStore } from '../../store';
import BookmarkCard from '../BookmarkCard';
import BookmarkListItem from '../BookmarkListItem';
import { DomainGroupList } from '../DomainGroupList';
import { DomainGroupStats } from '../DomainGroupStats';
import { buildTagPathByIdMap, getFlatTagDisplayNames } from '../../utils/tagPath';
import { buildCategoryPathByIdMap } from '../../utils/categoryTreeBuilder';
import type { Bookmark } from '../../types';

interface BookmarkContentProps {
  filteredBookmarks: Bookmark[];
  onBookmarkContextMenu: (e: React.MouseEvent, bookmark: Bookmark) => void;
  onListAreaContextMenu: (e: React.MouseEvent) => void;
}

const SORT_OPTIONS: { value: 'createdAt' | 'updatedAt' | 'title' | 'category'; label: string }[] = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'updatedAt', label: '更新时间' },
  { value: 'title', label: '标题' },
  { value: 'category', label: '分类' },
];

const BookmarkContent: React.FC<BookmarkContentProps> = ({
  filteredBookmarks,
  onBookmarkContextMenu,
  onListAreaContextMenu,
}) => {
  const bookmarksCount = useBookmarkStore(s => s.bookmarks.length);
  const currentView = useBookmarkStore(s => s.currentView);
  const setCurrentView = useBookmarkStore(s => s.setCurrentView);
  const sortBy = useBookmarkStore(s => s.sortBy);
  const sortOrder = useBookmarkStore(s => s.sortOrder);
  const setSortBy = useBookmarkStore(s => s.setSortBy);
  const setSortOrder = useBookmarkStore(s => s.setSortOrder);

  const selectedBookmarks = useBookmarkStore(s => s.selectedBookmarks);
  const setSelectedBookmarks = useBookmarkStore(s => s.setSelectedBookmarks);
  const clearSelection = useBookmarkStore(s => s.clearSelection);
  const displayedCount = useBookmarkStore(s => s.displayedCount);
  const loadMore = useBookmarkStore(s => s.loadMore);
  const tags = useBookmarkStore(s => s.tags);
  const categories = useBookmarkStore(s => s.categories);

  const selectAllRef = useRef<HTMLInputElement>(null);

  const selectableIds = useMemo(
    () => filteredBookmarks.map(b => b.id),
    [filteredBookmarks]
  );
  const selectedSet = useMemo(() => new Set(selectedBookmarks), [selectedBookmarks]);
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every(id => selectedSet.has(id));
  const someSelected = selectedBookmarks.length > 0 && !allSelected;
  const displayedBookmarks = useMemo(
    () => filteredBookmarks.slice(0, displayedCount),
    [filteredBookmarks, displayedCount]
  );
  const hasMore = displayedCount < filteredBookmarks.length;

  const onBookmarkContextMenuRef = useRef(onBookmarkContextMenu);
  onBookmarkContextMenuRef.current = onBookmarkContextMenu;
  const bookmarksByIdRef = useRef<Map<string, Bookmark>>(new Map());
  bookmarksByIdRef.current = useMemo(
    () => new Map(displayedBookmarks.map(b => [b.id, b])),
    [displayedBookmarks]
  );

  const handleCardContextMenu = useCallback((e: React.MouseEvent, bookmarkId: string) => {
    const bookmark = bookmarksByIdRef.current.get(bookmarkId);
    if (bookmark) onBookmarkContextMenuRef.current(e, bookmark);
  }, []);

  const tagPathById = useMemo(() => buildTagPathByIdMap(tags), [tags]);
  const categoryPathById = useMemo(() => buildCategoryPathByIdMap(categories), [categories]);
  const bookmarkDerivedData = useMemo(() => {
    const map = new Map<string, { tagNames: string[]; categoryPath: string }>();
    for (const bookmark of displayedBookmarks) {
      const tagNames = getFlatTagDisplayNames(bookmark.tagIds, tagPathById);
      const categoryPath = bookmark.categoryId ? (categoryPathById.get(bookmark.categoryId) || '') : '';
      map.set(bookmark.id, { tagNames, categoryPath });
    }
    return map;
  }, [displayedBookmarks, tagPathById, categoryPathById]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const handleSelectAllToggle = useCallback(() => {
    if (allSelected) {
      clearSelection();
    } else {
      setSelectedBookmarks(selectableIds);
    }
  }, [allSelected, clearSelection, selectableIds, setSelectedBookmarks]);

  const handleInvertSelection = useCallback(() => {
    const selectedSet = new Set(selectedBookmarks);
    setSelectedBookmarks(selectableIds.filter(id => !selectedSet.has(id)));
  }, [selectableIds, selectedBookmarks, setSelectedBookmarks]);

  const handleSortOrderToggle = () => {
    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
  };

  const isActiveView = (view: 'grid' | 'list' | 'domain') => currentView === view;

  const isFilteredEmpty = bookmarksCount > 0;

  const ViewToggle = () => (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
      <button
        type="button"
        onClick={() => setCurrentView('grid')}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-sm rounded transition-colors ${
          currentView === 'grid'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
        title="网格视图"
      >
        <Grid className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">网格</span>
      </button>
      <button
        type="button"
        onClick={() => setCurrentView('list')}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-sm rounded transition-colors ${
          currentView === 'list'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
        title="列表视图"
      >
        <List className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">列表</span>
      </button>
      <button
        type="button"
        onClick={() => setCurrentView('domain')}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-sm rounded transition-colors ${
          isActiveView('domain')
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
        title="域名分组视图"
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">域名</span>
      </button>
    </div>
  );

  return (
    <>
      {currentView === 'domain' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 px-1 py-2 border-b border-gray-200 dark:border-gray-700">
            <ViewToggle />
          </div>
          <DomainGroupStats />
          <DomainGroupList
            onGroupSelect={(domain) => {
              console.log('Selected domain:', domain);
            }}
          />
        </div>
      ) : filteredBookmarks.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {isFilteredEmpty ? '没有匹配的书签' : '还没有收藏任何书签'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {isFilteredEmpty
              ? '尝试调整筛选条件或搜索关键词'
              : '开始收藏有趣的网页，AI会帮你智能分类和标记'
            }
          </p>
          {isFilteredEmpty ? (
            <span className="text-sm text-gray-500 dark:text-gray-400">调整左侧筛选条件以查看更多结果</span>
          ) : (
            <button
              onClick={() => chrome.action.openPopup()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              添加第一个书签
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Toolbar: view toggle + sort controls */}
      <div className="mb-3 flex flex-wrap items-center gap-3 px-1 py-2 border-b border-gray-200 dark:border-gray-700">
        <ViewToggle />

        {/* Sort controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSortOrderToggle}
            className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
            title={sortOrder === 'desc' ? '降序' : '升序'}
          >
            {sortOrder === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{sortOrder === 'desc' ? '降序' : '升序'}</span>
          </button>
        </div>
      </div>

      {/* Selection toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-3 px-1 py-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={handleSelectAllToggle}
            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {allSelected
              ? `取消全选 (${filteredBookmarks.length})`
              : `全选当前列表 (${filteredBookmarks.length})`}
          </span>
        </label>
        {selectedBookmarks.length > 0 && (
          <>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              已选 {selectedBookmarks.length} 项
            </span>
            <button
              type="button"
              onClick={handleInvertSelection}
              className="text-sm text-primary hover:underline"
            >
              反选
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              取消选择
            </button>
          </>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto hidden sm:inline">
          右键书签或列表空白处可批量操作
        </span>
      </div>

      <div
        className={currentView === 'grid' ? 'bookmark-grid' : 'space-y-3'}
        onContextMenu={onListAreaContextMenu}
      >
        {displayedBookmarks.map(bookmark => {
          const isBookmarkSelected = selectedSet.has(bookmark.id);
          const derived = bookmarkDerivedData.get(bookmark.id);
          return currentView === 'grid' ? (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              isSelected={isBookmarkSelected}
              tagNames={derived?.tagNames || []}
              categoryPath={derived?.categoryPath || ''}
              onContextMenu={handleCardContextMenu}
            />
          ) : (
            <BookmarkListItem
              key={bookmark.id}
              bookmark={bookmark}
              isSelected={isBookmarkSelected}
              tagNames={derived?.tagNames || []}
              categoryPath={derived?.categoryPath || ''}
              onContextMenu={handleCardContextMenu}
            />
          );
        })}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="text-center py-6">
          <span className="text-sm text-gray-400">加载中...</span>
        </div>
      )}
        </>
      )}
    </>
  );
};

export default React.memo(BookmarkContent);
