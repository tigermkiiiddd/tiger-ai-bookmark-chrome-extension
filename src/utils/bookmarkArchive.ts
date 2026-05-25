import type { Bookmark, UpdateBookmarkData } from '../types/index';

/** 书签是否已完成 AI 归档（与链接 status 独立） */
export function isBookmarkArchived(bookmark: Bookmark): boolean {
  if (bookmark.isArchived === true) return true;
  // 兼容旧数据：status 曾误用作归档标记
  // @ts-expect-error 旧数据中 status 可能为 'archived'
  if (bookmark.status === 'archived') return true;
  return false;
}

export function markBookmarkArchivedPatch(): Pick<
  Bookmark,
  'isArchived' | 'archivedAt'
> {
  return {
    isArchived: true,
    archivedAt: Date.now()
  };
}

export function clearBookmarkArchivedPatch(): Pick<
  Bookmark,
  'isArchived' | 'archivedAt'
> {
  return {
    isArchived: false,
    archivedAt: undefined
  };
}

/** 写回时保留归档标记，仅更新其它字段 */
export function withPreservedArchiveFlag(
  bookmark: Bookmark,
  patch: UpdateBookmarkData
): UpdateBookmarkData {
  if (!isBookmarkArchived(bookmark)) {
    return patch;
  }
  return {
    ...patch,
    isArchived: true,
    archivedAt: bookmark.archivedAt ?? patch.archivedAt
  };
}
