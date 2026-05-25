import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePageState } from '../hooks/usePageState';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Sparkles,
  AlertCircle,
  Lightbulb,
  ArrowUpDown
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useBookmarkStore } from '../store/index';
import { isBookmarkArchived } from '../utils/bookmarkArchive';
import { buildTagPathByIdMap, getFlatTagDisplayNames } from '../utils/tagPath';
import AiArchiveQueueCard from './AiArchiveQueueCard';
import BookmarkEditModal from './BookmarkEditModal';
import {
  bookmarkNeedsAiArchiveRun,
  buildAiArchiveQueue,
  countSessionQueueStats,
  formatArchiveDuration,
  formatArchiveEta,
  formatArchiveSpeed,
  getAiArchiveRowPhase,
  resolveSessionQueueBookmarks,
  sortSessionQueue,
  type AiArchiveLocationState
} from '../utils/aiArchive';

const AiArchivePage: React.FC = () => {
  usePageState();
  const location = useLocation();
  const navState = (location.state ?? {}) as AiArchiveLocationState;

  const {
    bookmarks,
    isLoading,
    getFilteredBookmarks,
    searchQuery,
    activeFilters,
    sortBy,
    sortOrder,
    categories,
    settings,
    aiArchiveProgress,
    lastBatchResult,
    batchAIArchiveBookmarks,
    pauseArchive,
    resumeArchive,
    cancelArchive,
    clearLastBatchResult,
    editingBookmark,
    isEditModalOpen,
    closeEditModal,
    tags
  } = useBookmarkStore();

  const isLoadingBookmarks = isLoading && bookmarks.length === 0;

  const [phase, setPhase] = useState<'idle' | 'running' | 'completed'>('idle');
  /** 进入本页时冻结的队列，成功归档后仍保留直至离开/刷新 */
  const [sessionQueueIds, setSessionQueueIds] = useState<string[] | null>(
    null
  );
  type SortField = 'current' | 'createdAt' | 'updatedAt' | 'title';
  const [sortField, setSortField] = useState<SortField>('current');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const targetIds = useMemo(() => {
    if (navState.bookmarkIds?.length) return navState.bookmarkIds;
    return getFilteredBookmarks().map(b => b.id);
  }, [
    navState.bookmarkIds,
    navState.scope,
    bookmarks,
    searchQuery,
    activeFilters,
    sortBy,
    sortOrder,
    categories
  ]);

  useEffect(() => {
    if (sessionQueueIds !== null) return;
    if (isLoading && bookmarks.length === 0) return;
    const initial = buildAiArchiveQueue(bookmarks, targetIds);
    setSessionQueueIds(initial.map(b => b.id));
  }, [sessionQueueIds, bookmarks, targetIds, isLoading]);

  const queue = useMemo(() => {
    if (!sessionQueueIds?.length) return [];
    const raw = resolveSessionQueueBookmarks(bookmarks, sessionQueueIds);
    return sortSessionQueue(raw, sessionQueueIds, sortField, sortDirection);
  }, [sessionQueueIds, bookmarks, sortField, sortDirection]);

  const sessionStats = useMemo(
    () => countSessionQueueStats(queue, aiArchiveProgress?.succeededIds),
    [queue, aiArchiveProgress?.succeededIds]
  );

  const pendingIds = useMemo(
    () => queue.filter(bookmarkNeedsAiArchiveRun).map(b => b.id),
    [queue]
  );

  const scopeLabel = useMemo(() => {
    switch (navState.scope) {
      case 'selected':
        return '所选书签';
      case 'all':
        return '全部书签';
      case 'filtered':
        return '当前筛选';
      default:
        return navState.bookmarkIds?.length ? '指定书签' : '当前筛选';
    }
  }, [navState.scope, navState.bookmarkIds]);

  useEffect(() => {
    if (aiArchiveProgress?.isActive) {
      setPhase('running');
    } else if (lastBatchResult && phase === 'running') {
      setPhase('completed');
    }
  }, [aiArchiveProgress?.isActive, lastBatchResult, phase]);

  const isRunning = phase === 'running' && !!aiArchiveProgress?.isActive;
  const isPaused = !!aiArchiveProgress?.isPaused;

  const completedCount = aiArchiveProgress?.completedCount ?? 0;
  const percent =
    aiArchiveProgress && aiArchiveProgress.total > 0
      ? Math.round(
          (completedCount / aiArchiveProgress.total) * 100
        )
      : 0;

  const startArchive = useCallback(async () => {
    if (pendingIds.length === 0) return;
    clearLastBatchResult();
    setPhase('running');
    await batchAIArchiveBookmarks(pendingIds);
  }, [pendingIds, batchAIArchiveBookmarks, clearLastBatchResult]);

  // P0-2: O(1) 状态查找
  const lookupSets = useMemo(() => {
    const errorById = new Map<string, string>();
    for (const e of aiArchiveProgress?.errors ?? []) {
      errorById.set(e.bookmarkId, e.message);
    }
    return {
      errorById,
      succeededSet: new Set(aiArchiveProgress?.succeededIds ?? []),
      skippedSet: new Set(aiArchiveProgress?.skippedIds ?? []),
      processingId: aiArchiveProgress?.processingBookmarkId ?? [],
    };
  }, [aiArchiveProgress?.errors, aiArchiveProgress?.succeededIds, aiArchiveProgress?.skippedIds, aiArchiveProgress?.processingBookmarkId]);

  // P0-3: tagPathMap 只构建一次
  const tagPathMap = useMemo(() => buildTagPathByIdMap(tags), [tags]);
  const tagNamesByBookmarkId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of queue) {
      map.set(b.id, getFlatTagDisplayNames(b.tagIds, tagPathMap));
    }
    return map;
  }, [queue, tagPathMap]);

  // P0-1: 虚拟列表（自动测量行高，避免卡片内容超出固定高度导致重叠）
  const scrollRef = useRef<HTMLDivElement>(null);
  const COLUMN_COUNT = typeof window !== 'undefined' && window.innerWidth >= 1536 ? 4 : window.innerWidth >= 1280 ? 3 : window.innerWidth >= 640 ? 2 : 1;
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(queue.length / COLUMN_COUNT),
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 440,
    overscan: 5,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const handleStop = async () => {
    await cancelArchive();
    setPhase('idle');
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
            <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
              <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                AI 智能归档
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                范围：{scopeLabel} · 本会话 {sessionStats.total} 个
                {sessionStats.pending > 0
                  ? ` · 待处理 ${sessionStats.pending}`
                  : ''}
                {sessionStats.done > 0
                  ? ` · 已完成 ${sessionStats.done}`
                  : ''}
                {sessionStats.linkDead > 0
                  ? ` · 失效 ${sessionStats.linkDead}`
                  : ''}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {settings.aiArchiveLinkCheckMode === 'off'
                  ? '已关闭归档前链接检测（推荐）：防爬站点不会被 fetch 误判挡住。'
                  : settings.aiArchiveLinkCheckMode === 'strict'
                    ? '严格模式：仅 404/410 等明确页面不存在才跳过；403/防爬等仍会继续归档。'
                    : '仅记录模式：会检测但不阻断归档，也不会因检测结果标为失效。'}
                成功项会保留在本页直至离开或刷新。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {phase === 'idle' || phase === 'completed' ? (
              <button
                type="button"
                onClick={() => void startArchive()}
                disabled={
                  pendingIds.length === 0 ||
                  isLoadingBookmarks ||
                  sessionQueueIds === null
                }
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white rounded-md text-sm"
              >
                <Play className="w-4 h-4" />
                {phase === 'completed' ? '重新归档' : '开始归档'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    isPaused ? void resumeArchive() : pauseArchive()
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm"
                >
                  {isPaused ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                  {isPaused ? '继续' : '暂停'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleStop()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm"
                >
                  <Square className="w-4 h-4" />
                  取消
                </button>
              </>
            )}
          </div>
        </div>

        {(isRunning || phase === 'completed') && aiArchiveProgress && (
          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {isRunning
                  ? isPaused
                    ? '已暂停'
                    : aiArchiveProgress.currentBookmark || '归档中'
                  : '归档完成'}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {completedCount} / {aiArchiveProgress.total}（
                {percent}%）
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ease-out ${
                  isPaused
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
            {aiArchiveProgress.currentBookmark && isRunning && (
              <p className="text-xs text-purple-600 dark:text-purple-400 truncate">
                {aiArchiveProgress.currentBookmark}
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 py-2 px-3">
                <div className="text-lg font-bold text-green-700 dark:text-green-300">
                  {aiArchiveProgress.successCount}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">
                  成功
                </div>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 py-2 px-3">
                <div className="text-lg font-bold text-red-700 dark:text-red-300">
                  {aiArchiveProgress.failureCount}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">
                  失败
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-2 px-3">
                <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                  {aiArchiveProgress.skippedCount}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  跳过
                </div>
              </div>
              <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 py-2 px-3">
                <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                  {Math.max(
                    0,
                    aiArchiveProgress.total - completedCount
                  )}
                </div>
                <div className="text-xs text-purple-600 dark:text-purple-400">
                  剩余
                </div>
              </div>
            </div>
            {isRunning && aiArchiveProgress.startTime > 0 && (
              <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  速度：{' '}
                  {formatArchiveSpeed(
                    aiArchiveProgress.startTime,
                    completedCount
                  )}
                </span>
                {aiArchiveProgress.estimatedTimeRemaining > 0 && (
                  <span>
                    预计剩余：{' '}
                    {formatArchiveEta(aiArchiveProgress.estimatedTimeRemaining)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <section className="flex-1 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
          <div className="flex-shrink-0 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white">
              归档队列（{sessionStats.total}
              {sessionStats.done > 0 ? `，${sessionStats.done} 已完成` : ''}）
            </h2>
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                disabled={isRunning}
                className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="current">当前列表顺序</option>
                <option value="createdAt">加入时间</option>
                <option value="updatedAt">更新时间</option>
                <option value="title">标题</option>
              </select>
              {sortField !== 'current' && (
                <button
                  type="button"
                  onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                  disabled={isRunning}
                  className="text-xs px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  title={sortDirection === 'asc' ? '正序' : '倒序'}
                >
                  {sortDirection === 'asc' ? '↑ 正序' : '↓ 倒序'}
                </button>
              )}
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
            {isLoadingBookmarks ? (
              <p className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                正在加载书签数据…
              </p>
            ) : sessionQueueIds === null ? (
              <p className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                正在准备归档队列…
              </p>
            ) : queue.length === 0 ? (
              <p className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                没有可归档的书签（已归档或失效的书签需重新进入本页后才会出现）
              </p>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                  const rowStart = virtualRow.index * COLUMN_COUNT;
                  const rowItems = queue.slice(rowStart, rowStart + COLUMN_COUNT);

                  return (
                    <div
                      key={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      data-index={virtualRow.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {rowItems.map((bookmark, colIndex) => {
                          const index = rowStart + colIndex;
                          const progressForPhase = {
                            isActive: !!aiArchiveProgress?.isActive,
                            processingBookmarkId: lookupSets.processingId,
                            errors: aiArchiveProgress?.errors ?? [],
                            succeededIds: lookupSets.succeededSet,
                            skippedIds: lookupSets.skippedSet,
                          };
                          const rowPhase = getAiArchiveRowPhase(bookmark, progressForPhase);
                          const errorMessage = lookupSets.errorById.get(bookmark.id);
                          const isPending = rowPhase === 'pending';

                          return (
                            <AiArchiveQueueCard
                              key={bookmark.id}
                              bookmark={bookmark}
                              phase={rowPhase}
                              categories={categories}
                              index={index}
                              errorMessage={errorMessage}
                              actionsDisabled={isRunning && rowPhase === 'processing'}
                              tagNames={tagNamesByBookmarkId.get(bookmark.id) ?? []}
                              lightweight={isRunning && isPending}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="w-full lg:w-96 flex-shrink-0 overflow-y-auto bg-gray-50 dark:bg-gray-900/30 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4" />
            归档简报
          </h2>

          {phase !== 'completed' || !lastBatchResult ? (
            <div className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
              <p>
                {isRunning
                  ? '处理完成后将在此显示统计与失败详情。'
                  : '点击「开始归档」后，进度与结果会实时更新。'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500">处理总数</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {lastBatchResult.total}
                  </div>
                </div>
                {lastBatchResult.duration != null && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500">耗时</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatArchiveDuration(lastBatchResult.duration)}
                    </div>
                  </div>
                )}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <div className="text-xs text-green-600 dark:text-green-400">
                    成功
                  </div>
                  <div className="text-xl font-bold text-green-700 dark:text-green-300">
                    {lastBatchResult.successCount}
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                  <div className="text-xs text-red-600 dark:text-red-400">
                    失败
                  </div>
                  <div className="text-xl font-bold text-red-700 dark:text-red-300">
                    {lastBatchResult.failureCount}
                  </div>
                </div>
              </div>

              {lastBatchResult.skippedCount > 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  跳过 {lastBatchResult.skippedCount} 个（已归档、链接失效或不可达）
                </p>
              )}

              {lastBatchResult.errors && lastBatchResult.errors.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-3">
                  <h3 className="text-xs font-medium text-red-700 dark:text-red-300 mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    失败详情（{lastBatchResult.errors.length}）
                  </h3>
                  <ul className="space-y-2 max-h-48 overflow-y-auto text-xs">
                    {lastBatchResult.errors.map((err, i) => (
                      <li key={i} className="text-red-600 dark:text-red-400">
                        <span className="font-medium">
                          {(err as { bookmarkTitle?: string }).bookmarkTitle ||
                            err.bookmarkId}
                        </span>
                        ：{err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  clearLastBatchResult();
                  setPhase('idle');
                }}
                className="block w-full text-center py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                清除结果
              </button>
              <Link
                to="/"
                className="block w-full text-center py-2 text-sm bg-primary text-white rounded-md hover:bg-primary-hover"
              >
                返回书签列表
              </Link>
            </div>
          )}
        </aside>
      </div>

      {isEditModalOpen && editingBookmark && (
        <BookmarkEditModal
          bookmark={editingBookmark}
          isOpen={isEditModalOpen}
          onClose={closeEditModal}
        />
      )}
    </div>
  );
};

export default AiArchivePage;
