import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageState } from '../../hooks/usePageState';
import { useBookmarkStore } from '../../store';
import { tagService } from '../../services/tagService';
import { buildTagPathByIdMap } from '../../utils/tagPath';
import type { TagTreeNode } from '../../types';
import { TagWorkbenchToolbar } from './TagWorkbenchToolbar';
import { TagAgentView } from './TagAgentView';
import { TagTreeView } from './TagTreeView';
import { AICategorySuggestionsView } from './AICategorySuggestionsView';
import { TagDetailPanel } from './TagDetailPanel';

type ViewTab = 'agent' | 'tree' | 'ai-categories';

const TagWorkbenchPage: React.FC = () => {
  usePageState();
  const navigate = useNavigate();
  const tags = useBookmarkStore(s => s.tags);
  const bookmarks = useBookmarkStore(s => s.bookmarks);
  const categories = useBookmarkStore(s => s.categories);

  const [activeView, setActiveView] = useState<ViewTab>('agent');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagTree, setTagTree] = useState<TagTreeNode[]>([]);

  useEffect(() => {
    tagService.getTagTree().then(setTagTree);
  }, [tags]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    bookmarks.forEach(bookmark => {
      bookmark.tagIds?.forEach(tagId => {
        counts.set(tagId, (counts.get(tagId) || 0) + 1);
      });
    });
    return counts;
  }, [bookmarks]);

  // 统计（子树有书签 → 祖先也算已用）
  const stats = useMemo(() => {
    const usedIds = new Set<string>(bookmarks.flatMap(bookmark => bookmark.tagIds || []));
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
  }, [bookmarks, tags]);

  const tagPathMap = useMemo(() => buildTagPathByIdMap(tags), [tags]);
  const selectedTag = useMemo(
    () => tags.find(tag => tag.id === selectedTagId) || null,
    [selectedTagId, tags]
  );
  const selectedTagPath = selectedTag ? (tagPathMap.get(selectedTag.id) || selectedTag.name) : '';
  const selectedTagCount = selectedTagId ? (tagCounts.get(selectedTagId) || 0) : 0;
  const selectedChildCount = useMemo(() => {
    if (!selectedTagId) return 0;
    return tags.filter(tag => tag.parentId === selectedTagId).length;
  }, [selectedTagId, tags]);
  const selectedBookmarks = useMemo(() => {
    if (!selectedTagId) return [];
    return bookmarks.filter(bookmark => bookmark.tagIds?.includes(selectedTagId)).slice(0, 8);
  }, [bookmarks, selectedTagId]);

  const handleTagSelect = useCallback((tagId: string) => {
    setSelectedTagId(prev => prev === tagId ? null : tagId);
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-gray-900">
      <TagWorkbenchToolbar
        stats={stats}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeView={activeView}
        onViewChange={setActiveView}
        onClose={() => navigate('/')}
      />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        <div className="flex-1 overflow-hidden relative min-w-0">
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
              <AICategorySuggestionsView categories={categories} bookmarks={bookmarks} />
            </div>
          )}
        </div>

        <div className="hidden lg:block w-80 border-l border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-900">
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

export default TagWorkbenchPage;
