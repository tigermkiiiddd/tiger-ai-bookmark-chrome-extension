import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageState } from '../hooks/usePageState';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  Lightbulb,
  Loader2,
  ListChecks,
  FileText
} from 'lucide-react';
import { useBookmarkStore } from '../store/index';
import { extractDomain } from '../utils/url';
import {
  buildLinkCheckQueue,
  buildLinkCheckRuntimeOptions,
  DEFAULT_LINK_CHECK_SKIP_PERIOD,
  formatLastLinkCheckTime,
  formatLinkCheckSkipPeriod,
  isLinkCheckSkipEnabled,
  type LinkCheckSkipPeriod
} from '../utils/linkCheck';
import {
  getEffectiveLastLinkCheckedAt,
  isBookmarkSkippedByRecentCheck
} from '../utils/bookmarkQueue';
import type {
  Bookmark,
  CheckProgress,
  LinkCheckResult,
  Settings
} from '../types/index';
import type { CheckReport } from '../services/linkChecker/types';

const CHECK_OPTIONS_BASE = {
  maxConcurrent: 10,
  timeout: 10000,
  retryAttempts: 2,
  useMultipleStrategies: true
};

type RowPhase = 'pending' | 'checking' | 'done' | 'skipped';

function getRowPhase(
  bookmark: Bookmark,
  currentUrl: string | undefined,
  resultByBookmarkId: Map<string, LinkCheckResult>,
  isRunning: boolean,
  settings: Settings
): RowPhase {
  if (resultByBookmarkId.has(bookmark.id)) return 'done';
  if (isRunning && currentUrl === bookmark.url) return 'checking';
  if (isBookmarkSkippedByRecentCheck(bookmark, settings)) return 'skipped';
  return 'pending';
}

