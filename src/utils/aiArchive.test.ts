import { describe, expect, it } from 'vitest';
import type { Bookmark } from '../types/index';
import { getAiArchiveRowPhase } from './aiArchive';

const baseBookmark: Bookmark = {
  id: 'b1',
  title: 'Test',
  url: 'https://example.com',
  createdAt: 1,
  updatedAt: 1,
  status: 'active',
  tagIds: [],
};

describe('getAiArchiveRowPhase', () => {
  it('失败项显示 failed，即使 isArchived 为 true', () => {
    const bookmark = { ...baseBookmark, isArchived: true };
    const phase = getAiArchiveRowPhase(bookmark, {
      isActive: false,
      errors: [{ bookmarkId: 'b1' }],
    });
    expect(phase).toBe('failed');
  });

  it('本批成功项显示 success', () => {
    const phase = getAiArchiveRowPhase(baseBookmark, {
      isActive: true,
      succeededIds: ['b1'],
      errors: [],
    });
    expect(phase).toBe('success');
  });

  it('处理中项显示 processing', () => {
    const phase = getAiArchiveRowPhase(baseBookmark, {
      isActive: true,
      processingBookmarkId: 'b1',
      errors: [],
    });
    expect(phase).toBe('processing');
  });

  it('未失败且未归档时不因队列位置误判为 success', () => {
    const phase = getAiArchiveRowPhase(baseBookmark, {
      isActive: true,
      processingBookmarkId: 'b2',
      errors: [],
      succeededIds: [],
    });
    expect(phase).toBe('pending');
  });

  it('进入任务前已归档且无本批成功记录时不显示 success', () => {
    const bookmark = { ...baseBookmark, isArchived: true };
    const phase = getAiArchiveRowPhase(bookmark, {
      isActive: false,
      errors: [],
      succeededIds: [],
    });
    expect(phase).toBe('pending');
  });
});
