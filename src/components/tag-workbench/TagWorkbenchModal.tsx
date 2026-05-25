import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useBookmarkStore } from '../../store';
import { tagService } from '../../services/tagService';
import { buildTagPathByIdMap } from '../../utils/tagPath';
import type { Tag, TagTreeNode } from '../../types';
import { TagWorkbenchToolbar } from './TagWorkbenchToolbar';
import { TagAgentView } from './TagAgentView';
import { TagTreeView } from './TagTreeView';
import { AICategorySuggestionsView } from './AICategorySuggestionsView';
import { TagDetailPanel } from './TagDetailPanel';

type ViewTab = 'agent' | 'tree' | 'ai-categories';

interface TagWorkbenchModalProps {
  onClose: () => void;
}

export const TagWorkbenchModal: React.FC<TagWorkbenchModalProps> = ({ onClose }) => {
  const tags = useBookmarkStore(s => s.tags);
  const bookmarks = useBookmarkStore(s => s.bookmarks);

  const [activeView, setActiveView] = useState<ViewTab>('agent');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagTree, setTagTree] = useState<TagTreeNode[]>([]);

  // 加载标签树
  useEffect(() => {
    tagService.getTagTree().then(setTagTree);
  }, [tags]);

  // 标签使用计数
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    bookmarks.forEach(b => {
      b.tagIds?.forEach(tid => {
        counts.set(tid, (counts.get(tid) || 0) + 1);
      });
    });
    return counts;
  }, [bookmarks]);

  // 统计（子树有书签 → 祖先也算已用）
  const stats = useMemo(() => {
    const usedIds = new Set<string>(bookmarks.flatMap(b => b.tagIds || []));
    const tagMap = new Map(tags.map(t => [t.id, t]));
    // 从每个直接引用的标签向上走，把所有祖先也标记为 used
    const allUsed = new Set(usedIds);
    for (const id of usedIds) {
      let cur = tagMap.get(id);
      while (cur?.parentId && !allUsed.has(cur.parentId)) {
        allUsed.add(cur.parentId);
        cur = tagMap.get(cur.parentId);
      }
    }
    const used = tags.filter(t => allUsed.has(t.id)).length;
    return { total: tags.length, used, unused: tags.length - used };
  }, [tags, bookmarks]);

  // 路径映射
  const tagPathMap = useMemo(() => buildTagPathByIdMap(tags), [tags]);

  // 选中的标签
  const selectedTag = useMemo(
    () => tags.find(t => t.id === selectedTagId) || null,
    [tags, selectedTagId]
  );
  const selectedTagPath = selectedTag ? (tagPathMap.get(selectedTag.id) || selectedTag.name) : '';
  const selectedTagCount = selectedTagId ? (tagCounts.get(selectedTagId) || 0) : 0;
  const selectedChildCount = useMemo(() => {
    if (!selectedTagId) return 0;
    return tags.filter(t => t.parentId === selectedTagId).length;
  }, [tags, selectedTagId]);
  const selectedBookmarks = useMemo(() => {
    if (!selectedTagId) return [];
    return bookmarks.filter(b => b.tagIds?.includes(selectedTagId)).slice(0, 8);
  }, [bookmarks, selectedTagId]);

  const handleTagSelect = useCallback((tagId: string) => {
    setSelectedTagId(prev => prev === tagId ? null : tagId);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedTagId(null);
    setSearchQuery('');
    onClose();
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-200">
      <div className="w-full h-full lg:w-[92vw] lg:h-[88vh] lg:max-w-7xl flex flex-col bg-white dark:bg-gray-900 lg:rounded-2xl lg:shadow-2xl lg:border lg:border-gray-200 dark:lg:border-gray-700 overflow-hidden animate-fade-in">
        <TagWorkbenchToolbar
          stats={stats}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeView={activeView}
          onViewChange={setActiveView}
          onClose={handleClose}
        />

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 overflow-hidden relative">
            {activeView === 'agent' && (
              <TagAgentView
                tags={tags}
                tagCounts={tagCounts}
                tagPathMap={tagPathMap}
                searchQuery={searchQuery}
                selectedTagId={selectedTagId}
                onTagSelect={handleTagSelect}
              />
            )}
            {activeView === 'tree' && (
              <div className="h-full overflow-y-auto p-4">
                <TagTreeView
                  tags={tags}
                  tagTree={tagTree}
                  tagCounts={tagCounts}
                  tagPathMap={tagPathMap}
                  searchQuery={searchQuery}
                  selectedTagId={selectedTagId}
                  onTagSelect={handleTagSelect}
                />
              </div>
            )}
            {activeView === 'ai-categories' && (
              <div className="h-full overflow-y-auto p-4">
                <AICategorySuggestionsView
                  categories={useBookmarkStore.getState().categories}
                  bookmarks={bookmarks}
                />
              </div>
            )}
          </div>

        {/* 桌面端侧边详情面板 */}
        <div className="hidden lg:block w-80 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
          <TagDetailPanel
            tag={selectedTag}
            tagPath={selectedTagPath}
            bookmarkCount={selectedTagCount}
            childCount={selectedChildCount}
            bookmarks={selectedBookmarks}
            tags={tags}
            tagCounts={tagCounts}
            onClose={() => setSelectedTagId(null)}
          />
        </div>
        </div>
      </div>

      {/* 移动端底部抽屉 */}
      {selectedTagId && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 max-h-[60vh] bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-t-2xl shadow-2xl overflow-y-auto z-10">
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
          <TagDetailPanel
            tag={selectedTag}
            tagPath={selectedTagPath}
            bookmarkCount={selectedTagCount}
            childCount={selectedChildCount}
            bookmarks={selectedBookmarks}
            tags={tags}
            tagCounts={tagCounts}
            onClose={() => setSelectedTagId(null)}
          />
        </div>
      )}
    </div>
  );
};
