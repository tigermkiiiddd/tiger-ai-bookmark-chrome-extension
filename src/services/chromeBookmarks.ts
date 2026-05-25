// Chrome书签导入和同步服务
import { chromeStorage } from '../core/storage/chrome';
import type {
  ChromeBookmarkNode,
  Bookmark,
  BookmarkSyncResult,
  BookmarkConflict,
  SyncOptions
} from '../types/index';

export class ChromeBookmarkService {
  private static instance: ChromeBookmarkService;

  public static getInstance(): ChromeBookmarkService {
    if (!ChromeBookmarkService.instance) {
      ChromeBookmarkService.instance = new ChromeBookmarkService();
    }
    return ChromeBookmarkService.instance;
  }

  /**
   * 获取Chrome书签树
   */
  async getChromeBookmarks(): Promise<ChromeBookmarkNode[]> {
    if (!chrome.bookmarks) {
      throw new Error('Chrome书签API不可用');
    }

    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      return bookmarkTree;
    } catch (error) {
      console.error('获取Chrome书签失败:', error);
      throw new Error('无法获取Chrome书签');
    }
  }

  /**
   * 获取所有书签URL（递归遍历）
   */
  async getAllChromeBookmarkUrls(): Promise<ChromeBookmarkNode[]> {
    const tree = await this.getChromeBookmarks();
    const bookmarks: ChromeBookmarkNode[] = [];

    const traverse = (nodes: ChromeBookmarkNode[]) => {
      for (const node of nodes) {
        if (node.url) {
          // 这是一个书签
          bookmarks.push(node);
        } else if (node.children) {
          // 这是一个文件夹，递归遍历
          traverse(node.children);
        }
      }
    };

    traverse(tree);
    return bookmarks;
  }

  /**
   * 根据文件夹ID获取书签
   */
  async getBookmarksByFolder(folderId: string): Promise<ChromeBookmarkNode[]> {
    if (!chrome.bookmarks) {
      throw new Error('Chrome书签API不可用');
    }

    try {
      const children = await chrome.bookmarks.getChildren(folderId);
      const bookmarks: ChromeBookmarkNode[] = [];

      for (const child of children) {
        if (child.url) {
          bookmarks.push(child);
        } else if (child.children) {
          // 递归获取子文件夹的书签
          const subBookmarks = await this.getBookmarksByFolder(child.id);
          bookmarks.push(...subBookmarks);
        }
      }

      return bookmarks;
    } catch (error) {
      console.error('获取文件夹书签失败:', error);
      throw new Error(`无法获取文件夹 ${folderId} 的书签`);
    }
  }

  /**
   * 获取Chrome书签文件夹结构
   */
  async getBookmarkFolders(): Promise<ChromeBookmarkNode[]> {
    const tree = await this.getChromeBookmarks();
    const folders: ChromeBookmarkNode[] = [];

    const traverse = (nodes: ChromeBookmarkNode[], depth = 0) => {
      for (const node of nodes) {
        if (!node.url && node.children) {
          // 这是一个文件夹
          folders.push({
            ...node,
            title: `${'  '.repeat(depth)}${node.title}` // 添加缩进显示层级
          });
          traverse(node.children, depth + 1);
        }
      }
    };

    traverse(tree);
    return folders;
  }

  /**
   * 将Chrome书签转换为TIGERMARK书签格式
   */
  convertChromeBookmarkToTigermark(chromeBookmark: ChromeBookmarkNode): Omit<Bookmark, 'id'> {
    const now = Date.now();
    
    return {
      url: chromeBookmark.url || '',
      title: chromeBookmark.title || 'Untitled',
      description: '', // Chrome书签没有描述字段
      tagIds: [], // 初始化为空，后续可以通过AI分析添加
      category: undefined, // 可以根据Chrome文件夹结构映射
      createdAt: chromeBookmark.dateAdded || now,
      updatedAt: chromeBookmark.dateGroupModified || chromeBookmark.dateAdded || now,
      status: 'active' as const,
      chromeBookmarkId: chromeBookmark.id,
      isSyncedFromChrome: true,
      lastSyncAt: now
    };
  }

  /**
   * 检测书签冲突
   */
  async detectConflicts(
    chromeBookmarks: ChromeBookmarkNode[], 
    existingBookmarks: Bookmark[] | null
  ): Promise<BookmarkConflict[]> {
    const conflicts: BookmarkConflict[] = [];
    
    // 处理空值情况
    if (!existingBookmarks || existingBookmarks.length === 0) {
      return conflicts;
    }
    
    const existingUrls = new Set(existingBookmarks.map(b => b.url.toLowerCase()));
    const existingTitles = new Map(existingBookmarks.map(b => [b.title.toLowerCase(), b]));

    for (const chromeBookmark of chromeBookmarks) {
      if (!chromeBookmark.url) continue;

      const url = chromeBookmark.url.toLowerCase();
      const title = chromeBookmark.title.toLowerCase();

      // 检查URL冲突
      if (existingUrls.has(url)) {
        const existingBookmark = existingBookmarks.find(b => b.url.toLowerCase() === url);
        if (existingBookmark) {
          conflicts.push({
            chromeBookmark,
            existingBookmark,
            reason: 'url-exists'
          });
          continue;
        }
      }

      // 检查标题相似性
      if (existingTitles.has(title)) {
        const existingBookmark = existingTitles.get(title);
        if (existingBookmark) {
          conflicts.push({
            chromeBookmark,
            existingBookmark,
            reason: 'title-similar'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * 批量导入Chrome书签
   */
  async importChromeBookmarks(
    chromeBookmarks: ChromeBookmarkNode[],
    options: SyncOptions,
    onProgress?: (progress: { current: number; total: number; bookmark?: ChromeBookmarkNode }) => void
  ): Promise<BookmarkSyncResult> {
    const result: BookmarkSyncResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      conflicts: []
    };

    // 获取现有书签
    const { bookmarks: existingBookmarks = [] } = await chromeStorage.get<{ bookmarks?: Bookmark[] }>(['bookmarks']);
    const bookmarksArray = existingBookmarks || [];
    console.log('[chromeBookmarks] importChromeBookmarks 开始，现有书签数:', bookmarksArray.length, '待导入Chrome书签数:', chromeBookmarks.length);
    
    // 检查是否有手动解决的冲突
    let resolvedConflicts: Map<string, 'merge' | 'skip' | 'replace'> = new Map();
    if (options.resolvedConflicts) {
      options.resolvedConflicts.forEach(conflict => {
        resolvedConflicts.set(conflict.conflict.chromeBookmark.id, conflict.resolution || 'skip');
      });
    }
    
    // 检测冲突
    if (options.conflictResolution !== 'skip' && !options.resolvedConflicts) {
      result.conflicts = await this.detectConflicts(chromeBookmarks, bookmarksArray);

      if (options.conflictResolution === 'manual' && result.conflicts.length > 0) {
        // 手动模式：先导入无冲突的书签，返回冲突列表等用户处理
        const conflictUrls = new Set(result.conflicts.map(c => c.chromeBookmark.url?.toLowerCase()));
        const nonConflictBookmarks = chromeBookmarks.filter(cb => cb.url && !conflictUrls.has(cb.url.toLowerCase()));
        for (const chromeBookmark of nonConflictBookmarks) {
          const newBookmark: Bookmark = {
            id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...this.convertChromeBookmarkToTigermark(chromeBookmark)
          };
          bookmarksArray.push(newBookmark);
          result.imported++;
        }
        await chromeStorage.set({ bookmarks: bookmarksArray });
        return result;
      }
    }

    const bookmarksToImport = chromeBookmarks.filter(cb => cb.url);
    const total = bookmarksToImport.length;
    
    for (let i = 0; i < total; i++) {
      const chromeBookmark = bookmarksToImport[i];
      
      try {
        // 报告进度
        onProgress?.({ current: i + 1, total, bookmark: chromeBookmark });

        // 检查是否已存在
        const existing = bookmarksArray.find((b: Bookmark) => 
          b.url.toLowerCase() === chromeBookmark.url?.toLowerCase() ||
          b.chromeBookmarkId === chromeBookmark.id
        );

        // 检查是否有手动解决的冲突
        const manualResolution = resolvedConflicts.get(chromeBookmark.id);
        
        if (existing) {
          if (manualResolution === 'skip') {
            result.skipped++;
            continue;
          } else if (manualResolution === 'replace') {
            // 替换现有书签
            const replacedBookmark: Bookmark = {
              ...existing,
              title: chromeBookmark.title || existing.title,
              url: chromeBookmark.url || existing.url,
              description: '', // 清空描述
              tagIds: [], // 清空标签
              category: undefined, // 清空分类
              updatedAt: Date.now(),
              lastSyncAt: Date.now(),
              chromeBookmarkId: chromeBookmark.id,
              isSyncedFromChrome: true
            };
            
            const bookmarkIndex = bookmarksArray.findIndex((b: Bookmark) => b.id === existing.id);
            if (bookmarkIndex !== -1) {
              bookmarksArray[bookmarkIndex] = replacedBookmark;
              result.updated++;
            }
          } else if (options.conflictResolution === 'auto-merge' || manualResolution === 'merge') {
            // 自动合并或手动合并：更新现有书签
            const updatedBookmark: Bookmark = {
              ...existing,
              title: chromeBookmark.title || existing.title,
              updatedAt: Date.now(),
              lastSyncAt: Date.now(),
              chromeBookmarkId: chromeBookmark.id
            };

            // 更新书签
            const bookmarkIndex = bookmarksArray.findIndex((b: Bookmark) => b.id === existing.id);
            if (bookmarkIndex !== -1) {
              bookmarksArray[bookmarkIndex] = updatedBookmark;
              result.updated++;
            }
          } else if (options.conflictResolution === 'skip') {
            // 跳过冲突书签
            result.skipped++;
          } else {
            // 默认情况，跳过
            result.skipped++;
          }
          continue;
        }

        // 创建新书签
        const newBookmark: Bookmark = {
          id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...this.convertChromeBookmarkToTigermark(chromeBookmark)
        };

        // 如果启用AI分析，尝试分析书签
        if (options.enableAIAnalysis) {
          try {
            // 这里可以调用AI分析服务
            // const analysis = await this.analyzeBookmarkWithAI(newBookmark);
            // newBookmark.aiGenerated = analysis;
          } catch (error) {
            console.warn('AI分析失败，跳过:', error);
          }
        }

        bookmarksArray.push(newBookmark);
        result.imported++;

      } catch (error) {
        console.error('导入书签失败:', chromeBookmark, error);
        result.errors++;
      }

      // 批量处理：每处理一定数量就保存一次
      if ((i + 1) % options.batchSize === 0 || i === total - 1) {
        console.log('[chromeBookmarks] 批量保存书签，当前总数:', bookmarksArray.length);
        await chromeStorage.set({ bookmarks: bookmarksArray });
        console.log('[chromeBookmarks] 批量保存完成');
      }
    }

    console.log('[chromeBookmarks] importChromeBookmarks 结束，结果:', result);
    return result;
  }

  /**
   * 导出TIGERMARK书签到Chrome
   */
  async exportToChrome(
    bookmarkIds: string[],
    targetFolderId?: string
  ): Promise<{ exported: number; errors: number }> {
    if (!chrome.bookmarks) {
      throw new Error('Chrome书签API不可用');
    }

    // 获取TIGERMARK书签
    const { bookmarks: allBookmarks = [] } = await chromeStorage.get<{ bookmarks?: Bookmark[] }>(['bookmarks']);
    const bookmarksArray = allBookmarks || [];
    const tigermarkBookmarks = bookmarksArray.filter((b: Bookmark) => bookmarkIds.includes(b.id));

    let folderId = targetFolderId;
    
    // 如果没有指定目标文件夹，创建一个TIGERMARK文件夹
    if (!folderId) {
      try {
        const folder = await chrome.bookmarks.create({
          title: 'TIGERMARKIII导入',
          parentId: '1' // 书签栏
        });
        folderId = folder.id;
      } catch (error) {
        console.error('创建文件夹失败:', error);
        throw new Error('无法创建目标文件夹');
      }
    }

    let exported = 0;
    let errors = 0;

    for (const bookmark of tigermarkBookmarks) {
      try {
        // 检查是否已经存在于Chrome中
        if (bookmark.chromeBookmarkId) {
          try {
            await chrome.bookmarks.get(bookmark.chromeBookmarkId);
            continue; // 已存在，跳过
          } catch {
            // 不存在，继续创建
          }
        }

        // 创建Chrome书签
        const chromeBookmark = await chrome.bookmarks.create({
          title: bookmark.title,
          url: bookmark.url,
          parentId: folderId
        });

        // 更新TIGERMARK书签的Chrome ID
        const bookmarkIndex = bookmarksArray.findIndex((b: Bookmark) => b.id === bookmark.id);
        if (bookmarkIndex !== -1) {
          bookmarksArray[bookmarkIndex].chromeBookmarkId = chromeBookmark.id;
          bookmarksArray[bookmarkIndex].lastSyncAt = Date.now();
        }
        
        exported++;
      } catch (error) {
        console.error('导出书签失败:', bookmark, error);
        errors++;
      }
    }

    // 保存更新后的书签数据
    await chromeStorage.set({ bookmarks: bookmarksArray });

    return { exported, errors };
  }

  /**
   * 双向同步
   */
  async syncBookmarks(options: SyncOptions): Promise<{
    importResult: BookmarkSyncResult;
    exportResult: { exported: number; errors: number };
  }> {
    // 1. 从Chrome导入
    const chromeBookmarks = await this.getAllChromeBookmarkUrls();
    const importResult = await this.importChromeBookmarks(chromeBookmarks, options);

    // 2. 导出到Chrome
    const { bookmarks: tigermarkBookmarks = [] } = await chromeStorage.get<{ bookmarks?: Bookmark[] }>(['bookmarks']);
    const bookmarksArray = tigermarkBookmarks || [];
    const bookmarksToExport = bookmarksArray.filter((b: Bookmark) => 
      !b.isSyncedFromChrome && !b.chromeBookmarkId
    );
    const exportResult = await this.exportToChrome(bookmarksToExport.map((b: Bookmark) => b.id));

    return { importResult, exportResult };
  }

  /**
   * 监听Chrome书签变化（用于实时同步）
   */
  setupChromeBookmarkListener(
    onBookmarkCreated?: (bookmark: ChromeBookmarkNode) => void,
    onBookmarkRemoved?: (bookmarkId: string) => void,
    onBookmarkChanged?: (bookmarkId: string, changeInfo: any) => void
  ): void {
    if (!chrome.bookmarks) return;

    // 监听书签创建
    if (onBookmarkCreated) {
      chrome.bookmarks.onCreated.addListener((id, bookmark) => {
        onBookmarkCreated(bookmark);
      });
    }

    // 监听书签删除
    if (onBookmarkRemoved) {
      chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
        onBookmarkRemoved(id);
      });
    }

    // 监听书签修改
    if (onBookmarkChanged) {
      chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
        onBookmarkChanged(id, changeInfo);
      });
    }
  }
}

export default ChromeBookmarkService.getInstance();