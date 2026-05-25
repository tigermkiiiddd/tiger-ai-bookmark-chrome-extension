import React, { useEffect, useRef } from 'react';
import {
  CheckSquare,
  Square,
  Shuffle,
  ExternalLink,
  Edit,
  Sparkles,
  Trash2,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import type { Bookmark } from '../types';

export interface BookmarkContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  selectedCount: number;
  filteredTotal: number;
  allSelected: boolean;
  targetBookmark?: Bookmark | null;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onInvertSelection: () => void;
  onOpen?: () => void;
  onEdit?: () => void;
  onAIArchive?: () => void;
  onDelete?: () => void;
  onToggleArchive?: () => void;
  aiArchiveDisabled?: boolean;
}

const BookmarkContextMenu: React.FC<BookmarkContextMenuProps> = ({
  x,
  y,
  onClose,
  selectedCount,
  filteredTotal,
  allSelected,
  targetBookmark,
  onSelectAll,
  onClearSelection,
  onInvertSelection,
  onOpen,
  onEdit,
  onAIArchive,
  onDelete,
  onToggleArchive,
  aiArchiveDisabled,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) {
      left = window.innerWidth - rect.width - pad;
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = window.innerHeight - rect.height - pad;
    }
    menu.style.left = `${Math.max(pad, left)}px`;
    menu.style.top = `${Math.max(pad, top)}px`;
  }, [x, y]);

  const itemClass =
    'flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-left';

  const run = (fn?: () => void) => {
    if (!fn) return;
    fn();
    onClose();
  };

  const isArchived =
    !!targetBookmark?.isArchived ||
    (targetBookmark?.status as string | undefined) === 'archived';

  return (
    <div
      ref={menuRef}
      className="fixed z-[2000] min-w-[200px] py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
      style={{ left: x, top: y }}
      role="menu"
    >
      <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
        {selectedCount > 0
          ? `已选 ${selectedCount} 项`
          : `当前列表 ${filteredTotal} 项`}
      </div>

      <button type="button" className={itemClass} onClick={() => run(allSelected ? onClearSelection : onSelectAll)}>
        {allSelected ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
        {allSelected ? '取消全选' : `全选 (${filteredTotal})`}
      </button>
      <button
        type="button"
        className={itemClass}
        onClick={() => run(onInvertSelection)}
        disabled={filteredTotal === 0}
      >
        <Shuffle className="w-4 h-4" />
        反选
      </button>
      {selectedCount > 0 && (
        <button type="button" className={itemClass} onClick={() => run(onClearSelection)}>
          <Square className="w-4 h-4" />
          取消选择
        </button>
      )}

      <hr className="my-1 border-gray-200 dark:border-gray-700" />

      {selectedCount === 1 && targetBookmark && (
        <>
          <button type="button" className={itemClass} onClick={() => run(onOpen)}>
            <ExternalLink className="w-4 h-4" />
            在新标签页打开
          </button>
          <button type="button" className={itemClass} onClick={() => run(onEdit)}>
            <Edit className="w-4 h-4" />
            编辑书签
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() => run(onToggleArchive)}
          >
            {isArchived ? (
              <ArchiveRestore className="w-4 h-4" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
            {isArchived ? '取消归档' : '归档'}
          </button>
        </>
      )}

      <button
        type="button"
        className={`${itemClass} text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20`}
        onClick={() => run(onAIArchive)}
        disabled={selectedCount === 0 || aiArchiveDisabled}
      >
        <Sparkles className="w-4 h-4" />
        {selectedCount <= 1 ? 'AI 智能归档' : `AI 批量归档 (${selectedCount})`}
      </button>

      <button
        type="button"
        className={`${itemClass} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}
        onClick={() => run(onDelete)}
        disabled={selectedCount === 0}
      >
        <Trash2 className="w-4 h-4" />
        {selectedCount <= 1 ? '删除书签' : `删除选中 (${selectedCount})`}
      </button>
    </div>
  );
};

export default BookmarkContextMenu;