function formatStoredCheckTime(bookmark: Bookmark): string {
  const ts = getEffectiveLastLinkCheckedAt(bookmark);
  if (!ts) return '';
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function resultLabel(result: LinkCheckResult): string {
  if (result.status === 'active') return '正常';
  if (result.failureType === 'site_dead') return '站点失效';
  if (result.failureType === 'page_dead') return '页面失效';
  if (result.status === 'dead') return '失效';
  if (result.status === 'timeout') return '超时';
  return '未知';
}

const LinkCheckPage: React.FC = () => {
  usePageState();
  const {
    bookmarks,
    loadBookmarks,
    settings,
    updateSettings,
    getFilteredBookmarks,
    searchQuery,
    activeFilters,
    sortBy,
    sortOrder,
    categories
  } = useBookmarkStore();

  const [phase, setPhase] = useState<'idle' | 'running' | 'completed' | 'error'>(
    'idle'
  );
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<CheckProgress | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [allResults, setAllResults] = useState<LinkCheckResult[]>([]);
  const [report, setReport] = useState<CheckReport | null>(null);

  const checkRuntimeOptions = useMemo(
    () => ({
      ...CHECK_OPTIONS_BASE,
      ...buildLinkCheckRuntimeOptions(settings)
    }),
    [settings]
  );

  const filteredForCheck = useMemo(
    () => getFilteredBookmarks(),
    [bookmarks, searchQuery, activeFilters, sortBy, sortOrder, categories]
  );

  const queue = useMemo(
    () => buildLinkCheckQueue(filteredForCheck, settings),
    [filteredForCheck, settings]
  );

  const totalCheckable = useMemo(
    () => filteredForCheck.filter(b => !b.isArchived && (b.status as string) !== 'archived').length,
    [filteredForCheck]
  );

  const skippedCount = useMemo(
    () =>
      isLinkCheckSkipEnabled(settings)
        ? filteredForCheck.filter(b =>
            isBookmarkSkippedByRecentCheck(b, settings)
          ).length
        : 0,
    [filteredForCheck, settings]
  );

  const resultByBookmarkId = useMemo(() => {
    const map = new Map<string, LinkCheckResult>();
    for (const r of allResults) {
      if (r.bookmarkId) map.set(r.bookmarkId, r);
    }
    return map;
  }, [allResults]);

  const pollProgress = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_LINK_CHECK_PROGRESS'
      });
      if (!response?.success || !response.data) return;

      const data = response.data;
      setProgress(data.progress ?? null);
      setCurrentUrl(data.currentUrl ?? '');
      setAllResults(Array.isArray(data.allResults) ? data.allResults : []);

      const status = data.progress?.status;
      if (status === 'running' || status === 'paused') {
        setPhase('running');
        setIsPaused(status === 'paused');
      } else if (status === 'completed') {
        setPhase('completed');
        setIsPaused(false);
        if (data.report) {
          setReport(data.report);
          void updateSettings({ lastLinkCheckAt: Date.now() });
        }
        void loadBookmarks();
      } else if (status === 'error') {
        setPhase('error');
      }
    } catch (error) {
      console.error('获取检测进度失败:', error);
    }
  }, [loadBookmarks]);

  useEffect(() => {
    void pollProgress();
  }, [pollProgress]);

  useEffect(() => {
    if (phase !== 'running') return;
    const interval = setInterval(() => void pollProgress(), 500);
    return () => clearInterval(interval);
  }, [phase, pollProgress]);

  const startCheck = useCallback(async () => {
    setReport(null);
    setAllResults([]);
    setPhase('running');
    setIsPaused(false);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'BATCH_CHECK_LINKS',
        payload: {
          bookmarkIds: queue.map(b => b.id),
          options: checkRuntimeOptions
        }
      });

      if (!response?.success) {
        const message = response?.error || '启动检测失败';
        console.error('BATCH_CHECK_LINKS 失败:', message);
        alert(message);
        setPhase('idle');
        return;
      }

      const started = response.data?.started;
      if (!started) {
        const message = response.data?.message || '没有需要检查的书签';
        alert(message);
        setPhase('idle');
        return;
      }

      void pollProgress();
    } catch (error) {
      console.error('启动检测失败:', error);
      setPhase('error');
    }
  }, [queue, pollProgress, checkRuntimeOptions]);

  const handlePause = async () => {
    setIsPaused(true);
    await chrome.runtime.sendMessage({ type: 'PAUSE_LINK_CHECK' });
  };

  const handleResume = async () => {
    setIsPaused(false);
    await chrome.runtime.sendMessage({ type: 'RESUME_LINK_CHECK' });
  };

  const handleStop = async () => {
    await chrome.runtime.sendMessage({ type: 'STOP_LINK_CHECK' });
    setPhase('idle');
    setIsPaused(false);
    void pollProgress();
  };

  const percent =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  const isRunning = phase === 'running';

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
              <ListChecks className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                链接检测
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                待检 {queue.length} / 共 {totalCheckable} 个 URL
                {phase === 'completed' && report
                  ? ` · 耗时 ${formatDuration(report.duration)}`
                  : ''}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                上次全量检测：{formatLastLinkCheckTime(settings.lastLinkCheckAt)}
                {' · '}
                跳过规则：{formatLinkCheckSkipPeriod(settings)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {phase === 'idle' || phase === 'completed' || phase === 'error' ? (
              <button
                type="button"
                onClick={() => void startCheck()}
                disabled={queue.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-md text-sm"
              >
                <Play className="w-4 h-4" />
                {phase === 'completed' ? '重新检测' : '开始检测'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => (isPaused ? void handleResume() : void handlePause())}
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
                  停止
                </button>
              </>
            )}
            <Link
              to="/broken-links"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <FileText className="w-4 h-4" />
              管理失效书签
            </Link>
          </div>
        </div>

        {(phase === 'idle' || phase === 'completed' || phase === 'error') && (
          <div className="mt-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 space-y-3">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
              跳过近期已检测（可选，检测前可改）
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isLinkCheckSkipEnabled(settings)}
                disabled={isRunning}
                onChange={e =>
                  void updateSettings({
                    linkCheckSkipRecently: e.target.checked
                  })
                }
                className="rounded border-gray-300"
              />
              启用跳过：在时间窗口内已检测过的书签不重复检测
            </label>
            {isLinkCheckSkipEnabled(settings) ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  时间窗口：
                </span>
                <select
                  value={
                    settings.linkCheckSkipPeriod ?? DEFAULT_LINK_CHECK_SKIP_PERIOD
                  }
                  disabled={isRunning}
                  onChange={e =>
                    void updateSettings({
                      linkCheckSkipPeriod: e.target.value as LinkCheckSkipPeriod
                    })
                  }
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="1m">1 个月</option>
                  <option value="6m">6 个月</option>
                  <option value="1y">1 年</option>
                </select>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  将跳过 {skippedCount} 个近期已检书签
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                未启用：本次将检测全部 {totalCheckable} 个书签（与设置页默认一致）。
              </p>
            )}
          </div>
        )}

        {(isRunning || phase === 'completed') && progress && (
          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {isRunning
                  ? isPaused
                    ? '已暂停'
                    : currentUrl
                      ? '正在检测'
                      : '检测中'
                  : '检测完成'}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {progress.completed} / {progress.total}（{percent}%）
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            {currentUrl && isRunning && (
              <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                {currentUrl}
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 py-2 px-3">
                <div className="text-lg font-bold text-green-700 dark:text-green-300">
                  {progress.active}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">正常</div>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 py-2 px-3">
                <div className="text-lg font-bold text-red-700 dark:text-red-300">
                  {progress.dead}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">失效</div>
              </div>
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 py-2 px-3">
                <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                  {progress.errors}
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400">
                  异常/超时
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 py-2 px-3">
                <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  {progress.total - progress.completed}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">待检</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <section className="flex-1 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
          <div className="flex-shrink-0 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white">
              全部 URL（{totalCheckable}）
            </h2>
            {isRunning && (
              <RefreshCw className="w-4 h-4 text-primary animate-spin" />
            )}
          </div>
          <ul className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/80">
            {totalCheckable === 0 ? (
              <li className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                没有可检测的书签（已归档的不显示）
              </li>
            ) : (
              filteredForCheck
                .filter(b => !b.isArchived && (b.status as string) !== 'archived')
                .map(bookmark => {
                const rowPhase = getRowPhase(
                  bookmark,
                  currentUrl,
                  resultByBookmarkId,
                  isRunning && !isPaused,
                  settings
                );
                const result = resultByBookmarkId.get(bookmark.id);
                const domain = extractDomain(bookmark.url);

                return (
                  <li
                    key={bookmark.id}
                    className={`flex items-start gap-3 px-4 py-2.5 text-sm ${
                      rowPhase === 'checking'
                        ? 'bg-blue-50/80 dark:bg-blue-900/20'
                        : ''
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {rowPhase === 'checking' && (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                      )}
                      {rowPhase === 'done' && result?.status === 'active' && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {rowPhase === 'done' &&
                        result &&
                        result.status !== 'active' && (
                          <XCircle
                            className={`w-4 h-4 ${
                              result.failureType === 'site_dead'
                                ? 'text-orange-500'
                                : 'text-red-500'
                            }`}
                          />
                        )}
                      {rowPhase === 'skipped' && (
                        <CheckCircle className="w-4 h-4 text-gray-400" />
                      )}
                      {rowPhase === 'pending' && (
                        <Clock className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {bookmark.title || domain}
                      </div>
                      <div className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate">
                        {bookmark.url}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {rowPhase === 'skipped' && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          <span>已检跳过</span>
                          {formatStoredCheckTime(bookmark) ? (
                            <span className="block mt-0.5">
                              {formatStoredCheckTime(bookmark)}
                            </span>
                          ) : null}
                        </div>
                      )}
                      {rowPhase === 'pending' && (
                        <span className="text-xs text-gray-400">待检</span>
                      )}
                      {rowPhase === 'checking' && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          检测中
                        </span>
                      )}
                      {rowPhase === 'done' && result && (
                        <div className="text-xs">
                          <span
                            className={
                              result.status === 'active'
                                ? 'text-green-600 dark:text-green-400'
                                : result.failureType === 'site_dead'
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-red-600 dark:text-red-400'
                            }
                          >
                            {resultLabel(result)}
                          </span>
                          {result.responseTime != null && (
                            <span className="block text-gray-400 mt-0.5">
                              {result.responseTime}ms
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <aside className="w-full lg:w-96 flex-shrink-0 overflow-y-auto bg-gray-50 dark:bg-gray-900/30 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4" />
            检测简报
          </h2>

          {phase !== 'completed' || !report ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isRunning
                ? '检测完成后将在此显示整理结果与建议。'
                : '点击「开始检测」后，进度与简报会实时更新。'}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500">检测总数</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {report.totalChecked}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500">耗时</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatDuration(report.duration)}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <div className="text-xs text-green-600 dark:text-green-400">正常</div>
                  <div className="text-xl font-bold text-green-700 dark:text-green-300">
                    {report.activeLinks}
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                  <div className="text-xs text-red-600 dark:text-red-400">失效合计</div>
                  <div className="text-xl font-bold text-red-700 dark:text-red-300">
                    {report.deadLinks}
                  </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                  <div className="text-xs text-orange-600 dark:text-orange-400">
                    站点失效
                  </div>
                  <div className="text-xl font-bold text-orange-700 dark:text-orange-300">
                    {report.siteDeadLinks}
                  </div>
                </div>
                <div className="bg-red-50/80 dark:bg-red-900/10 rounded-lg p-3 border border-red-200 dark:border-red-800">
                  <div className="text-xs text-red-600 dark:text-red-400">页面失效</div>
                  <div className="text-xl font-bold text-red-700 dark:text-red-300">
                    {report.pageDeadLinks}
                  </div>
                </div>
              </div>

              {report.domainAnalysis.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <h3 className="text-xs font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    域名概览
                  </h3>
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                    {report.domainAnalysis
                      .filter(d => d.dead > 0)
                      .sort((a, b) => b.dead - a.dead)
                      .slice(0, 12)
                      .map(d => (
                        <li
                          key={d.domain}
                          className="flex justify-between text-gray-600 dark:text-gray-400"
                        >
                          <span className="truncate pr-2">{d.domain}</span>
                          <span className="text-red-600 dark:text-red-400 flex-shrink-0">
                            {d.dead} 失效 / {d.total}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {report.suggestions.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <h3 className="text-xs font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5" />
                    建议
                  </h3>
                  <ul className="space-y-2 text-xs">
                    {report.suggestions.map((s, i) => (
                      <li
                        key={i}
                        className={`p-2 rounded ${
                          s.priority === 'high'
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                            : s.priority === 'medium'
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
                              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
                        }`}
                      >
                        {s.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Link
                to="/broken-links"
                className="block w-full text-center py-2 text-sm bg-primary text-white rounded-md hover:bg-primary-hover"
              >
                前往处理失效书签
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default LinkCheckPage;
