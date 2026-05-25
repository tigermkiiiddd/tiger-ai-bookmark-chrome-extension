import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePageState } from '../hooks/usePageState';
import { ArrowLeft, AlertCircle, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import { useBookmarkStore } from '../store/index';
import { formatDate, extractDomain } from '../utils/index';
import {
  buildLinkCheckQueue,
  formatLastLinkCheckTime,
  formatLinkCheckSkipPeriod,
  isLinkCheckSkipEnabled
} from '../utils/linkCheck';
import type { Bookmark, LinkFailureType } from '../types/index';
import { openBookmarkUrl } from '../utils/openBookmark';

type FailureFilter = 'all' | LinkFailureType;

const BrokenLinksPage: React.FC = () => {
  usePageState();
  const navigate = useNavigate();
  const {
    bookmarks,
    settings,
    updateBookmark,
    batchDeleteBookmarks,
    getFilteredBookmarks,
    searchQuery,
    activeFilters,
    sortBy,
    sortOrder,
    categories
  } = useBookmarkStore();
  const [selectedBookmarks, setSelectedBookmarks] = useState<string[]>([]);
  const [failureFilter, setFailureFilter] = useState<FailureFilter>('all');

  const linkCheckQueue = useMemo(
    () => buildLinkCheckQueue(getFilteredBookmarks(), settings),
    [bookmarks, settings, searchQuery, activeFilters, sortBy, sortOrder, categories]
  );

  const brokenBookmarks = bookmarks.filter(b => b.status === 'dead');
  const siteDeadBookmarks = brokenBookmarks.filter(
    b => b.linkFailureType === 'site_dead'
  );
  const pageDeadBookmarks = brokenBookmarks.filter(
    b => b.linkFailureType === 'page_dead' || !b.linkFailureType
  );

  const displayedBroken =
    failureFilter === 'all'
      ? brokenBookmarks
      : failureFilter === 'site_dead'
        ? siteDeadBookmarks
        : pageDeadBookmarks;

  const siteDeadByDomain = siteDeadBookmarks.reduce<Map<string, Bookmark[]>>(
    (map, b) => {
      const domain = extractDomain(b.url);
      const list = map.get(domain) ?? [];
      list.push(b);
      map.set(domain, list);
      return map;
    },
    new Map()
  );
  
  const handleStartLinkCheck = () => {
    if (linkCheckQueue.length === 0) {
      alert(
        isLinkCheckSkipEnabled(settings)
          ? `没有需要检查的书签（已启用跳过：${formatLinkCheckSkipPeriod(settings)}内已检的不重复检测）`
          : '没有需要检查的书签'
      );
      return;
    }
    navigate('/link-check');
  };

  const handleSelectBookmark = (bookmarkId: string, selected: boolean) => {
    if (selected) {
      setSelectedBookmarks(prev => [...prev, bookmarkId]);
    } else {
      setSelectedBookmarks(prev => prev.filter(id => id !== bookmarkId));
    }
  };

  const handleSelectAll = () => {
    if (selectedBookmarks.length === displayedBroken.length) {
      setSelectedBookmarks([]);
    } else {
      setSelectedBookmarks(displayedBroken.map(b => b.id));
    }
  };

  const handleBatchAction = async (action: 'delete' | 'restore') => {
    if (selectedBookmarks.length === 0) return;
    
    if (action === 'delete') {
      const confirmed = confirm(`确定要删除所选的 ${selectedBookmarks.length} 个书签吗？`);
      if (confirmed) {
        await batchDeleteBookmarks(selectedBookmarks);
        setSelectedBookmarks([]);
      }
    } else if (action === 'restore') {
      for (const id of selectedBookmarks) {
        await updateBookmark(id, { status: 'active', linkFailureType: null });
      }
      setSelectedBookmarks([]);
    }
  };

  const handleDeleteSiteDeadDomain = async (domain: string) => {
    const group = siteDeadByDomain.get(domain);
    if (!group?.length) return;
    const confirmed = confirm(
      `确定删除域名「${domain}」下全部 ${group.length} 个站点失效书签？`
    );
    if (confirmed) {
      await batchDeleteBookmarks(group.map(b => b.id));
      setSelectedBookmarks(prev =>
        prev.filter(id => !group.some(b => b.id === id))
      );
    }
  };

  const handleDeleteAllSiteDead = async () => {
    if (siteDeadBookmarks.length === 0) return;
    const confirmed = confirm(
      `确定删除全部 ${siteDeadBookmarks.length} 个站点失效书签？`
    );
    if (confirmed) {
      await batchDeleteBookmarks(siteDeadBookmarks.map(b => b.id));
      setSelectedBookmarks([]);
    }
  };

  const getFailureLabel = (bookmark: Bookmark) => {
    if (bookmark.linkFailureType === 'site_dead') return '站点失效';
    if (bookmark.linkFailureType === 'page_dead') return '页面失效';
    return '失效（未分类）';
  };

  const getFailureBadgeClass = (type?: LinkFailureType | null) => {
    if (type === 'site_dead') {
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
    }
    if (type === 'page_dead') {
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    }
    return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
  };

  const handleFixLink = async (bookmark: any) => {
    const newUrl = prompt('请输入新的URL:', bookmark.url);
    if (newUrl && newUrl !== bookmark.url) {
      await updateBookmark(bookmark.id, {
        url: newUrl,
        status: 'active',
        linkFailureType: null
      });
    }
  };

  const handleRestoreLink = async (bookmarkId: string) => {
    await updateBookmark(bookmarkId, { status: 'active', linkFailureType: null });
  };

  const handleDeleteBrokenLinks = async () => {
    if (brokenBookmarks.length === 0) return;
    
    const confirmed = confirm(`确定要删除所有 ${brokenBookmarks.length} 个失效书签吗？此操作无法撤销。`);
    if (confirmed) {
      const ids = brokenBookmarks.map(b => b.id);
      await batchDeleteBookmarks(ids);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回所有书签
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                失效链接
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {brokenBookmarks.length > 0
                  ? `共 ${brokenBookmarks.length} 个失效（站点 ${siteDeadBookmarks.length} · 页面 ${pageDeadBookmarks.length}）`
                  : '没有发现失效链接'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {siteDeadBookmarks.length > 0 && (
              <button
                onClick={handleDeleteAllSiteDead}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                删除全部站点失效
              </button>
            )}
            {brokenBookmarks.length > 0 && (
              <button
                onClick={handleDeleteBrokenLinks}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                删除全部失效
              </button>
            )}
            
            <button
              onClick={handleStartLinkCheck}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重新检测失效链接
            </button>
          </div>
        </div>

        {/* Last Check Time */}
        {settings.lastLinkCheckAt ? (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              上次检查时间: {formatLastLinkCheckTime(settings.lastLinkCheckAt)}
            </p>
          </div>
        ) : null}

      </div>

      {/* Content */}
      {brokenBookmarks.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-green-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            太棒了！没有失效链接
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            所有书签都可以正常访问
          </p>
          <button
            onClick={handleStartLinkCheck}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            开始链接检测
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['all', '全部', brokenBookmarks.length],
                ['site_dead', '站点失效', siteDeadBookmarks.length],
                ['page_dead', '页面失效', pageDeadBookmarks.length]
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFailureFilter(key)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  failureFilter === key
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          {failureFilter === 'site_dead' && siteDeadByDomain.size > 0 && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm text-orange-800 dark:text-orange-200">
              以下域名已判定为站点整体不可达，同域链接在检测时已自动跳过。可按域名批量删除。
            </div>
          )}

          {displayedBroken.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              当前筛选下没有失效书签
            </p>
          )}

          {displayedBroken.map(bookmark => {
            const domain = extractDomain(bookmark.url);
            const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
            const isSiteDead = bookmark.linkFailureType === 'site_dead';
            const domainGroupSize = siteDeadByDomain.get(domain)?.length ?? 0;

            return (
              <div
                key={bookmark.id}
                className={`flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border ${
                  isSiteDead
                    ? 'border-orange-200 dark:border-orange-800'
                    : 'border-red-200 dark:border-red-800'
                }`}
              >
                {/* Favicon */}
                <img
                  src={faviconUrl}
                  alt={domain}
                  className="w-6 h-6 rounded opacity-50"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23ccc"/></svg>';
                  }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {bookmark.title}
                  </h3>
                  <p className="text-xs text-red-600 dark:text-red-400 truncate mt-0.5">
                    {bookmark.url}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${getFailureBadgeClass(bookmark.linkFailureType)}`}
                    >
                      {getFailureLabel(bookmark)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {domain}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      添加: {formatDate(bookmark.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isSiteDead && domainGroupSize > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSiteDeadDomain(domain)}
                      className="px-3 py-1.5 text-xs font-medium text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-600 rounded hover:bg-orange-50 dark:hover:bg-orange-900/30"
                      title={`删除 ${domain} 下 ${domainGroupSize} 条`}
                    >
                      删整站
                    </button>
                  )}
                  <button
                    onClick={() => void openBookmarkUrl(bookmark)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="在新标签页打开"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleFixLink(bookmark)}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 rounded transition-colors"
                  >
                    修复
                  </button>
                  
                  <button
                    onClick={() => handleRestoreLink(bookmark.id)}
                    className="px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 border border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600 rounded transition-colors"
                  >
                    恢复
                  </button>
                  
                  <button
                    onClick={() => updateBookmark(bookmark.id, { status: 'active' })}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-200 dark:border-red-700 hover:border-red-300 dark:hover:border-red-600 rounded transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Help Text */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          关于失效链接检测
        </h4>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p>• 失效分为两类：站点失效（整站不可达）与页面失效（单 URL 如 404）</p>
          <p>• 判定为站点失效后，同域名其余书签将跳过检测并一并标记，便于批量清理</p>
          <p>• 由于网络限制，某些正常网站可能被误判，可手动恢复为正常</p>
          <p>• 建议定期检查失效链接以保持书签库整洁</p>
        </div>
      </div>
    </div>
  );
};

export default BrokenLinksPage;