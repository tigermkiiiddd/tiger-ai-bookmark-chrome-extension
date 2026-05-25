import { Bookmark, DomainGroup, DomainGroupStats, DomainGroupViewOptions, DomainGroupResult } from '../types';
import { bookmarkStorage } from '../core/storage/bookmarks';
import { chromeStorage } from '../core/storage/chrome';

export class DomainGroupService {
  private groupCache: Map<string, DomainGroup> = new Map();
  private lastCacheUpdate = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  constructor() {}

  /**
   * 从URL中提取域名
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch (error) {
      console.warn('Invalid URL:', url);
      return 'unknown';
    }
  }

  /**
   * 生成域名的显示名称
   */
  private generateDisplayName(domain: string): string {
    // 移除 www. 前缀
    const cleanDomain = domain.replace(/^www\./, '');
    
    // 特殊域名映射
    const domainMap: Record<string, string> = {
      'github.com': 'GitHub',
      'stackoverflow.com': 'Stack Overflow',
      'developer.mozilla.org': 'MDN Web Docs',
      'youtube.com': 'YouTube',
      'google.com': 'Google',
      'medium.com': 'Medium',
      'reddit.com': 'Reddit',
      'twitter.com': 'Twitter',
      'linkedin.com': 'LinkedIn',
      'facebook.com': 'Facebook'
    };

    return domainMap[cleanDomain] || cleanDomain;
  }

  /**
   * 获取域名的favicon URL
   */
  private getFaviconUrl(domain: string): string {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  }

