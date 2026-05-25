import { chromeStorage } from './chrome';
import type { Bookmark, Tag, GraveyardEntry, Category } from '../../types';

export class GraveyardStorageService {
  private static instance: GraveyardStorageService;
  private readonly STORAGE_KEY = 'graveyard';

  static getInstance(): GraveyardStorageService {
    if (!GraveyardStorageService.instance) {
      GraveyardStorageService.instance = new GraveyardStorageService();
    }
    return GraveyardStorageService.instance;
  }

  private constructor() {}

  async getAll(): Promise<GraveyardEntry[]> {
    const result = await chromeStorage.get<{ graveyard?: GraveyardEntry[] }>(this.STORAGE_KEY);
    return result?.graveyard || [];
  }

  /** 将书签快照存入坟场 */
  async bury(
    bookmark: Bookmark,
    opts: { tags: Tag[]; categories: Category[]; reason: GraveyardEntry['deletedReason'] }
  ): Promise<void> {
    const tagMap = new Map(opts.tags.map(t => [t.id, t]));
    const categoryMap = new Map(opts.categories.map(c => [c.id, c]));

    const tagPaths = this.resolveTagPaths(bookmark.tagIds || [], tagMap);
    const categoryPath = bookmark.categoryId
      ? this.resolveCategoryPath(bookmark.categoryId, categoryMap)
      : undefined;

    const entry: GraveyardEntry = {
      id: `grave_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
      tagPaths,
      categoryPath,
      keywords: bookmark.aiGenerated?.keywords,
      summary: bookmark.aiGenerated?.summary,
      favicon: bookmark.favicon,
      deletedReason: opts.reason,
      originalCreatedAt: bookmark.createdAt,
      deletedAt: Date.now(),
    };

    const entries = await this.getAll();
    entries.unshift(entry);
    await chromeStorage.set({ [this.STORAGE_KEY]: entries });
  }

  async buryMany(
    bookmarks: Bookmark[],
    opts: { tags: Tag[]; categories: Category[]; reason: GraveyardEntry['deletedReason'] }
  ): Promise<void> {
    const tagMap = new Map(opts.tags.map(t => [t.id, t]));
    const categoryMap = new Map(opts.categories.map(c => [c.id, c]));
    const now = Date.now();

    const newEntries: GraveyardEntry[] = bookmarks.map((b, i) => ({
      id: `grave_${now}_${i}_${Math.random().toString(36).slice(2, 8)}`,
      url: b.url,
      title: b.title,
      description: b.description,
      tagPaths: this.resolveTagPaths(b.tagIds || [], tagMap),
      categoryPath: b.categoryId ? this.resolveCategoryPath(b.categoryId, categoryMap) : undefined,
      keywords: b.aiGenerated?.keywords,
      summary: b.aiGenerated?.summary,
      favicon: b.favicon,
      deletedReason: opts.reason,
      originalCreatedAt: b.createdAt,
      deletedAt: now,
    }));

    const entries = await this.getAll();
    entries.unshift(...newEntries);
    await chromeStorage.set({ [this.STORAGE_KEY]: entries });
  }

  async permanentDelete(id: string): Promise<void> {
    const entries = await this.getAll();
    await chromeStorage.set({ [this.STORAGE_KEY]: entries.filter(e => e.id !== id) });
  }

  async permanentDeleteMany(ids: string[]): Promise<void> {
    const deleteSet = new Set(ids);
    const entries = await this.getAll();
    await chromeStorage.set({ [this.STORAGE_KEY]: entries.filter(e => !deleteSet.has(e.id)) });
  }

  async search(query: string): Promise<GraveyardEntry[]> {
    const entries = await this.getAll();
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.url.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.summary?.toLowerCase().includes(q) ||
      e.tagPaths.some(t => t.toLowerCase().includes(q)) ||
      e.categoryPath?.toLowerCase().includes(q) ||
      e.keywords?.some(k => k.toLowerCase().includes(q))
    );
  }

  private resolveTagPaths(tagIds: string[], tagMap: Map<string, Tag>): string[] {
    const paths: string[] = [];
    for (const id of tagIds) {
      const parts: string[] = [];
      let current = tagMap.get(id);
      let safety = 0;
      while (current && safety < 50) {
        parts.unshift(current.name);
        if (!current.parentId) break;
        current = tagMap.get(current.parentId);
        safety++;
      }
      if (parts.length > 0) paths.push(parts.join('/'));
    }
    return paths;
  }

  private resolveCategoryPath(categoryId: string, categoryMap: Map<string, Category>): string {
    const parts: string[] = [];
    let current = categoryMap.get(categoryId);
    let safety = 0;
    while (current && safety < 50) {
      parts.unshift(current.name);
      if (!current.parentId) break;
      current = categoryMap.get(current.parentId);
      safety++;
    }
    return parts.join('/');
  }
}

export const graveyardStorage = GraveyardStorageService.getInstance();
