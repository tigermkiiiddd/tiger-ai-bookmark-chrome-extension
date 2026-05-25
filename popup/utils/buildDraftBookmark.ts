import type { Bookmark, ImagePreviewKind } from '@/types';

export const DRAFT_BOOKMARK_ID = 'draft';

export interface PageSnapshotInput {
  title: string;
  url: string;
  favicon?: string;
  description?: string;
  image?: string;
  imagePreviewKind?: ImagePreviewKind;
}

export function buildDraftBookmark(
  snapshot: PageSnapshotInput,
  existing?: Bookmark | null
): Bookmark {
  const now = Date.now();

  if (existing) {
    return {
      ...existing,
      title: existing.title || snapshot.title,
      url: existing.url || snapshot.url,
      description:
        existing.description?.trim() ||
        snapshot.description?.trim() ||
        '',
      categoryId: existing.categoryId,
      imagePreviewUrl: existing.imagePreviewUrl ?? snapshot.image,
      imagePreviewKind:
        existing.imagePreviewKind ??
        (existing.imagePreviewUrl ? undefined : snapshot.imagePreviewKind),
      favicon: existing.favicon ?? snapshot.favicon,
      tagIds: existing.tagIds || [],
      notes: existing.notes ?? '',
      aiGenerated: existing.aiGenerated,
    };
  }

  return {
    id: DRAFT_BOOKMARK_ID,
    url: snapshot.url,
    title: snapshot.title || '无标题',
    description: snapshot.description ?? '',
    tagIds: [],
    categoryId: undefined,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    imagePreviewUrl: snapshot.image,
    imagePreviewKind: snapshot.imagePreviewKind,
    favicon: snapshot.favicon,
    notes: '',
  };
}

export function mapSnapshotFromContentScript(data: {
  title?: string;
  url?: string;
  favicon?: string;
  description?: string;
  image?: string;
  screenshot?: string;
}): PageSnapshotInput {
  return {
    title: data.title || '',
    url: data.url || '',
    favicon: data.favicon,
    description: data.description,
    image: data.screenshot ?? data.image,
    imagePreviewKind: data.screenshot
      ? 'page_capture'
      : data.image
        ? 'placeholder'
        : undefined,
  };
}
