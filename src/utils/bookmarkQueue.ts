import type { Bookmark, Settings } from '../types/index';
import { isBookmarkArchived } from './bookmarkArchive';
import {
  DEFAULT_SKIP_MS,
  getLinkCheckSkipWithinMs,
  isLinkCheckSkipEnabled
} from './linkCheck';

/** 用于跳过逻辑的有效检测时间（不把「无记录」误判为未检测） */
export function getEffectiveLastLinkCheckedAt(
  bookmark: Bookmark
): number | undefined {
  if (bookmark.lastLinkCheckedAt != null) {
    return bookmark.lastLinkCheckedAt;
  }
  if (bookmark.linkCheckRecorded) {
    return bookmark.updatedAt;
  }
  return undefined;
}

export interface FilterBookmarksToCheckOptions {
  skipRecentlyChecked: boolean;
  /** 在此时间窗口内已检测过的书签跳过；默认 24 小时 */
  skipWithinMs?: number;
}

/** 计算待检测书签队列（与 LinkCheckEngine 规则一致，供 UI 展示） */
export function filterBookmarksToCheck(
  bookmarks: Bookmark[],
  options: boolean | FilterBookmarksToCheckOptions
): Bookmark[] {
  const opts: FilterBookmarksToCheckOptions =
    typeof options === 'boolean'
      ? { skipRecentlyChecked: options }
      : options;

  let toCheck = bookmarks.filter(bookmark => !isBookmarkArchived(bookmark));

  if (opts.skipRecentlyChecked) {
    const skipWithinMs = opts.skipWithinMs ?? DEFAULT_SKIP_MS;
    const cutoff = Date.now() - skipWithinMs;
    toCheck = toCheck.filter(bookmark => {
      const lastChecked = getEffectiveLastLinkCheckedAt(bookmark);
      if (lastChecked == null) return true;
      return lastChecked < cutoff;
    });
  }

  return toCheck;
}

/** 是否在跳过窗口内视为「近期已检测」（用于列表展示，非待检队列） */
export function isBookmarkSkippedByRecentCheck(
  bookmark: Bookmark,
  settings: Settings
): boolean {
  if (!isLinkCheckSkipEnabled(settings)) return false;
  const lastChecked = getEffectiveLastLinkCheckedAt(bookmark);
  if (lastChecked == null) return false;
  const cutoff = Date.now() - getLinkCheckSkipWithinMs(settings);
  return lastChecked >= cutoff;
}
