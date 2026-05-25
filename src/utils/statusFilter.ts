import type { Bookmark, StatusFilterValue } from '../types/index';
import { isBookmarkArchived } from './bookmarkArchive';

export function getBookmarkStatusFilterKey(bookmark: Bookmark): StatusFilterValue {
  if (isBookmarkArchived(bookmark)) return 'archived';
  if (bookmark.status === 'active') return 'active';
  if (bookmark.linkFailureType === 'site_dead') return 'site_dead';
  if (bookmark.linkFailureType === 'page_dead') return 'page_dead';
  if (bookmark.status === 'dead') return 'page_dead';
  return 'active';
}

export function bookmarkMatchesStatusFilters(
  bookmark: Bookmark,
  filters: StatusFilterValue[] | string[]
): boolean {
  if (!filters.length) return true;

  return filters.some(filter => {
    switch (filter as StatusFilterValue) {
      case 'unarchived':
        return !isBookmarkArchived(bookmark);
      case 'active':
        return bookmark.status === 'active' && !isBookmarkArchived(bookmark);
      case 'archived':
        return isBookmarkArchived(bookmark);
      case 'dead':
        return bookmark.status === 'dead';
      case 'site_dead':
        return (
          bookmark.status === 'dead' &&
          bookmark.linkFailureType === 'site_dead'
        );
      case 'page_dead':
        return (
          bookmark.status === 'dead' &&
          (bookmark.linkFailureType === 'page_dead' || !bookmark.linkFailureType)
        );
      default:
        return bookmark.status === filter;
    }
  });
}

export const STATUS_FILTER_LABELS: Record<StatusFilterValue, string> = {
  unarchived: '未归档',
  active: '正常',
  archived: '已归档',
  dead: '失效',
  site_dead: '站点失效',
  page_dead: '页面失效'
};
