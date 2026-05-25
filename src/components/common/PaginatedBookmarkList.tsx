import React, { useMemo, useRef, useEffect } from 'react';
import { useBookmarkStore } from '../../store';
import BookmarkCard from '../BookmarkCard';
import BookmarkListItem from '../BookmarkListItem';
import { buildTagPathByIdMap, getFlatTagDisplayNames } from '../../utils/tagPath';
import { buildCategoryPathByIdMap } from '../../utils/categoryTreeBuilder';
import type { Bookmark } from '../../types';

interface PaginatedBookmarkListProps {
  bookmarks: Bookmark[];
  gridClassName?: string;
  listClassName?: string;
}

/**
 * 分页渲染书签卡片/列表项，复用 store 的 displayedCount 与无限滚动。
 */
const PaginatedBookmarkList: React.FC<PaginatedBookmarkListProps> = ({
  bookmarks,
  gridClassName = 'bookmark-grid',
  listClassName = 'space-y-3',
}) => {
  const currentView = useBookmarkStore(s => s.currentView);
  const displayedCount = useBookmarkStore(s => s.displayedCount);
  const loadMore = useBookmarkStore(s => s.loadMore);
  const tags = useBookmarkStore(s => s.tags);
  const categories = useBookmarkStore(s => s.categories);

  const displayedBookmarks = bookmarks.slice(0, displayedCount);
  const hasMore = displayedCount < bookmarks.length;

  const tagPathById = useMemo(() => buildTagPathByIdMap(tags), [tags]);
  const categoryPathById = useMemo(() => buildCategoryPathByIdMap(categories), [categories]);
  const bookmarkDerivedData = useMemo(() => {
    const map = new Map<string, { tagNames: string[]; categoryPath: string }>();
    for (const bookmark of displayedBookmarks) {
      const tagNames = getFlatTagDisplayNames(bookmark.tagIds, tagPathById);
      const categoryPath = bookmark.categoryId
        ? categoryPathById.get(bookmark.categoryId) || ''
        : '';
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

  return (
    <>
      <div className={currentView === 'grid' ? gridClassName : listClassName}>
        {displayedBookmarks.map(bookmark => {
          const derived = bookmarkDerivedData.get(bookmark.id);
          return currentView === 'grid' ? (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              isSelected={false}
              tagNames={derived?.tagNames || []}
              categoryPath={derived?.categoryPath || ''}
            />
          ) : (
            <BookmarkListItem
              key={bookmark.id}
              bookmark={bookmark}
              isSelected={false}
              tagNames={derived?.tagNames || []}
              categoryPath={derived?.categoryPath || ''}
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
  );
};

export default PaginatedBookmarkList;
