import { bookmarkStorage } from '../core/storage/bookmarks.js';
import { settingsStorage } from '../core/storage/settings.js';
import {
  checkBookmark,
  toDetectionOptions
} from '../services/linkChecker/bookmarkChecker.js';
import { mergeLinkCheckOptions } from '../services/linkChecker/constants.js';
import { applyFailureTypeToResult } from '../services/linkChecker/failureClassifier.js';
import { saveCheckResultToBookmarks } from '../services/linkChecker/persistence.js';
import type {
  AiArchiveLinkCheckMode,
  Bookmark,
  EnhancedLinkCheckResult,
  Settings
} from '../types/index.js';
import { LinkStatus } from '../types/index.js';
import { isBookmarkSkippedByRecentCheck } from './bookmarkQueue.js';
import { buildLinkCheckRuntimeOptions } from './linkCheck.js';

export class BookmarkUnreachableError extends Error {
  readonly checkResult?: EnhancedLinkCheckResult;

  constructor(message: string, checkResult?: EnhancedLinkCheckResult) {
    super(message);
    this.name = 'BookmarkUnreachableError';
    this.checkResult = checkResult;
  }
}

function resolveArchiveLinkCheckMode(settings: Settings): AiArchiveLinkCheckMode {
  return settings.aiArchiveLinkCheckMode ?? 'off';
}

function formatCheckFailureLabel(result: EnhancedLinkCheckResult): string {
  if (result.failureType === 'site_dead') return '站点失效';
  if (result.failureType === 'page_dead') return '页面失效';
  if (result.status === LinkStatus.TIMEOUT) return '连接超时';
  if (result.status === LinkStatus.BLOCKED) return '访问被阻止(可能防爬)';
  if (result.status === LinkStatus.UNKNOWN) return '无法确认';
  if (result.status === LinkStatus.DEAD) return '链接失效';
  return result.error || '不可用';
}

function isClearlyReachable(result: EnhancedLinkCheckResult): boolean {
  return result.status === LinkStatus.ACTIVE || result.status === LinkStatus.REDIRECT;
}

/**
 * AI 归档前校验链接可达性。
 * 扩展内 fetch 检测无法模拟真实浏览器，防爬站点易误判；默认不阻断归档。
 */
export async function assertBookmarkReachableBeforeArchive(
  bookmark: Bookmark,
  settings?: Settings
): Promise<void> {
  const resolvedSettings = settings ?? (await settingsStorage.getSettings());
  const mode = resolveArchiveLinkCheckMode(resolvedSettings);

  if (mode === 'off') {
    return;
  }

  const skipFreshCheck =
    bookmark.status !== 'dead' &&
    bookmark.status === 'active' &&
    !bookmark.linkFailureType &&
    isBookmarkSkippedByRecentCheck(bookmark, resolvedSettings);

  if (skipFreshCheck) {
    return;
  }

  const checkOptions = mergeLinkCheckOptions({
    ...buildLinkCheckRuntimeOptions(resolvedSettings),
    skipRecentlyChecked: false
  });

  let result = await checkBookmark(
    bookmark,
    toDetectionOptions(checkOptions),
    checkOptions
  );
  result = applyFailureTypeToResult(result);

  if (mode === 'lenient') {
    await bookmarkStorage.updateBookmark(bookmark.id, {
      lastLinkCheckedAt: Date.now(),
      linkCheckRecorded: true
    });
    if (!isClearlyReachable(result)) {
      console.warn(
        `[aiArchive] 自动链接检测未确认可达（${formatCheckFailureLabel(result)}），可能为防爬误判，仍继续归档:`,
        bookmark.url
      );
    }
    return;
  }

  // strict：仍可能误判，仅建议在明确 404/410 时信任
  if (isClearlyReachable(result)) {
    await saveCheckResultToBookmarks(result);
    return;
  }

  const isConfirmedPageGone =
    result.status === LinkStatus.DEAD &&
    result.failureType === 'page_dead' &&
    (result.statusCode === 404 || result.statusCode === 410);

  if (isConfirmedPageGone) {
    await saveCheckResultToBookmarks(result);
    const label = formatCheckFailureLabel(result);
    throw new BookmarkUnreachableError(
      `链接不可用（${label}），已跳过 AI 归档：${bookmark.title || bookmark.url}`,
      result
    );
  }

  await bookmarkStorage.updateBookmark(bookmark.id, {
    lastLinkCheckedAt: Date.now(),
    linkCheckRecorded: true
  });
  console.warn(
    `[aiArchive] 严格模式：检测为 ${formatCheckFailureLabel(result)}，但未确认为页面删除，仍继续归档（可能防爬）:`,
    bookmark.url
  );
}

/** 归档流程入口：按 id 加载书签并做连通性校验 */
export async function assertBookmarkReachableBeforeArchiveById(
  bookmarkId: string,
  settings?: Settings
): Promise<Bookmark> {
  let bookmark = await bookmarkStorage.getBookmarkById(bookmarkId);
  if (!bookmark) {
    throw new Error(`书签不存在: ${bookmarkId}`);
  }

  const resolvedSettings = settings ?? (await settingsStorage.getSettings());
  const mode = resolveArchiveLinkCheckMode(resolvedSettings);

  await assertBookmarkReachableBeforeArchive(bookmark, resolvedSettings);

  bookmark = await bookmarkStorage.getBookmarkById(bookmarkId);
  if (!bookmark) {
    throw new Error(`书签不存在: ${bookmarkId}`);
  }

  if (mode === 'strict' && bookmark.status === 'dead' && bookmark.linkFailureType === 'page_dead') {
    throw new BookmarkUnreachableError(
      `链接已标记为页面失效，跳过 AI 归档：${bookmark.title || bookmark.url}`
    );
  }

  return bookmark;
}
