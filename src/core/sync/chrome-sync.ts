/**
 * Chrome书签同步服务
 * 处理与Chrome原生书签的同步操作
 */

import type { Bookmark, ChromeBookmark, ChromeSyncResult, ConflictInfo, SyncOptions } from '../../types/index';
import { bookmarkStorage } from '../storage/bookmarks';
import { settingsStorage } from '../storage/settings';

export class ChromeSyncService {
  private static instance: ChromeSyncService;

  public static getInstance(): ChromeSyncService {
    if (!ChromeSyncService.instance) {
      ChromeSyncService.instance = new ChromeSyncService();
    }
    return ChromeSyncService.instance;
  }

  private constructor() {}

  /**
   * 获取所有Chrome书签
   */
  async getAllChromeBookmarks(): Promise<ChromeBookmark[]> {
    try {
      if (!chrome.bookmarks) {
        throw new Error('Chrome bookmarks API not available');
      }

      const bookmarks = await chrome.bookmarks.getTree();
      return this.flattenBookmarkTree(bookmarks);
    } catch (error) {
      console.error('Failed to get Chrome bookmarks:', error);
      throw error;
    }
  }

  /**
   * 获取Chrome书签文件夹
   */
  async getChromeBookmarkFolders(): Promise<ChromeBookmark[]> {
    try {
      if (!chrome.bookmarks) {
        throw new Error('Chrome bookmarks API not available');
      }

      const bookmarks = await chrome.bookmarks.getTree();
      return this.extractFolders(bookmarks);
    } catch (error) {
      console.error('Failed to get Chrome bookmark folders:', error);
      throw error;
    }
  }

  /**
   * 根据文件夹ID获取书签
   */
  async getBookmarksByFolder(folderId: string): Promise<ChromeBookmark[]> {
    try {
      if (!chrome.bookmarks) {
        throw new Error('Chrome bookmarks API not available');
      }

      const children = await chrome.bookmarks.getChildren(folderId);
      return this.flattenBookmarkTree(children);
    } catch (error) {
      console.error('Failed to get bookmarks by folder:', error);
      throw error;
    }
  }

  /**
   * 导入Chrome书签
   */
  async importChromeBookmarks(
    chromeBookmarks: ChromeBookmark[],
    options: SyncOptions,
    onProgress?: (progress: { current: number; total: number; bookmark: ChromeBookmark }) => void
  ): Promise<ChromeSyncResult> {
    try {
      const result: ChromeSyncResult = {
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        conflicts: []
      };

      const existingBookmarks = await bookmarkStorage.getBookmarks();
      const urlMap = new Map(existingBookmarks.map(b => [b.url, b]));

      for (let i = 0; i < chromeBookmarks.length; i++) {
        const chromeBookmark = chromeBookmarks[i];
        
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: chromeBookmarks.length,
            bookmark: chromeBookmark
          });
        }

        try {
          // 跳过文件夹
          if (!chromeBookmark.url) {
            result.skipped++;
            continue;
          }

          const existingBookmark = urlMap.get(chromeBookmark.url);
          
          if (existingBookmark) {
            // 检查冲突
            const conflict = this.detectConflict(chromeBookmark, existingBookmark);
            if (conflict) {
              result.conflicts.push(conflict);
              result.skipped++;
              continue;
            }

            // 更新现有书签
            if (options.mergeStrategy === 'replace' || options.mergeStrategy === 'merge') {
              await this.updateBookmarkFromChrome(existingBookmark, chromeBookmark, options);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            // 创建新书签
            const newBookmark = await this.createBookmarkFromChrome(chromeBookmark, options);
            await bookmarkStorage.addBookmark(newBookmark);
            result.imported++;
          }
        } catch (error) {
          console.error(`Failed to process bookmark ${chromeBookmark.title}:`, error);
          result.errors++;
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to import Chrome bookmarks:', error);
      throw error;
    }
  }

  /**
   * 导出书签到Chrome
   */
  async exportToChrome(bookmarkIds: string[], targetFolderId?: string): Promise<{ exported: number; errors: number }> {
    try {
      const bookmarks = await bookmarkStorage.getBookmarks();
      const bookmarksToExport = bookmarks.filter(b => bookmarkIds.includes(b.id));
      
      let exported = 0;
      let errors = 0;

      for (const bookmark of bookmarksToExport) {
        try {
          await this.createChromeBookmark(bookmark, targetFolderId);
          exported++;
        } catch (error) {
          console.error(`Failed to export bookmark ${bookmark.title}:`, error);
          errors++;
        }
      }

      return { exported, errors };
    } catch (error) {
      console.error('Failed to export to Chrome:', error);
      throw error;
    }
  }

