import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DomainGroup, DomainGroupViewOptions, Bookmark } from '../types';
import { StorageService } from '../services/storage';
import { useBookmarkStore } from '../store';
import { Globe, ChevronRight, Search, Filter, SortAsc, SortDesc, Repeat } from 'lucide-react';
import { openBookmarkUrl } from '../utils/openBookmark';
import { buildTagPathByIdMap, getFlatTagDisplayNames } from '../utils/tagPath';
import { ReplaceDomainModal } from './ReplaceDomainModal';

interface DomainGroupListProps {
  onGroupSelect?: (group: DomainGroup) => void;
  onBookmarkSelect?: (bookmark: Bookmark) => void;
  className?: string;
}

export const DomainGroupList: React.FC<DomainGroupListProps> = ({
  onGroupSelect,
  onBookmarkSelect,
  className = ''
}) => {
  const [groups, setGroups] = useState<DomainGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<DomainGroupViewOptions['sortBy']>('bookmarkCount');
  const [sortOrder, setSortOrder] = useState<DomainGroupViewOptions['sortOrder']>('desc');
  const [minBookmarkCount, setMinBookmarkCount] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupBookmarks, setGroupBookmarks] = useState<Record<string, Bookmark[]>>({});
  const [replaceTarget, setReplaceTarget] = useState<DomainGroup | null>(null);

  const storageService = StorageService.getInstance();
  const tags = useBookmarkStore(s => s.tags);
  const tagPathMap = useMemo(() => buildTagPathByIdMap(tags), [tags]);

  useEffect(() => {
    loadGroups();
  }, [searchQuery, sortBy, sortOrder, minBookmarkCount]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const options: DomainGroupViewOptions = {
        sortBy,
        sortOrder,
        minBookmarkCount: minBookmarkCount > 1 ? minBookmarkCount : undefined,
        searchQuery: searchQuery.trim() || undefined
      };
      
      const domainGroups = await storageService.getDomainGroups(options);
      setGroups(domainGroups);
    } catch (error) {
      console.error('Failed to load domain groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupExpansion = async (group: DomainGroup) => {
    const newExpandedGroups = new Set(expandedGroups);
    
    if (expandedGroups.has(group.id)) {
      newExpandedGroups.delete(group.id);
      setExpandedGroups(newExpandedGroups);
    } else {
      newExpandedGroups.add(group.id);
      setExpandedGroups(newExpandedGroups);
      
      // 加载该域名下的书签
      if (!groupBookmarks[group.id]) {
        try {
          const bookmarks = await storageService.getBookmarksByDomain(group.domain);
          setGroupBookmarks(prev => ({
            ...prev,
            [group.id]: bookmarks
          }));
        } catch (error) {
          console.error('Failed to load bookmarks for domain:', group.domain, error);
        }
      }
    }
  };

  const handleGroupClick = (group: DomainGroup) => {
    if (onGroupSelect) {
      onGroupSelect(group);
    } else {
      toggleGroupExpansion(group);
    }
  };

  const handleBookmarkClick = (bookmark: Bookmark) => {
    if (onBookmarkSelect) {
      onBookmarkSelect(bookmark);
    } else {
      void openBookmarkUrl(bookmark);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleReplaceDomain = useCallback(async (newDomain: string) => {
    if (!replaceTarget) return;
    const count = await storageService.replaceDomain(replaceTarget.domain, newDomain);
    setReplaceTarget(null);
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.delete(replaceTarget.id);
      return next;
    });
    setGroupBookmarks(prev => {
      const next = { ...prev };
      delete next[replaceTarget.id];
      return next;
    });
    await loadGroups();
  }, [replaceTarget]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">加载域名分组中...</span>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm ${className}`}>
      {/* 搜索和过滤器 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索域名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border transition-colors ${
              showFilters
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* 过滤器面板 */}
        {showFilters && (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">排序:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as DomainGroupViewOptions['sortBy'])}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="bookmarkCount">书签数量</option>
                  <option value="domain">域名</option>
                  <option value="createdAt">创建时间</option>
                  <option value="updatedAt">更新时间</option>
                </select>
                <button
                  onClick={toggleSortOrder}
                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">最少书签:</label>
                <input
                  type="number"
                  min="1"
                  value={minBookmarkCount}
                  onChange={(e) => setMinBookmarkCount(parseInt(e.target.value) || 1)}
                  className="w-16 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 分组列表 */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {groups.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Globe className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p>没有找到匹配的域名分组</p>
            <p className="text-sm mt-1">尝试调整搜索条件或过滤器</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              {/* 分组头部 */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => handleGroupClick(group)}
              >
                <div className="flex items-center space-x-3">
                  {group.favicon ? (
                    <img
                      src={group.favicon}
                      alt={`${group.domain} favicon`}
                      className="w-6 h-6 rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <Globe className={`w-6 h-6 text-gray-400 dark:text-gray-500 ${group.favicon ? 'hidden' : ''}`} />

                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{group.displayName}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{group.domain}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    title="替换域名"
                    onClick={e => { e.stopPropagation(); setReplaceTarget(group); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                  </button>
                  <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {group.bookmarkCount} 个书签
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${
                      expandedGroups.has(group.id) ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </div>

              {/* 展开的书签列表 */}
              {expandedGroups.has(group.id) && (
                <div className="px-4 pb-4">
                  <div className="ml-9 space-y-2">
                    {groupBookmarks[group.id]?.map((bookmark) => (
                      <div
                        key={bookmark.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => handleBookmarkClick(bookmark)}
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-white truncate">{bookmark.title}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{bookmark.url}</p>
                          {bookmark.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">{bookmark.description}</p>
                          )}
                        </div>

                        {(() => {
                          const tagNames = getFlatTagDisplayNames(bookmark.tagIds, tagPathMap);
                          return tagNames.length > 0 && (
                            <div className="flex flex-wrap gap-1 ml-3">
                              {tagNames.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs px-2 py-1 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                              {tagNames.length > 3 && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">+{tagNames.length - 3}</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )) || (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-2"></div>
                        <span className="text-sm">加载书签中...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {replaceTarget && (
        <ReplaceDomainModal
          oldDomain={replaceTarget.domain}
          bookmarkCount={replaceTarget.bookmarkCount}
          onConfirm={handleReplaceDomain}
          onCancel={() => setReplaceTarget(null)}
        />
      )}
    </div>
  );
};

export default DomainGroupList;