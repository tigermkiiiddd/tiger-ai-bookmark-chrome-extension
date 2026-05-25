import type { Bookmark } from '../types/index';
import { isBookmarkArchived } from './bookmarkArchive';

export type AiArchiveScope = 'selected' | 'filtered' | 'all';

export interface AiArchiveLocationState {
  bookmarkIds?: string[];
  scope?: AiArchiveScope;
}

/** 本批是否需要执行 AI 归档（排除失效链接与已归档） */
export function bookmarkNeedsAiArchiveRun(bookmark: Bookmark): boolean {
  return bookmark.status !== 'dead' && !isBookmarkArchived(bookmark);
}

/** 本会话归档队列（排除失效链接与进入任务前已归档的书签） */
export function buildAiArchiveQueue(
  allBookmarks: Bookmark[],
  ids?: string[]
): Bookmark[] {
  const byId = new Map(allBookmarks.map(b => [b.id, b] as [string, Bookmark]));
  const pool = ids
    ? ids.map(id => byId.get(id)).filter((b): b is Bookmark => !!b)
    : allBookmarks;
  return pool.filter(bookmarkNeedsAiArchiveRun);
}

/** 按进入页面时冻结的 ID 列表解析会话队列（不因归档成功而从列表移除） */
export function resolveSessionQueueBookmarks(
  allBookmarks: Bookmark[],
  sessionQueueIds: string[]
): Bookmark[] {
  const byId = new Map(allBookmarks.map(b => [b.id, b]));
  return sessionQueueIds
    .map(id => byId.get(id))
    .filter((b): b is Bookmark => !!b);
}

export function countSessionQueueStats(
  queue: Bookmark[],
  batchSucceededIds?: Iterable<string>
) {
  const succeeded = batchSucceededIds
    ? new Set(batchSucceededIds)
    : null;
  const done = succeeded
    ? queue.filter(b => succeeded.has(b.id)).length
    : queue.filter(b => isBookmarkArchived(b)).length;
  const linkDead = queue.filter(b => b.status === 'dead').length;
  const pending = queue.filter(bookmarkNeedsAiArchiveRun).length;
  return { total: queue.length, done, pending, linkDead };
}

export function sortSessionQueue(
  items: Bookmark[],
  sessionQueueIds: string[],
  sortField: 'current' | 'createdAt' | 'updatedAt' | 'title',
  sortDirection: 'asc' | 'desc'
): Bookmark[] {
  if (sortField === 'current') {
    const idOrder = new Map(sessionQueueIds.map((id, i) => [id, i]));
    return [...items].sort(
      (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0)
    );
  }
  const dir = sortDirection === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    switch (sortField) {
      case 'createdAt':
        return (a.createdAt - b.createdAt) * dir;
      case 'updatedAt':
        return (
          ((a.updatedAt || a.createdAt) - (b.updatedAt || b.createdAt)) * dir
        );
      case 'title':
        return a.title.localeCompare(b.title, 'zh-CN') * dir;
      default:
        return 0;
    }
  });
}

export type AiArchiveRowPhase =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'link_dead';

export type AiArchiveProgressForPhase = {
  isActive: boolean;
  processingBookmarkId?: string | string[];
  errors: Array<{ bookmarkId: string }>;
  succeededIds?: string[] | Set<string>;
  skippedIds?: string[] | Set<string>;
};

function hasId(collection: string[] | Set<string> | undefined, id: string): boolean {
  if (!collection) return false;
  if (collection instanceof Set) return collection.has(id);
  return collection.includes(id);
}

/**
 * 行状态以本批进度为准：失败项绝不显示「已成功归档」。
 * 成功态仅来自本批 succeededIds，不用进入任务前的 isArchived。
 */
export function getAiArchiveRowPhase(
  bookmark: Bookmark,
  progress: AiArchiveProgressForPhase | null | undefined
): AiArchiveRowPhase {
  if (bookmark.status === 'dead') {
    return 'link_dead';
  }

  if (progress?.errors?.some(e => e.bookmarkId === bookmark.id)) {
    return 'failed';
  }

  const processingIds = progress?.processingBookmarkId
    ? (Array.isArray(progress.processingBookmarkId) ? progress.processingBookmarkId : [progress.processingBookmarkId])
    : [];
  if (processingIds.includes(bookmark.id) && progress?.isActive) {
    return 'processing';
  }

  if (hasId(progress?.skippedIds, bookmark.id)) {
    return 'skipped';
  }

  if (hasId(progress?.succeededIds, bookmark.id)) {
    return 'success';
  }

  return 'pending';
}

export function formatArchiveDuration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatArchiveEta(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} 分 ${remainingSeconds} 秒`;
}

export function formatArchiveSpeed(
  startTime: number,
  processed: number
): string {
  if (!startTime || processed === 0) return '计算中…';
  const elapsed = (Date.now() - startTime) / 1000;
  const perMin = (processed / elapsed) * 60;
  return `${perMin.toFixed(1)} 个/分钟`;
}
