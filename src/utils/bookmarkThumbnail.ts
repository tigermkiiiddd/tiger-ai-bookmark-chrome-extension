import type { Bookmark, ImagePreviewKind } from '../types/index.js';

const GOOGLE_FAVICON_PREFIX = 'https://www.google.com/s2/favicons';

/**
 * 旧书签无 imagePreviewKind 时，用 URL 特征猜测是否为占位图（非视觉识别 logo）。
 */
export function guessPreviewKindFromUrl(
  imagePreviewUrl: string | undefined,
  bookmark?: Pick<Bookmark, 'url' | 'favicon'>
): ImagePreviewKind | undefined {
  const url = imagePreviewUrl?.trim();
  if (!url) return undefined;

  if (url.startsWith(GOOGLE_FAVICON_PREFIX)) return 'placeholder';
  if (bookmark?.favicon && url === bookmark.favicon.trim()) return 'placeholder';
  if (url.startsWith('http://') || url.startsWith('https://')) return 'placeholder';
  if (url.startsWith('data:image') && url.length < 24_000) return 'placeholder';
  if (url.startsWith('data:image')) return 'page_capture';

  return undefined;
}

export function resolveImagePreviewKind(bookmark: Bookmark): ImagePreviewKind | undefined {
  if (bookmark.imagePreviewKind) {
    return bookmark.imagePreviewKind;
  }
  return guessPreviewKindFromUrl(bookmark.imagePreviewUrl, bookmark);
}

/** 是否为占位预览（favicon / og），需要打开网页整页截图 */
export function isPlaceholderPreview(bookmark: Bookmark): boolean {
  if (!bookmark.imagePreviewUrl?.trim()) return true;
  const kind = resolveImagePreviewKind(bookmark);
  if (kind === 'page_capture') return false;
  if (kind === 'placeholder') return true;
  return true;
}

/** 是否应打开目标页做整页截图 */
export function bookmarkNeedsPageScreenshot(bookmark: Bookmark): boolean {
  return isPlaceholderPreview(bookmark);
}

export const PAGE_CAPTURE_PREVIEW_PATCH = {
  imagePreviewKind: 'page_capture' as const,
};
