/**
 * 存储服务 - 基于核心存储模块的统一接口
 * 提供向后兼容的 API，内部委托给 src/core/storage/ 各实体存储服务
 */

import type {
  Bookmark,
  Tag,
  Category,
  Settings,
  FilterOptions,
  DomainGroup,
  DomainGroupResult,
  DomainGroupViewOptions,
  GraveyardEntry,
} from '../types/index';
import { bookmarkStorage } from '../core/storage/bookmarks';
import { categoryStorage } from '../core/storage/categories';
import { settingsStorage } from '../core/storage/settings';
import { chromeStorage } from '../core/storage/chrome';
import { DomainGroupService } from './domainGroupService';
import { tagService } from './tagService';
import { graveyardStorage } from '../core/storage/graveyard';
import { CHECKPOINT_VERSION } from '../constants';

export class StorageService {
  private static instance: StorageService;
  private domainGroupService!: DomainGroupService;

  constructor() {
    // 延迟初始化 DomainGroupService 以避免循环依赖
  }

  private initializeDomainGroupService(): void {
    if (!this.domainGroupService) {
      this.domainGroupService = new DomainGroupService();
      this.domainGroupService.startCacheAutoUpdate();
    }
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // ==================== 书签操作 ====================

  async getBookmarks(): Promise<Bookmark[]> {
    return bookmarkStorage.getBookmarks();
  }

  async getBookmarkById(id: string): Promise<Bookmark | undefined> {
    const bookmark = await bookmarkStorage.getBookmarkById(id);
    return bookmark || undefined;
  }

  async getBookmarkByUrl(url: string): Promise<Bookmark | undefined> {
    const bookmark = await bookmarkStorage.getBookmarkByUrl(url);
    return bookmark || undefined;
  }

  async addBookmark(bookmark: Bookmark): Promise<void> {
    return bookmarkStorage.addBookmark(bookmark);
  }

  async updateBookmark(id: string, updates: Partial<Bookmark>): Promise<void> {
    await bookmarkStorage.updateBookmark(id, updates);
  }

  async deleteBookmark(id: string, reason: GraveyardEntry['deletedReason'] = 'manual'): Promise<void> {
    const bookmark = await bookmarkStorage.getBookmarkById(id);
    if (bookmark) {
      const tags = await tagService.getAllTags();
      const categories = await categoryStorage.getAll();
      await graveyardStorage.bury(bookmark, { tags, categories, reason });
    }
    return bookmarkStorage.deleteBookmark(id);
  }

  async batchUpdateBookmarks(
    updates: { id: string; data: Partial<Bookmark> }[]
  ): Promise<void> {
    const bookmarks = await bookmarkStorage.getBookmarks();

    updates.forEach((update) => {
      const index = bookmarks.findIndex((b) => b.id === update.id);
      if (index !== -1) {
        bookmarks[index] = {
          ...bookmarks[index],
          ...update.data,
          updatedAt: Date.now(),
        };
      }
    });

    await chromeStorage.set({ bookmarks });
  }

  async batchDeleteBookmarks(ids: string[], reason: GraveyardEntry['deletedReason'] = 'batch'): Promise<void> {
    const bookmarks = await bookmarkStorage.getBookmarks();
    const toBury = bookmarks.filter(b => ids.includes(b.id));
    if (toBury.length > 0) {
      const tags = await tagService.getAllTags();
      const categories = await categoryStorage.getAll();
      await graveyardStorage.buryMany(toBury, { tags, categories, reason });
    }
    return bookmarkStorage.batchDeleteBookmarks(ids);
  }

  async searchBookmarks(
    query: string,
    filters?: FilterOptions
  ): Promise<Bookmark[]> {
    const searchQuery = {
      query,
      filters: filters
        ? {
            tags: filters.tags,
            categories: filters.categories,
            status: filters.status,
          }
        : undefined,
    };
    return bookmarkStorage.searchBookmarks(searchQuery);
  }

  // ==================== 标签操作 ====================
  // 标签以 Tag[] 形式存储在 'tags' key 下，与 TagStorage（tagStats）不同

  async getTags(): Promise<Tag[]> {
    const result = await chromeStorage.get<{ tags?: Tag[] }>(['tags']);
    return result.tags || [];
  }

  async addTag(tag: Tag): Promise<void> {
    const tags = await this.getTags();
    const existingIndex = tags.findIndex((t) => t.name === tag.name);

    if (existingIndex !== -1) {
      tags[existingIndex] = tag;
    } else {
      tags.push(tag);
    }

    await chromeStorage.set({ tags });
  }

  async deleteTag(id: string): Promise<void> {
    const tags = await this.getTags();
    const tagToDelete = tags.find((t) => t.id === id);
    if (!tagToDelete) return;

    const filteredTags = tags.filter((t) => t.id !== id);
    await chromeStorage.set({ tags: filteredTags });

    // 同时从所有书签中移除这个标签
    const bookmarks = await bookmarkStorage.getBookmarks();
    const updatedBookmarks = bookmarks.map((bookmark) => ({
      ...bookmark,
      tagIds: bookmark.tagIds?.filter((tagId) => tagId !== id) || [],
    }));
    await chromeStorage.set({ bookmarks: updatedBookmarks });
  }

  async getTagStats(bookmarksOverride?: Bookmark[]): Promise<Record<string, number>> {
    const counts = await tagService.getTagCounts(bookmarksOverride);
    const tags = await tagService.getAllTags();
    const tagMap = new Map(tags.map(t => [t.id, t.name]));
    const result: Record<string, number> = {};
    counts.forEach((count, tagId) => {
      const name = tagMap.get(tagId) || tagId;
      result[name] = count;
    });
    return result;
  }

  // ==================== 分类操作 ====================

  async getCategories(): Promise<Category[]> {
    return categoryStorage.getAll();
  }

  async addCategory(category: Category): Promise<void> {
    const categories = await categoryStorage.getAll();
    categories.push(category);
    await chromeStorage.set({ categories });
  }

  async updateCategory(
    id: string,
    updates: Partial<Category>
  ): Promise<Category> {
    return categoryStorage.update(id, updates);
  }

  async deleteCategory(id: string): Promise<void> {
    await categoryStorage.delete(id);

    // 同时从所有书签中移除这个分类引用
    const bookmarks = await bookmarkStorage.getBookmarks();
    const updatedBookmarks = bookmarks.map((bookmark) => ({
      ...bookmark,
      categoryId:
        bookmark.categoryId === id ? undefined : bookmark.categoryId,
    }));
    await chromeStorage.set({ bookmarks: updatedBookmarks });
  }

  async getCategoryStats(bookmarksOverride?: Bookmark[]): Promise<Record<string, number>> {
    return bookmarkStorage.getCategoryStats(bookmarksOverride);
  }

  async getCategoriesByLevel(level?: number): Promise<Category[]> {
    const { getCategoryLevel } = await import(
      '../utils/categoryTreeBuilder'
    );
    const categories = await categoryStorage.getAll();
    if (!level) return categories;
    return categories.filter(
      (c) => getCategoryLevel(c.id, categories) === level
    );
  }

  async getCategoryChildren(parentId: string): Promise<Category[]> {
    const categories = await categoryStorage.getAll();
    return categories.filter((c) => c.parentId === parentId);
  }

  async getCategoryByPath(fullPath: string): Promise<Category | undefined> {
    const { getCategoryPath } = await import(
      '../utils/categoryTreeBuilder'
    );
    const categories = await categoryStorage.getAll();
    return categories.find((c) => getCategoryPath(c.id, categories) === fullPath);
  }

  async ensureCategoryPath(fullPath: string): Promise<Category> {
    const normalizedPath = fullPath
      .split('/')
      .map(p => p.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join('/');

    if (!normalizedPath) {
      throw new Error('分类路径不能为空');
    }

    const categories = await categoryStorage.getAll();
    const pathParts = normalizedPath.split('/');

    let parentId: string | null = null;
    let leafCategory: Category | null = null;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i].trim();
      const level = i + 1;

      let category = categories.find(
        (c) => c.name === part && c.parentId === parentId
      );

      if (!category) {
        category = {
          id: `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: part,
          icon: this.getDefaultCategoryIcon(part, level),
          color: this.getDefaultCategoryColor(part, level),
          parentId,
          createdAt: Date.now(),
        };
        categories.push(category);
      }

      leafCategory = category;
      parentId = category.id;
    }

    await chromeStorage.set({ categories });

    if (!leafCategory) {
      throw new Error(`无法创建分类路径: ${normalizedPath}`);
    }

    return leafCategory;
  }

  private getDefaultCategoryIcon(name: string, level: number): string {
    const iconMap: Record<string, string> = {
      技术: '💻',
      商业: '💼',
      教育: '📚',
      娱乐: '🎮',
      生活: '🏠',
      新闻: '📰',
      工具: '🔧',
      文档: '📄',
      前端开发: '🎨',
      后端技术: '⚙️',
      移动开发: '📱',
      数据科学: '📊',
      人工智能: '🤖',
      云计算: '☁️',
      'React框架': '⚛️',
      'Vue框架': '💚',
      'Node.js': '🟢',
    };

    return (
      iconMap[name] || (level === 1 ? '📁' : level === 2 ? '📂' : '📄')
    );
  }

  private getDefaultCategoryColor(name: string, level: number): string {
    const colorMap: Record<string, string> = {
      技术: '#3b82f6',
      商业: '#10b981',
      教育: '#f59e0b',
      娱乐: '#ef4444',
      生活: '#8b5cf6',
      新闻: '#06b6d4',
      工具: '#6b7280',
      文档: '#84cc16',
      前端开发: '#ec4899',
      后端技术: '#f97316',
      移动开发: '#14b8a6',
      数据科学: '#8b5cf6',
      人工智能: '#f59e0b',
      云计算: '#06b6d4',
      'React框架': '#3b82f6',
      'Vue框架': '#10b981',
      'Node.js': '#84cc16',
    };

    return (
      colorMap[name] ||
      (level === 1 ? '#6b7280' : level === 2 ? '#9ca3af' : '#d1d5db')
    );
  }

  // ==================== 设置操作 ====================

  async getSettings(): Promise<Settings> {
    return settingsStorage.getSettings();
  }

  async updateSettings(updates: Partial<Settings>): Promise<void> {
    await settingsStorage.updateSettings(updates);
  }

  // ==================== 域名分组操作 ====================

  async getDomainGroups(options?: DomainGroupViewOptions): Promise<DomainGroup[]> {
    this.initializeDomainGroupService();
    return this.domainGroupService.getDomainGroups(options);
  }

  async getDomainGroupResult(
    options?: DomainGroupViewOptions
  ): Promise<DomainGroupResult> {
    this.initializeDomainGroupService();
    return this.domainGroupService.getDomainGroupResult(options);
  }

  async getBookmarksByDomain(domain: string): Promise<Bookmark[]> {
    this.initializeDomainGroupService();
    return this.domainGroupService.getBookmarksByDomain(domain);
  }

  async getUngroupedBookmarks(minGroupSize = 2): Promise<Bookmark[]> {
    this.initializeDomainGroupService();
    return this.domainGroupService.getUngroupedBookmarks(minGroupSize);
  }

  clearDomainGroupCache(): void {
    this.initializeDomainGroupService();
    this.domainGroupService.clearCache();
  }

  async replaceDomain(oldDomain: string, newDomain: string): Promise<number> {
    this.initializeDomainGroupService();
    return this.domainGroupService.replaceDomain(oldDomain, newDomain);
  }

  // ==================== 数据导入导出 ====================

  async exportData(): Promise<{
    bookmarks: Bookmark[];
    tags: Tag[];
    categories: Category[];
    settings: Settings;
    exportDate: number;
  }> {
    const [bookmarks, tags, categories, settings] = await Promise.all([
      bookmarkStorage.getBookmarks(),
      this.getTags(),
      categoryStorage.getAll(),
      settingsStorage.getSettings(),
    ]);

    return {
      bookmarks,
      tags,
      categories,
      settings,
      exportDate: Date.now(),
    };
  }

  async importData(data: {
    bookmarks?: Bookmark[];
    tags?: Tag[];
    categories?: Category[];
    settings?: Settings;
  }): Promise<void> {
    const updates: Record<string, unknown> = {};

    if (data.bookmarks) {
      updates.bookmarks = data.bookmarks;
    }
    if (data.tags) {
      updates.tags = data.tags;
    }
    if (data.categories) {
      updates.categories = data.categories;
    }

    if (Object.keys(updates).length > 0) {
      await chromeStorage.set(updates);
    }

    if (data.settings) {
      await settingsStorage.importSettings(data.settings);
    }
  }

  // ==================== Checkpoint 备份与恢复 ====================

  async createCheckpoint(): Promise<Record<string, unknown>> {
    const [bookmarks, tags, categories, settings, graveyard, extras] = await Promise.all([
      bookmarkStorage.getBookmarks(),
      tagService.getAllTags(),
      categoryStorage.getAll(),
      settingsStorage.getSettings(),
      graveyardStorage.getAll(),
      chromeStorage.get(['linkCheckProgress', 'categoryMigrationDone']),
    ]);

    let aiArchiveCheckpoint: unknown = null;
    try {
      const raw = localStorage.getItem('ai_archive_checkpoint');
      if (raw) aiArchiveCheckpoint = JSON.parse(raw);
    } catch { /* ignore */ }

    let uiState: unknown = null;
    try {
      const raw = localStorage.getItem('tigermark-store');
      if (raw) uiState = JSON.parse(raw);
    } catch { /* ignore */ }

    return {
      checkpointVersion: CHECKPOINT_VERSION,
      checkpointDate: Date.now(),
      stats: {
        bookmarkCount: bookmarks.length,
        tagCount: tags.length,
        categoryCount: categories.length,
        graveyardCount: graveyard.length,
      },
      bookmarks,
      tags,
      categories,
      settings,
      graveyard,
      linkCheckProgress: extras.linkCheckProgress ?? null,
      aiArchiveCheckpoint,
      uiState,
      categoryMigrationDone: extras.categoryMigrationDone ?? null,
    };
  }

  async restoreCheckpoint(data: Record<string, unknown>): Promise<void> {
    // 兼容旧 export 格式（无 checkpointVersion）
    if (!data.checkpointVersion && data.bookmarks) {
      await this.importData(data as any);
      return;
    }

    const updates: Record<string, unknown> = {};
    if (data.bookmarks) updates.bookmarks = data.bookmarks;
    if (data.tags) updates.tags = data.tags;
    if (data.categories) updates.categories = data.categories;
    if (data.graveyard) updates.graveyard = data.graveyard;
    if (data.linkCheckProgress != null) updates.linkCheckProgress = data.linkCheckProgress;
    if (data.categoryMigrationDone != null) updates.categoryMigrationDone = data.categoryMigrationDone;

    await chromeStorage.clear();
    if (Object.keys(updates).length > 0) {
      await chromeStorage.set(updates);
    }

    if (data.settings) {
      await settingsStorage.importSettings(data.settings as Settings);
    }

    try {
      if (data.aiArchiveCheckpoint) {
        localStorage.setItem('ai_archive_checkpoint', JSON.stringify(data.aiArchiveCheckpoint));
      }
    } catch { /* localStorage full — non-critical */ }

    try {
      if (data.uiState) {
        localStorage.setItem('tigermark-store', JSON.stringify(data.uiState));
      }
    } catch { /* localStorage full — non-critical */ }
  }

  async clearAllData(): Promise<void> {
    await Promise.all([
      chromeStorage.clear(),
      chromeStorage.clear({ useSync: true }),
    ]);
  }

  // ==================== 存储监控 ====================

  async getStorageUsage(): Promise<{
    local: { bytesInUse: number; quotaBytes: number };
    sync: { bytesInUse: number; quotaBytes: number };
  }> {
    const usage = await chromeStorage.getUsage();

    return {
      local: {
        bytesInUse: usage.local.used,
        quotaBytes: usage.local.quota,
      },
      sync: {
        bytesInUse: usage.sync.used,
        quotaBytes: usage.sync.quota,
      },
    };
  }

  onStorageChange(
    callback: (changes: Record<string, chrome.storage.StorageChange>) => void
  ): void {
    chromeStorage.onChanged(callback);
  }

  offStorageChange(
    callback: (changes: Record<string, chrome.storage.StorageChange>) => void
  ): void {
    chromeStorage.removeListener(callback);
  }
}

// 导出单例实例
export const storageService = StorageService.getInstance();
