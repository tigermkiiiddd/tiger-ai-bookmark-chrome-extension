import type { Bookmark } from '../../types/index';
function isBookmarkLike(value: unknown): value is Bookmark {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'url' in value
  );
}

/**
 * 将 storage 中的 bookmarks 规范为数组；兼容历史非数组格式
 */
export function normalizeBookmarksArray(raw: unknown): Bookmark[] {
  if (Array.isArray(raw)) {
    return raw.filter(isBookmarkLike);
  }

  if (raw && typeof raw === 'object') {
    const values = Object.values(raw as Record<string, unknown>);
    const asBookmarks = values.filter(isBookmarkLike);
    if (asBookmarks.length > 0) {
      return asBookmarks;
    }
  }

  return [];
}

/**
 * 拆分链接 status 与 AI 归档：旧数据 status=archived 迁移为 isArchived + active/dead
 */
export function normalizeBookmarkRecord(bookmark: Bookmark): Bookmark {
  const legacyStatus = bookmark.status as string;
  if (legacyStatus !== 'archived') {
    return {
      ...bookmark,
      isArchived: bookmark.isArchived ?? false
    };
  }

  const linkStatus: Bookmark['status'] =
    bookmark.linkFailureType != null ? 'dead' : 'active';

  return {
    ...bookmark,
    status: linkStatus,
    isArchived: true,
    archivedAt: bookmark.archivedAt ?? bookmark.updatedAt ?? bookmark.createdAt
  };
}

export function normalizeBookmarksArrayWithMigration(raw: unknown): Bookmark[] {
  return normalizeBookmarksArray(raw).map(normalizeBookmarkRecord);
}