  /**
   * 双向同步
   */
  async syncBookmarks(options: SyncOptions): Promise<{
    importResult: ChromeSyncResult;
    exportResult: { exported: number; errors: number };
  }> {
    try {
      // 导入Chrome书签
      const chromeBookmarks = await this.getAllChromeBookmarks();
      const importResult = await this.importChromeBookmarks(chromeBookmarks, options);

      // 导出到Chrome
      const tigermarkBookmarks = await bookmarkStorage.getBookmarks();
      const tigermarkIds = tigermarkBookmarks
        .filter(b => !b.isSyncedFromChrome && !b.chromeBookmarkId)
        .map(b => b.id);
      
      const exportResult = await this.exportToChrome(tigermarkIds);

      return { importResult, exportResult };
    } catch (error) {
      console.error('Failed to sync bookmarks:', error);
      throw error;
    }
  }

  /**
   * 扁平化书签树结构
   */
  private flattenBookmarkTree(bookmarks: ChromeBookmark[]): ChromeBookmark[] {
    const result: ChromeBookmark[] = [];
    
    for (const bookmark of bookmarks) {
      result.push(bookmark);
      if (bookmark.children) {
        result.push(...this.flattenBookmarkTree(bookmark.children));
      }
    }
    
    return result;
  }

  /**
   * 提取文件夹
   */
  private extractFolders(bookmarks: ChromeBookmark[]): ChromeBookmark[] {
    const folders: ChromeBookmark[] = [];
    
    for (const bookmark of bookmarks) {
      if (!bookmark.url) {
        folders.push(bookmark);
        if (bookmark.children) {
          folders.push(...this.extractFolders(bookmark.children));
        }
      }
    }
    
    return folders;
  }

  /**
   * 检测冲突
   */
  private detectConflict(chromeBookmark: ChromeBookmark, existingBookmark: Bookmark): ConflictInfo | null {
    // URL冲突
    if (chromeBookmark.url === existingBookmark.url) {
      return {
        chromeBookmark,
        existingBookmark,
        reason: 'url-exists'
      };
    }

    // 标题相似冲突
    const similarity = this.calculateSimilarity(chromeBookmark.title, existingBookmark.title);
    if (similarity > 0.8) {
      return {
        chromeBookmark,
        existingBookmark,
        reason: 'title-similar'
      };
    }

    return null;
  }

  /**
   * 计算字符串相似度
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 计算编辑距离
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * 从Chrome书签创建TIGERMARK书签
   */
  private async createBookmarkFromChrome(
    chromeBookmark: ChromeBookmark, 
    options: SyncOptions
  ): Promise<Bookmark> {
    const now = Date.now();
    
    const bookmark: Bookmark = {
      id: `bookmark_${now}_${Math.random().toString(36).substr(2, 9)}`,
      url: chromeBookmark.url!,
      title: chromeBookmark.title,
      description: '',
      tagIds: [],
      category: undefined,
      status: 'active',
      createdAt: chromeBookmark.dateAdded || now,
      updatedAt: now,
      chromeBookmarkId: chromeBookmark.id,
      isSyncedFromChrome: true,
      lastSyncAt: now
    };

    // 如果启用AI分析
    if (options.enableAIAnalysis) {
      try {
        // 这里可以调用AI分析服务
        // const aiResult = await aiService.analyzeContent(bookmark.url);
        // bookmark.aiGenerated = aiResult;
        // bookmark.tags = aiResult.tags;
        // bookmark.category = aiResult.category;
      } catch (error) {
        console.warn('AI analysis failed during import:', error);
      }
    }

    return bookmark;
  }

  /**
   * 从Chrome书签更新现有书签
   */
  private async updateBookmarkFromChrome(
    existingBookmark: Bookmark,
    chromeBookmark: ChromeBookmark,
    options: SyncOptions
  ): Promise<void> {
    const updates: Partial<Bookmark> = {
      title: chromeBookmark.title,
      updatedAt: Date.now(),
      lastSyncAt: Date.now()
    };

    if (options.mergeStrategy === 'replace') {
      updates.description = '';
      updates.tagIds = [];
      updates.categoryId = undefined;
    }

    await bookmarkStorage.updateBookmark(existingBookmark.id, updates);
  }

  /**
   * 在Chrome中创建书签
   */
  private async createChromeBookmark(bookmark: Bookmark, parentId?: string): Promise<void> {
    if (!chrome.bookmarks) {
      throw new Error('Chrome bookmarks API not available');
    }

    const chromeBookmark = await chrome.bookmarks.create({
      title: bookmark.title,
      url: bookmark.url,
      parentId: parentId
    });

    // 更新书签的Chrome ID
    await bookmarkStorage.updateBookmark(bookmark.id, {
      chromeBookmarkId: chromeBookmark.id,
      isSyncedFromChrome: true,
      lastSyncAt: Date.now()
    });
  }
}

// 导出单例实例
export const chromeSyncService = ChromeSyncService.getInstance();