  /**
   * 创建域名分组
   */
  private createDomainGroup(domain: string, bookmarkIds: string[]): DomainGroup {
    const now = Date.now();
    return {
      id: `domain_${domain.replace(/\./g, '_')}_${now}`,
      domain,
      displayName: this.generateDisplayName(domain),
      favicon: this.getFaviconUrl(domain),
      bookmarkCount: bookmarkIds.length,
      bookmarkIds,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * 根据书签生成域名分组
   */
  async generateDomainGroups(bookmarks?: Bookmark[]): Promise<DomainGroup[]> {
    if (!bookmarks) {
      bookmarks = await bookmarkStorage.getBookmarks();
    }

    // 按域名分组书签
    const domainMap = new Map<string, string[]>();
    
    bookmarks.forEach(bookmark => {
      const domain = this.extractDomain(bookmark.url);
      if (!domainMap.has(domain)) {
        domainMap.set(domain, []);
      }
      domainMap.get(domain)!.push(bookmark.id);
    });

    // 创建域名分组
    const groups: DomainGroup[] = [];
    domainMap.forEach((bookmarkIds, domain) => {
      if (bookmarkIds.length > 0) {
        groups.push(this.createDomainGroup(domain, bookmarkIds));
      }
    });

    // 按书签数量降序排序
    groups.sort((a, b) => b.bookmarkCount - a.bookmarkCount);

    return groups;
  }

  /**
   * 获取域名分组（带缓存）
   */
  async getDomainGroups(options?: DomainGroupViewOptions): Promise<DomainGroup[]> {
    const now = Date.now();
    
    // 检查缓存是否有效
    if (now - this.lastCacheUpdate > this.CACHE_DURATION) {
      await this.refreshCache();
    }

    let groups = Array.from(this.groupCache.values());

    // 应用过滤和排序选项
    if (options) {
      groups = this.applyViewOptions(groups, options);
    }

    return groups;
  }

  /**
   * 刷新缓存
   */
  private async refreshCache(): Promise<void> {
    const groups = await this.generateDomainGroups();
    
    this.groupCache.clear();
    groups.forEach(group => {
      this.groupCache.set(group.domain, group);
    });
    
    this.lastCacheUpdate = Date.now();
  }

  /**
   * 应用视图选项
   */
  private applyViewOptions(groups: DomainGroup[], options: DomainGroupViewOptions): DomainGroup[] {
    let filteredGroups = [...groups];

    // 应用最小书签数量过滤
    if (options.minBookmarkCount && options.minBookmarkCount > 0) {
      filteredGroups = filteredGroups.filter(group => group.bookmarkCount >= options.minBookmarkCount!);
    }

    // 应用搜索查询
    if (options.searchQuery && options.searchQuery.trim()) {
      const query = options.searchQuery.toLowerCase().trim();
      filteredGroups = filteredGroups.filter(group => 
        group.domain.toLowerCase().includes(query) ||
        group.displayName.toLowerCase().includes(query)
      );
    }

    // 应用排序
    filteredGroups.sort((a, b) => {
      let comparison = 0;
      
      switch (options.sortBy) {
        case 'domain':
          comparison = a.domain.localeCompare(b.domain);
          break;
        case 'bookmarkCount':
          comparison = a.bookmarkCount - b.bookmarkCount;
          break;
        case 'createdAt':
          comparison = (a.createdAt ?? 0) - (b.createdAt ?? 0);
          break;
        case 'updatedAt':
          comparison = (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
          break;
        default:
          comparison = b.bookmarkCount - a.bookmarkCount; // 默认按书签数量降序
      }
      
      return options.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filteredGroups;
  }

  /**
   * 获取域名分组统计信息
   */
  async getDomainGroupStats(): Promise<DomainGroupStats> {
    const groups = await this.getDomainGroups();
    const totalBookmarks = groups.reduce((sum, group) => sum + group.bookmarkCount, 0);
    
    return {
      totalGroups: groups.length,
      totalBookmarks,
      averageBookmarksPerGroup: groups.length > 0 ? Math.round(totalBookmarks / groups.length * 100) / 100 : 0,
      topDomains: groups.slice(0, 10).map(group => ({
        domain: group.domain,
        count: group.bookmarkCount
      }))
    };
  }

  /**
   * 获取指定域名的书签
   */
  async getBookmarksByDomain(domain: string): Promise<Bookmark[]> {
    const bookmarks = await bookmarkStorage.getBookmarks();
    return bookmarks.filter(bookmark => this.extractDomain(bookmark.url) === domain);
  }

  /**
   * 获取未分组的书签（域名只有一个书签的）
   */
  async getUngroupedBookmarks(minGroupSize = 2): Promise<Bookmark[]> {
    const groups = await this.getDomainGroups();
    const groupedDomains = new Set(groups.filter(g => g.bookmarkCount >= minGroupSize).map(g => g.domain));

    const allBookmarks = await bookmarkStorage.getBookmarks();
    return allBookmarks.filter(bookmark => {
      const domain = this.extractDomain(bookmark.url);
      return !groupedDomains.has(domain);
    });
  }

  /**
   * 获取完整的域名分组结果
   */
  async getDomainGroupResult(options?: DomainGroupViewOptions): Promise<DomainGroupResult> {
    const [groups, stats, ungroupedBookmarks] = await Promise.all([
      this.getDomainGroups(options),
      this.getDomainGroupStats(),
      this.getUngroupedBookmarks()
    ]);

    return {
      groups,
      stats,
      ungroupedBookmarks
    };
  }

  /**
   * 替换域名：将该域名下所有书签的URL域名部分替换为新域名
   */
  async replaceDomain(oldDomain: string, newDomain: string): Promise<number> {
    const bookmarks = await bookmarkStorage.getBookmarks();
    let replacedCount = 0;
    const now = Date.now();

    const updated = bookmarks.map(bookmark => {
      try {
        const urlObj = new URL(bookmark.url);
        if (urlObj.hostname.toLowerCase() === oldDomain.toLowerCase()) {
          urlObj.hostname = newDomain;
          replacedCount++;
          return { ...bookmark, url: urlObj.toString(), updatedAt: now };
        }
      } catch {
        // skip invalid URLs
      }
      return bookmark;
    });

    if (replacedCount > 0) {
      await chromeStorage.set({ bookmarks: updated });
      this.clearCache();
    }

    return replacedCount;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.groupCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * 监听书签变化，自动更新缓存
   */
  startCacheAutoUpdate(): void {
    chromeStorage.onChanged((changes) => {
      if (changes.bookmarks) {
        // 书签发生变化时清除缓存，下次访问时重新生成
        this.clearCache();
      }
    });
  }

  /**
   * 停止缓存自动更新
   */
  stopCacheAutoUpdate(): void {
    // 这里需要移除监听器，但StorageService需要提供相应的方法
    // 暂时通过清除缓存来处理
    this.clearCache();
  }

  /**
   * 根据书签URL获取对应的域名分组信息
   */
  async getDomainGroupForBookmark(url: string): Promise<DomainGroup | null> {
    const domain = this.extractDomain(url);
    const groups = await this.getDomainGroups();
    return groups.find(group => group.domain === domain) || null;
  }

  /**
   * 根据书签URL获取域名显示名称
   */
  getDomainDisplayName(url: string): string {
    const domain = this.extractDomain(url);
    return this.generateDisplayName(domain);
  }

  /**
   * 根据书签URL获取域名favicon
   */
  getDomainFavicon(url: string): string {
    const domain = this.extractDomain(url);
    return this.getFaviconUrl(domain);
  }
}