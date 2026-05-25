import React, { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePageState } from '../hooks/usePageState';
import { ArrowLeft, Copy, ExternalLink, Trash2, ChevronDown, ChevronRight, EyeOff, Search } from 'lucide-react';
import { useBookmarkStore } from '../store/index';
import { analyzeDuplicates, type DupGroup } from '../services/deduplication';
import { extractDomain, formatDate, buildTagPathByIdMap, getFlatTagDisplayNames } from '../utils/index';
import { getCategoryPath } from '../utils/categoryTreeBuilder';

type TabKey = 'exact' | 'similar';

const DedupPage: React.FC = () => {
  usePageState();
  const { bookmarks, batchDeleteBookmarks, categories, tags } = useBookmarkStore();
  const tagPathMap = useMemo(() => buildTagPathByIdMap(tags), [tags]);

  const [activeTab, setActiveTab] = useState<TabKey>('exact');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [ignoredGroups, setIgnoredGroups] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const result = useMemo(() => analyzeDuplicates(bookmarks), [bookmarks]);

  const currentGroups = activeTab === 'exact' ? result.exactGroups : result.similarGroups;

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return currentGroups.filter(g => !ignoredGroups.has(g.id));
    const q = searchQuery.toLowerCase();
    return currentGroups
      .filter(g => !ignoredGroups.has(g.id))
      .filter(g =>
        g.bookmarks.some(b =>
          b.title.toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q)
        )
      );
  }, [currentGroups, ignoredGroups, searchQuery]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleGroupSelect = useCallback((group: DupGroup, select: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const b of group.bookmarks) {
        if (select) next.add(b.id); else next.delete(b.id);
      }
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }, []);

  const ignoreGroup = useCallback((groupId: string) => {
    setIgnoredGroups(prev => new Set(prev).add(groupId));
    const group = currentGroups.find(g => g.id === groupId);
    if (group) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const b of group.bookmarks) next.delete(b.id);
        return next;
      });
    }
  }, [currentGroups]);

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = confirm(`确定要删除选中的 ${selectedIds.size} 个书签吗？此操作无法撤销。`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      await batchDeleteBookmarks([...selectedIds]);
      setSelectedIds(new Set());
    } finally {
      setDeleting(false);
    }
  };

  const tabLabel = (key: TabKey) => {
    const count = key === 'exact' ? result.exactGroups.length : result.similarGroups.length;
    const bookmarkCount = key === 'exact'
      ? result.exactGroups.reduce((s, g) => s + g.bookmarks.length, 0)
      : result.similarGroups.reduce((s, g) => s + g.bookmarks.length, 0);
    return key === 'exact'
      ? `完全相同 (${count}组 / ${bookmarkCount}个)`
      : `近似页面 (${count}组 / ${bookmarkCount}个)`;
  };

  const getCategoryLabel = (categoryId?: string) => {
    if (!categoryId) return '未分类';
    return getCategoryPath(categoryId, categories) || '未分类';
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回书签
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
              <Copy className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                去重分析
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                共 {result.stats.totalBookmarks} 个书签 · {result.stats.groupsCount} 组重复 · 涉及 {result.stats.duplicateCount} 个
              </p>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                已选 <span className="font-medium text-gray-900 dark:text-white">{selectedIds.size}</span> 个
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                取消选择
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md text-sm"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? '删除中...' : `删除选中 (${selectedIds.size})`}
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex border-b border-gray-200 dark:border-gray-700 sm:border-0">
            {(['exact', 'similar'] as TabKey[]).map(key => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tabLabel(key)}
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索标题或 URL..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-shrink-0 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            {activeTab === 'exact' ? '完全相同' : '近似页面'}（{filteredGroups.length} 组）
          </h2>
          {ignoredGroups.size > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              已忽略 {ignoredGroups.size} 组
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredGroups.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              <Copy className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-gray-700 dark:text-gray-300">没有发现重复</p>
              <p className="mt-1">
                {ignoredGroups.size > 0 ? '所有重复组已被忽略' : '你的书签库很干净'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700/80">
              {filteredGroups.map(group => {
                const isCollapsed = collapsedGroups.has(group.id);
                const groupSelectedCount = group.bookmarks.filter(b => selectedIds.has(b.id)).length;

                return (
                  <li key={group.id} className="bg-white dark:bg-gray-800">
                    <div
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/40 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/60"
                      onClick={() => toggleCollapse(group.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-500" />
                        )}
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          重复组 #{parseInt(group.id.split('_')[1], 10) + 1}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {group.bookmarks.length} 个 · {extractDomain(group.normalizedKey)}
                        </span>
                        {groupSelectedCount > 0 && (
                          <span className="text-xs text-primary">
                            已选 {groupSelectedCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleGroupSelect(group, groupSelectedCount < group.bookmarks.length)}
                          className="text-xs text-gray-500 hover:text-primary dark:text-gray-400"
                        >
                          {groupSelectedCount === group.bookmarks.length ? '取消全选' : '全选此组'}
                        </button>
                        <button
                          type="button"
                          onClick={() => ignoreGroup(group.id)}
                          className="text-xs text-gray-500 hover:text-amber-600 dark:text-gray-400 flex items-center gap-1"
                        >
                          <EyeOff className="w-3 h-3" />
                          忽略
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <ul className="divide-y divide-gray-100 dark:divide-gray-700/80">
                        {group.bookmarks.map(bookmark => {
                          const isSelected = selectedIds.has(bookmark.id);
                          return (
                            <li
                              key={bookmark.id}
                              className={`flex items-start gap-3 px-4 py-2.5 text-sm ${
                                isSelected
                                  ? 'bg-red-50/80 dark:bg-red-900/15'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(bookmark.id)}
                                className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {bookmark.favicon && (
                                    <img src={bookmark.favicon} alt="" className="w-4 h-4 flex-shrink-0" />
                                  )}
                                  <span className="font-medium text-gray-900 dark:text-white truncate">
                                    {bookmark.title}
                                  </span>
                                </div>
                                <a
                                  href={bookmark.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400 hover:text-primary truncate"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{bookmark.url}</span>
                                </a>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  <span>添加于 {formatDate(bookmark.createdAt)}</span>
                                  <span>{getCategoryLabel(bookmark.categoryId)}</span>
                                  {(() => {
                                    const tagNames = getFlatTagDisplayNames(bookmark.tagIds, tagPathMap);
                                    return tagNames.length > 0 && (
                                      <span>{tagNames.slice(0, 3).join(', ')}</span>
                                    );
                                  })()}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default DedupPage;
