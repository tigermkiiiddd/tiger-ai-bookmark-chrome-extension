/**
 * 书签存储服务
 * 专门处理书签相关的存储操作
 */

import { chromeStorage } from './chrome';
import {
  normalizeBookmarksArrayWithMigration
} from './bookmarkNormalize';
import type { Bookmark, AddBookmarkData, UpdateBookmarkData, SearchQuery } from '../../types/index';
import { bookmarkMatchesStatusFilters } from '../../utils/statusFilter';
import { getRuntimeLocaleTag } from '../../i18n';

export class BookmarkStorageService {
  private static instance: BookmarkStorageService;
  private readonly STORAGE_KEY = 'bookmarks';
  private readonly CATEGORY_STATS_KEY = 'categoryStats';

  public static getInstance(): BookmarkStorageService {
    if (!BookmarkStorageService.instance) {
      BookmarkStorageService.instance = new BookmarkStorageService();
    }
    return BookmarkStorageService.instance;
  }

  private constructor() {}

  /**
   * 获取所有书签
   */
  async getBookmarks(): Promise<Bookmark[]> {
    try {
      const result = await chromeStorage.get<{ bookmarks?: unknown }>(
        this.STORAGE_KEY
      );
      const raw = result?.bookmarks;
      console.log('[bookmarkStorage] getBookmarks raw type:', typeof raw, 'isArray:', Array.isArray(raw), 'length:', Array.isArray(raw) ? raw.length : 'N/A');
      const bookmarks = normalizeBookmarksArrayWithMigration(raw);

      if (raw !== undefined && !Array.isArray(raw)) {
        await chromeStorage.set({ [this.STORAGE_KEY]: bookmarks });
        console.warn(
          '[bookmarkStorage] bookmarks 已修复为非数组存储格式'
        );
      }

      return bookmarks;
    } catch (error) {
      console.error('Failed to get bookmarks:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取书签
   */
  async getBookmarkById(id: string): Promise<Bookmark | null> {
    try {
      const bookmarks = await this.getBookmarks();
      return bookmarks.find(bookmark => bookmark.id === id) || null;
    } catch (error) {
      console.error('Failed to get bookmark by ID:', error);
      throw error;
    }
  }

  /**
   * 根据URL获取书签
   */
  async getBookmarkByUrl(url: string): Promise<Bookmark | null> {
    try {
      const bookmarks = await this.getBookmarks();
      return bookmarks.find(bookmark => bookmark.url === url) || null;
    } catch (error) {
      console.error('Failed to get bookmark by URL:', error);
      throw error;
    }
  }

  /**
   * 添加书签
   */
  async addBookmark(bookmark: Bookmark): Promise<void> {
    try {
      const bookmarks = await this.getBookmarks();
      bookmarks.push(bookmark);
      await chromeStorage.set({ [this.STORAGE_KEY]: bookmarks });
    } catch (error) {
      console.error('Failed to add bookmark:', error);
      throw error;
    }
  }

  /**
   * 更新书签
   */
  async updateBookmark(id: string, updates: UpdateBookmarkData): Promise<Bookmark> {
    try {
      const bookmarks = await this.getBookmarks();
      const index = bookmarks.findIndex(bookmark => bookmark.id === id);
      
      if (index === -1) {
        throw new Error(`Bookmark with ID ${id} not found`);
      }

      const oldBookmark = bookmarks[index];
      const updatedBookmark = {
        ...oldBookmark,
        ...updates,
        updatedAt: Date.now()
      };

      bookmarks[index] = updatedBookmark;
      await chromeStorage.set({ [this.STORAGE_KEY]: bookmarks });

      return updatedBookmark;
    } catch (error) {
      console.error('Failed to update bookmark:', error);
      throw error;
    }
  }

  /**
   * 删除书签
   */
  async deleteBookmark(id: string): Promise<void> {
    try {
      const bookmarks = await this.getBookmarks();
      const bookmark = bookmarks.find(b => b.id === id);
      
      if (!bookmark) {
        throw new Error(`Bookmark with ID ${id} not found`);
      }

      const filteredBookmarks = bookmarks.filter(b => b.id !== id);
      await chromeStorage.set({ [this.STORAGE_KEY]: filteredBookmarks });
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
      throw error;
    }
  }

  /**
   * 批量删除书签
   */
  async batchDeleteBookmarks(ids: string[]): Promise<void> {
    try {
      const bookmarks = await this.getBookmarks();
      const bookmarksToDelete = bookmarks.filter(b => ids.includes(b.id));
      
      const filteredBookmarks = bookmarks.filter(b => !ids.includes(b.id));
      await chromeStorage.set({ [this.STORAGE_KEY]: filteredBookmarks });
    } catch (error) {
      console.error('Failed to batch delete bookmarks:', error);
      throw error;
    }
  }

  /**
   * 搜索书签
   */
  async searchBookmarks(query: SearchQuery): Promise<Bookmark[]> {
    try {
      let bookmarks = await this.getBookmarks();

      // 文本搜索（storage 层无 tagId→name 映射，标签名搜索请在外层 resolve 为 tagId 后传入 filters.tags）
      if (query.query) {
        const searchTerm = query.query.toLowerCase();
        bookmarks = bookmarks.filter(bookmark =>
          bookmark.title.toLowerCase().includes(searchTerm) ||
          bookmark.url.toLowerCase().includes(searchTerm) ||
          bookmark.description?.toLowerCase().includes(searchTerm) ||
          bookmark.aiGenerated?.summary.toLowerCase().includes(searchTerm)
        );
      }

      // 标签过滤（filters.tags 应为 tagId 数组）
      if (query.filters?.tags && query.filters.tags.length > 0) {
        bookmarks = bookmarks.filter(bookmark =>
          query.filters!.tags!.some(tagId => bookmark.tagIds?.includes(tagId))
        );
      }

      // 分类过滤
      if (query.filters?.categories && query.filters.categories.length > 0) {
        bookmarks = bookmarks.filter(bookmark =>
          bookmark.categoryId && query.filters!.categories!.includes(bookmark.categoryId)
        );
      }

      // 状态过滤
      if (query.filters?.status && query.filters.status.length > 0) {
        bookmarks = bookmarks.filter(bookmark =>
          bookmarkMatchesStatusFilters(bookmark, query.filters!.status!)
        );
      }

      // 排序
      if (query.sortBy) {
        bookmarks.sort((a, b) => {
          let result = 0;
          
          switch (query.sortBy) {
            case 'createdAt':
              result = a.createdAt - b.createdAt;
              break;
            case 'updatedAt':
              result = a.updatedAt - b.updatedAt;
              break;
            case 'title':
              result = a.title.localeCompare(b.title, getRuntimeLocaleTag());
              break;
            case 'category':
              const catA = a.categoryId || '';
              const catB = b.categoryId || '';
              result = catA.localeCompare(catB, getRuntimeLocaleTag());
              break;
          }
          
          return query.sortOrder === 'desc' ? -result : result;
        });
      }

      // 分页
      if (query.limit) {
        const offset = query.offset || 0;
        bookmarks = bookmarks.slice(offset, offset + query.limit);
      }

      return bookmarks;
    } catch (error) {
      console.error('Failed to search bookmarks:', error);
      throw error;
    }
  }

  /**
   * 获取分类统计
   */
  async getCategoryStats(bookmarksOverride?: Bookmark[]): Promise<Record<string, number>> {
    try {
      const bookmarks = bookmarksOverride ?? await this.getBookmarks();
      const stats: Record<string, number> = {};
      
      bookmarks.forEach(bookmark => {
        if (bookmark.categoryId) {
          stats[bookmark.categoryId] = (stats[bookmark.categoryId] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      console.error('Failed to get category stats:', error);
      throw error;
    }
  }

  /**
   * 批量保存书签（更新已存在的）
   */
  async saveBatch(bookmarks: Bookmark[]): Promise<void> {
    try {
      const existing = await this.getBookmarks();
      const bookmarkMap = new Map(existing.map(b => [b.id, b]));
      for (const bookmark of bookmarks) {
        bookmarkMap.set(bookmark.id, bookmark);
      }
      await chromeStorage.set({ [this.STORAGE_KEY]: Array.from(bookmarkMap.values()) });
    } catch (error) {
      console.error('Failed to save batch bookmarks:', error);
      throw error;
    }
  }

  /**
   * 获取书签统计
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    tagCounts: Record<string, number>;
  }> {
    const bookmarks = await this.getBookmarks();
    const byStatus: Record<string, number> = {};
    bookmarks.forEach(b => {
      byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    });
    const tagCounts: Record<string, number> = {};
    bookmarks.forEach(b => {
      for (const tagId of b.tagIds || []) {
        tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;
      }
    });
    return { total: bookmarks.length, byStatus, tagCounts };
  }

  /**
   * 导出书签数据
   */
  async exportBookmarks(): Promise<Bookmark[]> {
    return this.getBookmarks();
  }

  /**
   * 导入书签数据
   */
  async importBookmarks(bookmarks: Bookmark[]): Promise<void> {
    try {
      await chromeStorage.set({ [this.STORAGE_KEY]: bookmarks });
    } catch (error) {
      console.error('Failed to import bookmarks:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const bookmarkStorage = BookmarkStorageService.getInstance();