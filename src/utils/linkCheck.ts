import type { Bookmark, Settings } from '../types/index';
import type { LinkCheckOptions } from '../services/linkChecker/types';
import { filterBookmarksToCheck } from './bookmarkQueue';

/** 跳过检测的时间窗口：1 个月 / 6 个月 / 1 年 */
export type LinkCheckSkipPeriod = '1m' | '6m' | '1y';

export const DEFAULT_LINK_CHECK_SKIP_PERIOD: LinkCheckSkipPeriod = '1m';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const SKIP_PERIOD_MS: Record<LinkCheckSkipPeriod, number> = {
  '1m': 30 * MS_PER_DAY,
  '6m': 6 * 30 * MS_PER_DAY,
  '1y': 365 * MS_PER_DAY
};

export const DEFAULT_SKIP_MS = SKIP_PERIOD_MS[DEFAULT_LINK_CHECK_SKIP_PERIOD];

const SKIP_PERIOD_LABELS: Record<LinkCheckSkipPeriod, string> = {
  '1m': '1 个月',
  '6m': '6 个月',
  '1y': '1 年'
};

export function resolveLinkCheckSkipPeriod(settings: Settings): LinkCheckSkipPeriod {
  if (settings.linkCheckSkipPeriod) {
    return settings.linkCheckSkipPeriod;
  }
  const hours = settings.linkCheckSkipWithinHours;
  if (hours == null) return DEFAULT_LINK_CHECK_SKIP_PERIOD;
  if (hours <= 24) return '1m';
  if (hours <= 24 * 7) return '6m';
  return '1y';
}

export function getLinkCheckSkipWithinMs(settings: Settings): number {
  const period = resolveLinkCheckSkipPeriod(settings);
  return SKIP_PERIOD_MS[period];
}

export function formatLinkCheckSkipPeriod(settings: Settings): string {
  if (!isLinkCheckSkipEnabled(settings)) return '未启用';
  return SKIP_PERIOD_LABELS[resolveLinkCheckSkipPeriod(settings)];
}

export function isLinkCheckSkipEnabled(settings: Settings): boolean {
  return settings.linkCheckSkipRecently === true;
}

export function buildLinkCheckRuntimeOptions(
  settings: Settings
): Partial<LinkCheckOptions> {
  const skipRecentlyChecked = isLinkCheckSkipEnabled(settings);
  return {
    skipRecentlyChecked,
    skipWithinMs: skipRecentlyChecked
      ? getLinkCheckSkipWithinMs(settings)
      : 0,
    preserveDisplayOrder: true
  };
}

/** 按 UI 给出的 id 顺序排列书签（用于与列表显示顺序一致） */
export function orderBookmarksByIds(
  bookmarks: Bookmark[],
  orderedIds: string[]
): Bookmark[] {
  const byId = new Map(bookmarks.map(b => [b.id, b]));
  const seen = new Set<string>();
  const ordered: Bookmark[] = [];

  for (const id of orderedIds) {
    const bookmark = byId.get(id);
    if (bookmark && !seen.has(id)) {
      ordered.push(bookmark);
      seen.add(id);
    }
  }

  for (const bookmark of bookmarks) {
    if (!seen.has(bookmark.id)) {
      ordered.push(bookmark);
    }
  }

  return ordered;
}

/** 从已排序的书签列表生成待检测队列 */
export function buildLinkCheckQueue(
  displayOrderedBookmarks: Bookmark[],
  settings: Settings
): Bookmark[] {
  return filterBookmarksToCheck(displayOrderedBookmarks, {
    skipRecentlyChecked: isLinkCheckSkipEnabled(settings),
    skipWithinMs: isLinkCheckSkipEnabled(settings)
      ? getLinkCheckSkipWithinMs(settings)
      : 0
  });
}

export function formatLastLinkCheckTime(timestamp?: number): string {
  if (!timestamp) return '从未检测';
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
