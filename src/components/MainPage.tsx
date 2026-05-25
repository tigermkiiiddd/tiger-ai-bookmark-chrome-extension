import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageState } from '../hooks/usePageState';
import { useBookmarkStore } from '../store';
import { Bookmark } from '../types';
import { openBookmarkUrl } from '../utils/openBookmark';
import { buildAiArchiveQueue } from '../utils/aiArchive';
import {
  clearBookmarkArchivedPatch,
  isBookmarkArchived,
  markBookmarkArchivedPatch
} from '../utils/bookmarkArchive';
import BookmarkEditModal from './BookmarkEditModal';
import BookmarkContextMenu from './BookmarkContextMenu';
import MainPageHeader from './main/MainPageHeader';
import BookmarkContent from './main/BookmarkContent';
import BatchScreenshotModal from './main/BatchScreenshotModal';

const MainPage: React.FC = () => {
  usePageState();
  const navigate = useNavigate();
  const [showBatchScreenshotModal, setShowBatchScreenshotModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetBookmark?: Bookmark;
  } | null>(null);

  const currentView = useBookmarkStore(s => s.currentView);
  const filteredBookmarks = useBookmarkStore(s => s.filteredBookmarks);
  const selectedBookmarks = useBookmarkStore(s => s.selectedBookmarks);
  const setSelectedBookmarks = useBookmarkStore(s => s.setSelectedBookmarks);
  const isLoading = useBookmarkStore(s => s.isLoading);
  const editingBookmark = useBookmarkStore(s => s.editingBookmark);
  const isEditModalOpen = useBookmarkStore(s => s.isEditModalOpen);
  const closeEditModal = useBookmarkStore(s => s.closeEditModal);
  const openEditModal = useBookmarkStore(s => s.openEditModal);
  const updateBookmark = useBookmarkStore(s => s.updateBookmark);
  const batchDeleteBookmarks = useBookmarkStore(s => s.batchDeleteBookmarks);
  const clearSelection = useBookmarkStore(s => s.clearSelection);

  const handleBookmarkContextMenu = useCallback(
    (e: React.MouseEvent, bookmark: Bookmark) => {
      e.preventDefault();
      e.stopPropagation();
      const { selectedBookmarks: currentSelection } = useBookmarkStore.getState();
      if (!currentSelection.includes(bookmark.id)) {
        setSelectedBookmarks([bookmark.id]);
      }
      setContextMenu({ x: e.clientX, y: e.clientY, targetBookmark: bookmark });
    },
    [setSelectedBookmarks]
  );

  const handleListAreaContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-bookmark-item]')) return;
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const contextTargetBookmark = useMemo(() => {
    if (contextMenu?.targetBookmark) return contextMenu.targetBookmark;
    if (selectedBookmarks.length === 1) {
      return useBookmarkStore.getState().bookmarks.find(b => b.id === selectedBookmarks[0]);
    }
    return undefined;
  }, [contextMenu, selectedBookmarks]);

  const handleBatchDelete = async () => {
    if (selectedBookmarks.length === 0) return;
    const confirmed = confirm(`确定要删除选中的 ${selectedBookmarks.length} 个书签吗？此操作无法撤销。`);
    if (confirmed) {
      await batchDeleteBookmarks(selectedBookmarks);
    }
  };

  const handleBatchAIArchive = () => {
    if (selectedBookmarks.length === 0) return;
    const ids = selectedBookmarks;
    const queue = buildAiArchiveQueue(useBookmarkStore.getState().bookmarks, ids);
    if (queue.length === 0) {
      alert('没有需要归档的书签（失效链接不会处理）');
      return;
    }
    navigate('/ai-archive', { state: { bookmarkIds: ids, scope: 'selected' } });
  };

  const selectedSet = useMemo(() => new Set(selectedBookmarks), [selectedBookmarks]);
  const allSelected =
    filteredBookmarks.length > 0 &&
    filteredBookmarks.every(b => selectedSet.has(b.id));

  return (
    <div className="p-6">
      <MainPageHeader
        filteredBookmarks={filteredBookmarks}
        onOpenBatchScreenshot={() => setShowBatchScreenshotModal(true)}
        onBatchAIArchive={handleBatchAIArchive}
        onBatchDelete={handleBatchDelete}
      />

      <BookmarkContent
        filteredBookmarks={filteredBookmarks}
        onBookmarkContextMenu={handleBookmarkContextMenu}
        onListAreaContextMenu={handleListAreaContextMenu}
      />

      {isEditModalOpen && editingBookmark && (
        <BookmarkEditModal
          bookmark={editingBookmark}
          isOpen={isEditModalOpen}
          onClose={closeEditModal}
        />
      )}

      {showBatchScreenshotModal && (
        <BatchScreenshotModal
          onClose={() => setShowBatchScreenshotModal(false)}
          filteredBookmarks={filteredBookmarks}
        />
      )}

      {contextMenu && currentView !== 'domain' && (
        <BookmarkContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          selectedCount={selectedBookmarks.length}
          filteredTotal={filteredBookmarks.length}
          allSelected={allSelected}
          targetBookmark={contextTargetBookmark}
          onSelectAll={() => setSelectedBookmarks(filteredBookmarks.map(b => b.id))}
          onClearSelection={clearSelection}
          onInvertSelection={() => {
            const selectedSet = new Set(selectedBookmarks);
            setSelectedBookmarks(
              filteredBookmarks.map(b => b.id).filter(id => !selectedSet.has(id))
            );
          }}
          onOpen={() => {
            const b = contextTargetBookmark;
            if (b) void openBookmarkUrl(b);
          }}
          onEdit={() => {
            const b = contextTargetBookmark;
            if (b) openEditModal(b);
          }}
          onAIArchive={() => {
            if (selectedBookmarks.length > 0) {
              handleBatchAIArchive();
            }
          }}
          onDelete={() => {
            void handleBatchDelete();
          }}
          onToggleArchive={async () => {
            const b = contextTargetBookmark;
            if (!b) return;
            await updateBookmark(
              b.id,
              isBookmarkArchived(b)
                ? clearBookmarkArchivedPatch()
                : markBookmarkArchivedPatch()
            );
          }}
          aiArchiveDisabled={isLoading}
        />
      )}
    </div>
  );
};

export default MainPage;
