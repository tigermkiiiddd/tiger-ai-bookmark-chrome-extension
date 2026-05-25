import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MoreVertical, ExternalLink, Edit, Trash2, Bot, Camera, Archive, ArchiveRestore } from 'lucide-react';
import { Bookmark } from '../types';
import { useBookmarkStore } from '../store';
import { openBookmarkUrl } from '../utils/openBookmark';
import { StarRating } from './StarRating';
import {
  clearBookmarkArchivedPatch,
  isBookmarkArchived,
  markBookmarkArchivedPatch
} from '../utils/bookmarkArchive';
import BookmarkCardShell from './BookmarkCardShell';

interface BookmarkCardProps {
  bookmark: Bookmark;
  isSelected: boolean;
  tagNames: string[];
  categoryPath: string;
  onContextMenu?: (e: React.MouseEvent, bookmarkId: string) => void;
}

const BookmarkCardBase: React.FC<BookmarkCardProps> = ({ bookmark, isSelected, tagNames, categoryPath, onContextMenu }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const updateBookmark = useBookmarkStore(s => s.updateBookmark);
  const deleteBookmark = useBookmarkStore(s => s.deleteBookmark);
  const toggleBookmarkSelection = useBookmarkStore(s => s.toggleBookmarkSelection);
  const handleRatingChange = useCallback((rating: number) => {
    updateBookmark(bookmark.id, { rating });
  }, [bookmark.id, updateBookmark]);
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    onContextMenu?.(e, bookmark.id);
  }, [bookmark.id, onContextMenu]);
  const aiArchiveBookmark = useBookmarkStore(s => s.aiArchiveBookmark);
  const openEditModal = useBookmarkStore(s => s.openEditModal);
  const refreshBookmarkThumbnail = useBookmarkStore(s => s.refreshBookmarkThumbnail);

  const handleAction = useCallback(async (action: string) => {
    setShowMenu(false);
    if (action === 'edit') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => openEditModal(bookmark), 200);
      return;
    }
    setIsLoading(true);
    try {
      switch (action) {
        case 'archive':
          await updateBookmark(bookmark.id, isBookmarkArchived(bookmark) ? clearBookmarkArchivedPatch() : markBookmarkArchivedPatch());
          break;
        case 'ai-archive':
          await aiArchiveBookmark(bookmark.id);
          break;
        case 'delete':
          await deleteBookmark(bookmark.id);
          break;
        case 'open':
          await openBookmarkUrl(bookmark);
          break;
        case 'refresh-screenshot':
          await refreshBookmarkThumbnail(bookmark.id);
          break;
      }
    } catch (error) {
      console.error('操作失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [bookmark, updateBookmark, deleteBookmark, aiArchiveBookmark, openEditModal, refreshBookmarkThumbnail]);

  const getStatusColor = () => {
    if (bookmark.status === 'dead') return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
    if (isBookmarkArchived(bookmark)) return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
    if (bookmark.status === 'active') return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
    return '';
  };

  return (
    <BookmarkCardShell
      bookmark={bookmark}
      tagNames={tagNames}
      categoryPath={categoryPath}
      className={`bookmark-card ${showMenu ? 'relative z-50' : ''} ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      borderClassName={isSelected
        ? 'border-primary shadow-lg ring-2 ring-primary/20'
        : `border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 ${getStatusColor()}`
      }
      data-bookmark-item
      onContextMenu={handleContextMenu}
      onClick={() => handleAction('open')}
      showFooter
      showTagExpand
      maxTags={4}
      topLeft={
        <div className="absolute top-3 left-3 z-10 pointer-events-auto">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); toggleBookmarkSelection(bookmark.id); }}
            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
          />
        </div>
      }
      topRight={
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); handleAction('delete'); }}
            className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-[1000]">
                <button onClick={(e) => { e.stopPropagation(); handleAction('open'); }} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <ExternalLink className="w-4 h-4" />在新标签页打开
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleAction('edit'); }} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Edit className="w-4 h-4" />编辑书签
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleAction('ai-archive'); }} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  <Bot className="w-4 h-4" />AI智能归档
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleAction('refresh-screenshot'); }} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Camera className="w-4 h-4" />更新截图
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleAction('archive'); }} className={`flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${isBookmarkArchived(bookmark) ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {isBookmarkArchived(bookmark) ? <><ArchiveRestore className="w-4 h-4" />取消归档</> : <><Archive className="w-4 h-4" />手动归档</>}
                </button>
                <hr className="border-gray-200 dark:border-gray-700" />
                <button onClick={(e) => { e.stopPropagation(); handleAction('delete'); }} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4" />删除书签
                </button>
              </div>
            )}
          </div>
        </div>
      }
      imageOverlay={
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-end justify-center bg-gradient-to-t from-black/70 via-black/30 to-transparent dark:from-black/80 dark:via-black/40 dark:to-transparent pt-8 pb-4 px-4" onClick={(e) => e.stopPropagation()}>
          <StarRating value={bookmark.rating || 0} onChange={handleRatingChange} size={18} />
        </div>
      }
    />
  );
};

const BookmarkCard = React.memo(BookmarkCardBase, (prev, next) =>
  prev.bookmark === next.bookmark &&
  prev.isSelected === next.isSelected &&
  prev.tagNames === next.tagNames &&
  prev.categoryPath === next.categoryPath &&
  prev.onContextMenu === next.onContextMenu
);

export default BookmarkCard;
