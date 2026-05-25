import React, { useState } from 'react';
import { X, Edit2, Move, Merge, ExternalLink } from 'lucide-react';
import type { Bookmark, Tag } from '../../types';
import { TagRenameDialog, TagMoveDialog, TagMergeDialog } from './TagActionDialogs';

interface TagDetailPanelProps {
  tag: Tag | null;
  tagPath: string;
  bookmarkCount: number;
  childCount: number;
  bookmarks: Bookmark[];
  tags: Tag[];
  tagCounts: Map<string, number>;
  onClose: () => void;
}

type ActionDialog = 'none' | 'rename' | 'move' | 'merge';

export const TagDetailPanel: React.FC<TagDetailPanelProps> = ({
  tag,
  tagPath,
  bookmarkCount,
  childCount,
  bookmarks,
  tags,
  tagCounts,
  onClose,
}) => {
  const [activeDialog, setActiveDialog] = useState<ActionDialog>('none');

  if (!tag) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
        选择标签查看详情
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* 头部 */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {tag.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {tagPath}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 统计 */}
      <div className="flex gap-4 text-xs">
        <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <span className="text-blue-600 dark:text-blue-400 font-medium">{bookmarkCount}</span>
          <span className="text-blue-500/70 dark:text-blue-400/70 ml-1">书签</span>
        </div>
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">
          <span className="text-gray-600 dark:text-gray-400 font-medium">{childCount}</span>
          <span className="text-gray-500 dark:text-gray-500 ml-1">子标签</span>
        </div>
      </div>

      {/* 关联书签预览 */}
      {bookmarks.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
            关联书签
          </h4>
          <div className="space-y-1">
            {bookmarks.map(b => (
              <a
                key={b.id}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded group"
              >
                <span className="truncate flex-1">{b.title || b.url}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0" />
              </a>
            ))}
          </div>
          {bookmarkCount > bookmarks.length && (
            <p className="text-xs text-gray-400 mt-1">
              及 {bookmarkCount - bookmarks.length} 个更多...
            </p>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => setActiveDialog(activeDialog === 'rename' ? 'none' : 'rename')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeDialog === 'rename'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Edit2 className="w-3 h-3" />
          改名
        </button>
        <button
          onClick={() => setActiveDialog(activeDialog === 'move' ? 'none' : 'move')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeDialog === 'move'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Move className="w-3 h-3" />
          移动
        </button>
        <button
          onClick={() => setActiveDialog(activeDialog === 'merge' ? 'none' : 'merge')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeDialog === 'merge'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Merge className="w-3 h-3" />
          合并
        </button>
      </div>

      {/* 操作对话框 */}
      {activeDialog === 'rename' && (
        <TagRenameDialog
          tag={tag}
          onDone={() => setActiveDialog('none')}
        />
      )}
      {activeDialog === 'move' && (
        <TagMoveDialog
          tag={tag}
          tags={tags}
          onDone={() => setActiveDialog('none')}
        />
      )}
      {activeDialog === 'merge' && (
        <TagMergeDialog
          tag={tag}
          tags={tags}
          tagCounts={tagCounts}
          onDone={() => setActiveDialog('none')}
        />
      )}
    </div>
  );
};
