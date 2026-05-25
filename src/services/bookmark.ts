/**
 * 书签管理服务
 * 提供书签的增删改查和业务逻辑
 */

import { bookmarkStorage } from '../core/storage/bookmarks';
import { tagService } from './tagService';
import { aiService } from './ai';
import type { Bookmark, AddBookmarkData, UpdateBookmarkData, SearchQuery } from '../types';
import { generateId } from '../constants';

export class BookmarkService {
  /**
   * 添加书签
   */
  async addBookmark(data: AddBookmarkData): Promise<Bookmark> {
    const bookmark: Bookmark = {
      id: generateId(),
      url: data.url,
      title: data.title,
      description: data.description || '',
      tagIds: data.tagIds || [],
      category: data.category,
      status: data.status || 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      imagePreviewUrl: data.imagePreviewUrl
    };

    // 如果启用AI分析
    if (data.useAI && data.content) {
      try {
        const existingTags = await tagService.getAllTags();
        const analysis = await aiService.analyzeContent(data.content, data.url, undefined, undefined, existingTags);
        bookmark.aiGenerated = analysis;
        const aiTagIds = await tagService.ensureTagIds(analysis.tags);
        bookmark.tagIds = [...new Set([...bookmark.tagIds, ...aiTagIds])];
        // category resolution handled at store layer
      } catch (error) {
        console.warn('AI分析失败，使用手动输入的数据:', error);
      }
    }

    await bookmarkStorage.addBookmark(bookmark);
    return bookmark;
  }

  /**
   * 更新书签
   */
  async updateBookmark(id: string, updates: UpdateBookmarkData): Promise<Bookmark> {
    const existingBookmark = await bookmarkStorage.getBookmarkById(id);
    if (!existingBookmark) {
      throw new Error(`书签不存在: ${id}`);
    }

    return await bookmarkStorage.updateBookmark(id, updates);
  }

  /**
   * 删除书签
   */
  async deleteBookmark(id: string): Promise<void> {
    await bookmarkStorage.deleteBookmark(id);
  }

  /**
   * 批量删除书签
   */
  async deleteBookmarks(ids: string[]): Promise<void> {
    await bookmarkStorage.batchDeleteBookmarks(ids);
  }

  /**
   * 获取书签
   */
  async getBookmark(id: string): Promise<Bookmark | null> {
    return await bookmarkStorage.getBookmarkById(id);
  }

  /**
   * 获取所有书签
   */
  async getAllBookmarks(): Promise<Bookmark[]> {
    return await bookmarkStorage.getBookmarks();
  }

  /**
   * 搜索书签
   */
  async searchBookmarks(query: SearchQuery): Promise<Bookmark[]> {
    return await bookmarkStorage.searchBookmarks(query);
  }

  /**
   * 获取书签统计
   */
  async getBookmarkStats() {
    return await bookmarkStorage.getStats();
  }

  /**
   * 归档书签
   */
  async archiveBookmark(id: string): Promise<Bookmark> {
    const { markBookmarkArchivedPatch } = await import('../utils/bookmarkArchive.js');
    return await this.updateBookmark(id, markBookmarkArchivedPatch());
  }

  /**
   * 批量归档书签
   */
  async archiveBookmarks(ids: string[]): Promise<void> {
    const bookmarks = await bookmarkStorage.getBookmarks();
    const updates = bookmarks
      .filter(bookmark => ids.includes(bookmark.id))
      .map(bookmark => ({
        ...bookmark,
        isArchived: true,
        archivedAt: Date.now(),
        updatedAt: Date.now()
      }));

    await bookmarkStorage.saveBatch(updates);
  }

  /**
   * 恢复书签
   */
  async restoreBookmark(id: string): Promise<Bookmark> {
    return await this.updateBookmark(id, { status: 'active' });
  }

  /**
   * 批量恢复书签
   */
  async restoreBookmarks(ids: string[]): Promise<void> {
    const bookmarks = await bookmarkStorage.getBookmarks();
    const updates = bookmarks
      .filter(bookmark => ids.includes(bookmark.id))
      .map(bookmark => ({
        ...bookmark,
        status: 'active' as const,
        updatedAt: Date.now()
      }));

    await bookmarkStorage.saveBatch(updates);
  }

  /**
   * 重新分析书签
   */
  async reanalyzeBookmark(id: string, content: string): Promise<Bookmark> {
    const bookmark = await this.getBookmark(id);
    if (!bookmark) {
      throw new Error(`书签不存在: ${id}`);
    }

    try {
      const existingTags = await tagService.getAllTags();
      const analysis = await aiService.analyzeContent(content, bookmark.url, undefined, undefined, existingTags);
      const aiTagIds = await tagService.ensureTagIds(analysis.tags);
      return await this.updateBookmark(id, {
        aiGenerated: analysis,
        tagIds: [...new Set([...(bookmark.tagIds || []), ...aiTagIds])],
        // categoryId resolved at store layer
      });
    } catch (error) {
      console.error('重新分析失败:', error);
      throw new Error('AI分析失败，请稍后重试');
    }
  }

  /**
   * 获取最近添加的书签
   */
  async getRecentBookmarks(limit: number = 10): Promise<Bookmark[]> {
    const bookmarks = await bookmarkStorage.searchBookmarks({
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit
    });
    return bookmarks;
  }

  /**
   * 获取热门标签
   */
  async getPopularTags(limit: number = 20): Promise<Array<{ tag: string; count: number }>> {
    const tagCloud = await tagService.getTagCloud(limit);
    const tagMap = new Map((await tagService.getAllTags()).map(t => [t.id, t.name]));
    return tagCloud.map(item => ({
      tag: tagMap.get(item.tagId) || item.tagId,
      count: item.count,
    }));
  }

  /**
   * 清理重复书签
   */
  async cleanDuplicateBookmarks(): Promise<{ removed: number; duplicates: Bookmark[] }> {
    const bookmarks = await bookmarkStorage.getBookmarks();
    const urlMap = new Map<string, Bookmark[]>();
    const duplicates: Bookmark[] = [];
    const toRemove: string[] = [];

    // 按URL分组
    bookmarks.forEach(bookmark => {
      if (!urlMap.has(bookmark.url)) {
        urlMap.set(bookmark.url, []);
      }
      urlMap.get(bookmark.url)!.push(bookmark);
    });

    // 找出重复项
    urlMap.forEach(bookmarkList => {
      if (bookmarkList.length > 1) {
        // 保留最新的，删除其他的
        bookmarkList.sort((a, b) => b.createdAt - a.createdAt);
        const [keep, ...remove] = bookmarkList;
        duplicates.push(...remove);
        toRemove.push(...remove.map(b => b.id));
      }
    });

    if (toRemove.length > 0) {
      await bookmarkStorage.batchDeleteBookmarks(toRemove);
    }

    return {
      removed: toRemove.length,
      duplicates
    };
  }
}

// 单例实例
export const bookmarkService = new BookmarkService();
