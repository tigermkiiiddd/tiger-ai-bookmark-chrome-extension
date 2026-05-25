import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MoreVertical, ExternalLink, Trash2, Edit, Tag, Calendar, Globe, Bot, Camera, Archive, ArchiveRestore } from 'lucide-react';
import { Bookmark, DomainGroup } from '../types/index';
import { useBookmarkStore } from '../store/index';
import { formatDate, getTagColor, extractDomain } from '../utils/index';
import { DomainGroupService } from '../services/domainGroupService';
import { openBookmarkUrl } from '../utils/openBookmark';
import { isBookmarkArchived, markBookmarkArchivedPatch, clearBookmarkArchivedPatch } from '../utils/bookmarkArchive';
import { StarRating } from './StarRating';


interface BookmarkListItemProps {
  bookmark: Bookmark;
  isSelected: boolean;
  tagNames: string[];
  categoryPath: string;
  onContextMenu?: (e: React.MouseEvent, bookmarkId: string) => void;
}

const BookmarkListItemBase: React.FC<BookmarkListItemProps> = ({ bookmark, isSelected, tagNames, categoryPath, onContextMenu }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiArchiving, setIsAiArchiving] = useState(false);
  const [domainGroup, setDomainGroup] = useState<DomainGroup | null>(null);
  const [domainGroupService] = useState(() => new DomainGroupService());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const deleteBookmark = useBookmarkStore(s => s.deleteBookmark);
  const updateBookmark = useBookmarkStore(s => s.updateBookmark);
  const toggleBookmarkSelection = useBookmarkStore(s => s.toggleBookmarkSelection);
  const handleRatingChange = useCallback((rating: number) => {
    updateBookmark(bookmark.id, { rating });
  }, [bookmark.id, updateBookmark]);
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    onContextMenu?.(e, bookmark.id);
  }, [bookmark.id, onContextMenu]);
  const openEditModal = useBookmarkStore(s => s.openEditModal);
  const aiArchiveBookmark = useBookmarkStore(s => s.aiArchiveBookmark);
  const refreshBookmarkThumbnail = useBookmarkStore(s => s.refreshBookmarkThumbnail);

  const domain = extractDomain(bookmark.url);
  const faviconUrl = bookmark.imagePreviewUrl || `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
  const descriptionText = bookmark.description?.trim();
  const aiSummaryText = bookmark.aiGenerated?.summary?.trim();
  const displayDescription = descriptionText || aiSummaryText;

  useEffect(() => {
    if (!showMenu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMenu(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKeyDown); };
  }, [showMenu]);

  // 获取域名分组信息
  useEffect(() => {
    const loadDomainGroup = async () => {
      try {
        const group = await domainGroupService.getDomainGroupForBookmark(bookmark.url);
        setDomainGroup(group);
      } catch (error) {
        console.error('Failed to load domain group:', error);
      }
    };
    loadDomainGroup();
  }, [bookmark.url, domainGroupService]);

  const handleAction = useCallback(async (action: string) => {
    setShowMenu(false);
    
    // 为编辑操作添加防抖机制
    if (action === 'edit') {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        openEditModal(bookmark);
      }, 200);
      return;
    }
    
    try {
      switch (action) {
        case 'aiArchive':
          setIsAiArchiving(true);
          await aiArchiveBookmark(bookmark.id);
          break;
        case 'delete':
          setIsLoading(true);
          await deleteBookmark(bookmark.id);
          break;
        case 'open':
          await openBookmarkUrl(bookmark);
          break;
        case 'archive':
          await updateBookmark(
            bookmark.id,
            isBookmarkArchived(bookmark)
              ? clearBookmarkArchivedPatch()
              : markBookmarkArchivedPatch()
          );
          break;
        case 'refresh-screenshot':
          setIsLoading(true);
          await refreshBookmarkThumbnail(bookmark.id);
          break;
      }
    } catch (error) {
      console.error('操作失败:', error);
    } finally {
      setIsLoading(false);
      setIsAiArchiving(false);
    }
  }, [bookmark, openEditModal, deleteBookmark, updateBookmark, aiArchiveBookmark, refreshBookmarkThumbnail]);

  const getStatusBadges = () => {
    const badges: React.ReactNode[] = [];
    if (isBookmarkArchived(bookmark)) {
      badges.push(
        <span
          key="archived"
          className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 rounded-full"
        >
          已归档
        </span>
      );
    }
    if (bookmark.status === 'dead') {
      badges.push(
        <span
          key="dead"
          className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 rounded-full"
        >
          失效
        </span>
      );
    }
    return badges.length ? <>{badges}</> : null;
  };

  return (
    <div
      data-bookmark-item
      onContextMenu={handleContextMenu}
      className={`group flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border transition-all duration-200 ${
        isSelected 
          ? 'border-primary shadow-md ring-2 ring-primary/20' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* Selection Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => toggleBookmarkSelection(bookmark.id)}
        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary flex-shrink-0"
      />

      {/* Favicon */}
      <div className="flex-shrink-0">
        <img
          src={faviconUrl}
          alt={domain}
          loading="lazy"
          decoding="async"
          className="w-6 h-6 rounded"
          onError={(e) => {
            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23ccc"/></svg>';
          }}
        />
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => handleAction('open')}
      >
        {/* Title and URL */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">
              {bookmark.title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {bookmark.url}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <StarRating value={bookmark.rating || 0} onChange={handleRatingChange} size={12} />

            {/* Domain Group Tag */}
            {domainGroup && domainGroup.bookmarkCount > 1 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200/50 dark:border-blue-700/50 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-md shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group/domain" title={`${domainGroup.domain} - ${domainGroup.bookmarkCount} 个书签`}>
                {domainGroup.favicon ? (
                  <img
                    src={domainGroup.favicon}
                    alt={domainGroup.domain}
                    loading="lazy"
                    decoding="async"
                    className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const globeIcon = e.currentTarget.nextElementSibling as HTMLElement;
                      if (globeIcon) globeIcon.style.display = 'block';
                    }}
                  />
                ) : null}
                <Globe className={`w-3.5 h-3.5 flex-shrink-0 ${domainGroup.favicon ? 'hidden' : 'block'}`} />
                <span className="truncate max-w-20 group-hover/domain:max-w-none transition-all duration-200">{domainGroup.displayName}</span>
                <span className="bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded-full text-xs font-semibold min-w-[1.25rem] text-center flex-shrink-0">
                  {domainGroup.bookmarkCount}
                </span>
              </div>
            )}


            {/* Status Badge */}
            {getStatusBadges()}

            {/* Date */}
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(bookmark.createdAt)}
            </span>
          </div>
        </div>

        {/* Description */}
        {displayDescription && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
            {displayDescription}
          </p>
        )}

        {/* Tags and Category */}
        <div className="flex items-center gap-4 mt-2">
          {/* Category */}
          {bookmark.categoryId && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200/50 dark:border-purple-700/50 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-md shadow-sm">
              <Tag className="w-3.5 h-3.5" />
              <span className="font-semibold">
                {categoryPath}
              </span>
            </div>
          )}

          {/* Tags */}
          {tagNames.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tagNames.slice(0, 4).map(tag => (
                <span
                  key={tag}
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${getTagColor(tag)}`}
                >
                  {tag}
                </span>
              ))}
              {tagNames.length > 4 && (
                <span className="px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                  +{tagNames.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); handleAction('delete'); }}
        className="p-2 rounded-md text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
        title="删除"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Actions Menu */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-[1000]">
            <button
              onClick={() => handleAction('open')}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ExternalLink className="w-4 h-4" />
              在新标签页打开
            </button>
            
            <button
              onClick={() => handleAction('edit')}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Edit className="w-4 h-4" />
              编辑书签
            </button>
            
            <button
              onClick={() => handleAction('aiArchive')}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              disabled={isAiArchiving}
            >
              <Bot className="w-4 h-4" />
              {isAiArchiving ? 'AI归档中...' : 'AI智能归档'}
            </button>

            <button
              onClick={() => handleAction('refresh-screenshot')}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              disabled={isLoading}
            >
              <Camera className="w-4 h-4" />
              {isLoading ? '截图中...' : '更新截图'}
            </button>

            <button
              onClick={() => handleAction('archive')}
              className={`flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                isBookmarkArchived(bookmark)
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {isBookmarkArchived(bookmark)
                ? <><ArchiveRestore className="w-4 h-4" />取消归档</>
                : <><Archive className="w-4 h-4" />手动归档</>
              }
            </button>

            <hr className="border-gray-200 dark:border-gray-700" />
            
            <button
              onClick={() => handleAction('delete')}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4" />
              删除书签
            </button>
          </div>
        )}
      </div>
      

    </div>
  );
};

const BookmarkListItem = React.memo(BookmarkListItemBase, (prev, next) =>
  prev.bookmark === next.bookmark &&
  prev.isSelected === next.isSelected &&
  prev.tagNames === next.tagNames &&
  prev.categoryPath === next.categoryPath &&
  prev.onContextMenu === next.onContextMenu
);

export default BookmarkListItem;
