import React, { useState, useMemo } from 'react';
import { useBookmarkStore } from '../../store';
import { tagService } from '../../services/tagService';
import { Check, X } from 'lucide-react';
import type { Tag } from '../../types';

interface DialogProps {
  tag: Tag;
  tags?: Tag[];
  tagCounts?: Map<string, number>;
  onDone: () => void;
}

export const TagRenameDialog: React.FC<DialogProps> = ({ tag, onDone }) => {
  const renameTag = useBookmarkStore(s => s.renameTag);
  const [newName, setNewName] = useState(tag.name);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!newName.trim() || newName.trim() === tag.name) return;
    setLoading(true);
    try {
      await renameTag(tag.id, newName.trim());
      onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
      <input
        type="text"
        value={newName}
        onChange={e => setNewName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleConfirm()}
        className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
        autoFocus
      />
      <div className="flex justify-end gap-1.5">
        <button onClick={onDone} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          取消
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading || !newName.trim() || newName.trim() === tag.name}
          className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded flex items-center gap-1"
        >
          <Check className="w-3 h-3" />
          确认
        </button>
      </div>
    </div>
  );
};

export const TagMoveDialog: React.FC<DialogProps> = ({ tag, tags = [], onDone }) => {
  const moveTag = useBookmarkStore(s => s.moveTag);
  const [newParentId, setNewParentId] = useState<string | null>(tag.parentId || null);
  const [loading, setLoading] = useState(false);

  // 排除自身和后代
  const descendantIds = useMemo(() => {
    const ids = new Set<string>();
    function walk(parentId: string) {
      ids.add(parentId);
      tags.filter(t => t.parentId === parentId).forEach(t => walk(t.id));
    }
    walk(tag.id);
    return ids;
  }, [tags, tag.id]);

  const candidates = tags.filter(t => !descendantIds.has(t.id) && t.id !== tag.id);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await moveTag(tag.id, newParentId || undefined);
      onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
      <select
        value={newParentId || ''}
        onChange={e => setNewParentId(e.target.value || null)}
        className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
      >
        <option value="">-- 根级 --</option>
        {candidates.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <div className="flex justify-end gap-1.5">
        <button onClick={onDone} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          取消
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded flex items-center gap-1"
        >
          <Check className="w-3 h-3" />
          确认移动
        </button>
      </div>
    </div>
  );
};

export const TagMergeDialog: React.FC<DialogProps> = ({ tag, tags = [], tagCounts, onDone }) => {
  const mergeTags = useBookmarkStore(s => s.mergeTags);
  const bookmarks = useBookmarkStore(s => s.bookmarks);
  const [sourceTagIds, setSourceTagIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // 目标标签是当前选中的标签
  const targetTagId = tag.id;
  const candidates = tags.filter(t => t.id !== targetTagId);

  const affectedCount = useMemo(() => {
    if (sourceTagIds.size === 0) return 0;
    return bookmarks.filter(b =>
      b.tagIds?.some(tid => sourceTagIds.has(tid))
    ).length;
  }, [bookmarks, sourceTagIds]);

  const toggleSource = (id: string) => {
    setSourceTagIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (sourceTagIds.size === 0) return;
    setLoading(true);
    try {
      await mergeTags(Array.from(sourceTagIds), targetTagId);
      onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        将以下标签合并到 <span className="font-medium text-gray-700 dark:text-gray-300">{tag.name}</span>
      </div>
      <div className="max-h-32 overflow-y-auto space-y-1">
        {candidates.map(t => {
          const count = tagCounts?.get(t.id) || 0;
          const selected = sourceTagIds.has(t.id);
          return (
            <label
              key={t.id}
              className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                selected
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggleSource(t.id)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="flex-1 truncate">{t.name}</span>
              <span className="text-gray-400">({count})</span>
            </label>
          );
        })}
      </div>
      {affectedCount > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          将影响 {affectedCount} 个书签
        </p>
      )}
      <div className="flex justify-end gap-1.5">
        <button onClick={onDone} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          取消
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading || sourceTagIds.size === 0}
          className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded flex items-center gap-1"
        >
          <Check className="w-3 h-3" />
          确认合并
        </button>
      </div>
    </div>
  );
};
