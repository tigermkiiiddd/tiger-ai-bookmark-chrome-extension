import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Zap, Camera, Link2Off, Copy, X } from 'lucide-react';
import { useBookmarkStore } from '../../store';
import { getCategoryPath } from '../../utils/categoryTreeBuilder';
import { formatTagPath } from '../../utils/tagPath';
import { buildAiArchiveQueue } from '../../utils/aiArchive';
import {
  buildLinkCheckQueue,
  formatLinkCheckSkipPeriod,
  isLinkCheckSkipEnabled
} from '../../utils/linkCheck';
import { STATUS_FILTER_LABELS } from '../../utils/statusFilter';
import type { Bookmark, StatusFilterValue } from '../../types';

interface MainPageHeaderProps {
  filteredBookmarks: Bookmark[];
  onOpenBatchScreenshot: () => void;
  onBatchAIArchive: () => void;
  onBatchDelete: () => void;
}

const MainPageHeader: React.FC<MainPageHeaderProps> = ({
  filteredBookmarks,
  onOpenBatchScreenshot,
  onBatchAIArchive,
  onBatchDelete,
}) => {
  const navigate = useNavigate();
  const bookmarks = useBookmarkStore(s => s.bookmarks);
  const searchQuery = useBookmarkStore(s => s.searchQuery);
  const activeFilters = useBookmarkStore(s => s.activeFilters);
  const selectedBookmarks = useBookmarkStore(s => s.selectedBookmarks);
  const isLoading = useBookmarkStore(s => s.isLoading);
  const settings = useBookmarkStore(s => s.settings);
  const categories = useBookmarkStore(s => s.categories);
  const tags = useBookmarkStore(s => s.tags);
  const setSearchQuery = useBookmarkStore(s => s.setSearchQuery);
  const setActiveFilters = useBookmarkStore(s => s.setActiveFilters);
  const clearFilters = useBookmarkStore(s => s.clearFilters);
  const clearSelection = useBookmarkStore(s => s.clearSelection);
  const batchCaptureThumbnails = useBookmarkStore(s => s.batchCaptureThumbnails);

  const getCategoryFilterLabel = useCallback(
    (categoryId: string) => {
      const cat = categories.find(c => c.id === categoryId);
      return cat ? getCategoryPath(categoryId, categories) : categoryId;
    },
    [categories]
  );

  const tagIdSet = useMemo(() => new Set(tags.map(t => t.id)), [tags]);
  const tagNameToIdMap = useMemo(() => new Map(tags.map(t => [t.name, t.id])), [tags]);

  const getTagFilterLabel = useCallback(
    (tagValue: string) => {
      const tagId = tagIdSet.has(tagValue) ? tagValue : tagNameToIdMap.get(tagValue);
      return tagId ? formatTagPath(tagId, tags) : tagValue;
    },
    [tagIdSet, tagNameToIdMap, tags]
  );

  const removeFilter = useCallback(
    (key: 'tags' | 'categories' | 'status', value: string) => {
      setActiveFilters({
        ...activeFilters,
        [key]: (activeFilters[key] || []).filter((v: string) => v !== value),
      });
    },
    [activeFilters, setActiveFilters]
  );

  const navigateToAiArchive = (scope: 'selected' | 'filtered' | 'all') => {
    let ids: string[] | undefined;
    if (scope === 'selected') {
      if (selectedBookmarks.length === 0) return;
      ids = selectedBookmarks;
    } else if (scope === 'all') {
      ids = filteredBookmarks.map(b => b.id);
    } else {
      ids = filteredBookmarks.map(b => b.id);
    }
    const queue = buildAiArchiveQueue(bookmarks, ids);
    if (queue.length === 0) {
      alert('没有需要归档的书签（失效链接不会处理）');
      return;
    }
    navigate('/ai-archive', { state: { bookmarkIds: ids, scope } });
  };

  const handleAutoAIArchive = () => {
    if (bookmarks.length === 0) return;
    navigateToAiArchive('all');
  };

  const handleBatchCaptureThumbnails = async () => {
    if (selectedBookmarks.length === 0) return;
    try {
      await batchCaptureThumbnails(selectedBookmarks);
    } catch (error) {
      console.error('批量截图失败:', error);
    }
  };

  const handleBatchRefreshThumbnails = async () => {
    if (selectedBookmarks.length === 0) return;
    try {
      await batchCaptureThumbnails(selectedBookmarks, { force: true });
    } catch (error) {
      console.error('批量更新截图失败:', error);
    }
  };

  const linkCheckQueue = useMemo(
    () => buildLinkCheckQueue(filteredBookmarks, settings),
    [filteredBookmarks, settings]
  );

  const handleCheckBrokenLinks = () => {
    if (linkCheckQueue.length === 0) {
      alert(
        isLinkCheckSkipEnabled(settings)
          ? `没有需要检查的书签（已启用跳过：${formatLinkCheckSkipPeriod(settings)}内已检的不重复检测，可在检测页或设置中关闭）`
          : '没有需要检查的书签（未归档范围内均已检测或无可检项）'
      );
      return;
    }
    navigate('/link-check');
  };

  const hasActiveFilters = searchQuery ||
    (activeFilters.tags || []).length > 0 ||
    (activeFilters.categories || []).length > 0 ||
    (activeFilters.status || []).length > 0;

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {hasActiveFilters ? '筛选结果' : '所有书签'}
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            {hasActiveFilters
              ? `找到 ${filteredBookmarks.length} 个匹配的书签`
              : `共 ${bookmarks.length} 个书签，由 AI 智能管理`
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/tag-workbench')}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="AI 分析现有标签与分类，给出合并冗余标签、补充缺失分类的建议"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm">优化标签和分类</span>
          </button>

          {selectedBookmarks.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <span className="text-sm text-blue-700 dark:text-blue-300">
                已选择 {selectedBookmarks.length} 项
              </span>
              <button
                onClick={onBatchAIArchive}
                disabled={isLoading}
                className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title="使用 AI 为所选书签自动添加分类和标签"
              >
                <Sparkles className="w-3 h-3" />
                AI 批量归档
              </button>
              <button
                onClick={handleBatchCaptureThumbnails}
                disabled={isLoading}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title="为选中的书签批量补充缩略图"
              >
                <Camera className="w-3 h-3" />
                补缩略图
              </button>
              <button
                onClick={handleBatchRefreshThumbnails}
                disabled={isLoading}
                className="flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title="强制重新截取选中书签的页面预览图"
              >
                <Camera className="w-3 h-3" />
                更新截图
              </button>
              <button
                onClick={onBatchDelete}
                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                删除
              </button>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                取消
              </button>
            </div>
          )}

          <button
            onClick={handleAutoAIArchive}
            disabled={isLoading || bookmarks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            title="打开 AI 归档页面，对所有书签进行智能分类与标签整理"
          >
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">批量 AI 归档</span>
          </button>

          <button
            onClick={onOpenBatchScreenshot}
            disabled={bookmarks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            <span className="text-sm">批量更新截图</span>
          </button>

          <button
            onClick={handleCheckBrokenLinks}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <Link2Off className="w-4 h-4" />
            <span className="text-sm">检查失效链接</span>
          </button>
          <button
            onClick={() => navigate('/dedup')}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span className="text-sm">去重分析</span>
          </button>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
              搜索: &quot;{searchQuery}&quot;
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-0.5 rounded-full hover:bg-primary/20"
                aria-label="清除搜索"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
          {(activeFilters.tags || []).map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-sm rounded-full">
              标签: {getTagFilterLabel(tag)}
              <button
                type="button"
                onClick={() => removeFilter('tags', tag)}
                className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
                aria-label={`移除标签 ${getTagFilterLabel(tag)}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          {(activeFilters.categories || []).map(categoryId => (
            <span key={categoryId} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 text-sm rounded-full">
              分类: {getCategoryFilterLabel(categoryId)}
              <button
                type="button"
                onClick={() => removeFilter('categories', categoryId)}
                className="p-0.5 rounded-full hover:bg-green-200 dark:hover:bg-green-800"
                aria-label="移除分类筛选"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          {(activeFilters.status || []).map(status => (
            <span key={status} className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-sm rounded-full">
              状态: {STATUS_FILTER_LABELS[status as StatusFilterValue] || status}
              <button
                type="button"
                onClick={() => removeFilter('status', status)}
                className="p-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800"
                aria-label="移除状态筛选"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary border border-gray-300 dark:border-gray-600 rounded-full transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            清除全部筛选
          </button>
        </div>
      )}
    </div>
  );
};

export default MainPageHeader;
