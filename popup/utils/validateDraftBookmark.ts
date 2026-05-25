import type { Bookmark } from '@/types';

export function validateDraftBookmark(bookmark: Bookmark): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!bookmark.title?.trim()) {
    errors.title = '标题不能为空';
  }

  if (!bookmark.url?.trim()) {
    errors.url = 'URL不能为空';
  } else {
    try {
      new URL(bookmark.url);
    } catch {
      errors.url = 'URL格式不正确';
    }
  }

  if (!bookmark.description?.trim()) {
    errors.description = '描述不能为空';
  }

  return errors;
}
