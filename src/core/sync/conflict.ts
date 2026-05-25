/**
 * 冲突处理服务
 * 处理书签同步过程中的冲突解决
 */

import type { Bookmark, ChromeBookmark, ConflictInfo, ConflictResolution } from '../../types/index';

export interface ConflictResolutionStrategy {
  urlExists: 'skip' | 'replace' | 'merge' | 'rename';
  titleSimilar: 'skip' | 'replace' | 'merge' | 'rename';
  duplicateContent: 'skip' | 'replace' | 'merge';
}

export class ConflictResolver {
  private static instance: ConflictResolver;
  private defaultStrategy: ConflictResolutionStrategy = {
    urlExists: 'replace',
    titleSimilar: 'merge',
    duplicateContent: 'skip'
  };

  public static getInstance(): ConflictResolver {
    if (!ConflictResolver.instance) {
      ConflictResolver.instance = new ConflictResolver();
    }
    return ConflictResolver.instance;
  }

  private constructor() {}

  /**
   * 检测所有可能的冲突
   */
  async detectConflicts(
    chromeBookmarks: ChromeBookmark[],
    existingBookmarks: Bookmark[]
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];
    const urlMap = new Map(existingBookmarks.map(b => [b.url, b]));
    const titleMap = new Map(existingBookmarks.map(b => [b.title.toLowerCase(), b]));

    for (const chromeBookmark of chromeBookmarks) {
      if (!chromeBookmark.url) continue;

      // URL冲突检测
      const urlConflict = urlMap.get(chromeBookmark.url);
      if (urlConflict) {
        conflicts.push({
          chromeBookmark,
          existingBookmark: urlConflict,
          reason: 'url-exists'
        });
        continue;
      }

      // 标题相似性冲突检测
      const titleConflict = this.findSimilarTitle(chromeBookmark.title, titleMap);
      if (titleConflict) {
        conflicts.push({
          chromeBookmark,
          existingBookmark: titleConflict,
          reason: 'title-similar'
        });
      }
    }

    return conflicts;
  }

  /**
   * 解决冲突
   */
  async resolveConflicts(
    conflicts: ConflictInfo[],
    strategy: ConflictResolutionStrategy = this.defaultStrategy
  ): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict, strategy);
      resolutions.push(resolution);
    }

    return resolutions;
  }

  /**
   * 解决单个冲突
   */
  private async resolveConflict(
    conflict: ConflictInfo,
    strategy: ConflictResolutionStrategy
  ): Promise<ConflictResolution> {
    const { chromeBookmark, existingBookmark, reason } = conflict;
    
    let action: ConflictResolution['action'];
    let result: Bookmark | null = null;

    switch (reason) {
      case 'url-exists':
        action = strategy.urlExists;
        break;
      case 'title-similar':
        action = strategy.titleSimilar;
        break;
      default:
        action = 'skip';
    }

    switch (action) {
      case 'skip':
        result = null;
        break;
      case 'replace':
        result = await this.replaceBookmark(existingBookmark, chromeBookmark);
        break;
      case 'merge':
        result = await this.mergeBookmarks(existingBookmark, chromeBookmark);
        break;
      case 'rename':
        result = await this.renameBookmark(existingBookmark, chromeBookmark);
        break;
    }

    return {
      conflict,
      action,
      result,
      timestamp: Date.now()
    };
  }

  /**
   * 替换书签
   */
  private async replaceBookmark(
    existingBookmark: Bookmark,
    chromeBookmark: ChromeBookmark
  ): Promise<Bookmark> {
    return {
      ...existingBookmark,
      title: chromeBookmark.title,
      url: chromeBookmark.url!,
      updatedAt: Date.now(),
      chromeBookmarkId: chromeBookmark.id,
      isSyncedFromChrome: true,
      lastSyncAt: Date.now()
    };
  }

  /**
   * 合并书签
   */
  private async mergeBookmarks(
    existingBookmark: Bookmark,
    chromeBookmark: ChromeBookmark
  ): Promise<Bookmark> {
    // 合并标签
    const mergedTags = [...new Set([...existingBookmark.tagIds])];

    // 合并描述
    const mergedDescription = existingBookmark.description && chromeBookmark.title
      ? `${existingBookmark.description}\n\nChrome: ${chromeBookmark.title}`
      : existingBookmark.description || chromeBookmark.title;

    return {
      ...existingBookmark,
      title: chromeBookmark.title,
      description: mergedDescription,
      tagIds: mergedTags,
      updatedAt: Date.now(),
      chromeBookmarkId: chromeBookmark.id,
      isSyncedFromChrome: true,
      lastSyncAt: Date.now()
    };
  }

  /**
   * 重命名书签
   */
  private async renameBookmark(
    existingBookmark: Bookmark,
    chromeBookmark: ChromeBookmark
  ): Promise<Bookmark> {
    const newTitle = `${chromeBookmark.title} (Chrome)`;
    
    return {
      ...existingBookmark,
      title: newTitle,
      updatedAt: Date.now(),
      chromeBookmarkId: chromeBookmark.id,
      isSyncedFromChrome: true,
      lastSyncAt: Date.now()
    };
  }

  /**
   * 查找相似标题
   */
  private findSimilarTitle(
    title: string,
    titleMap: Map<string, Bookmark>
  ): Bookmark | null {
    const normalizedTitle = title.toLowerCase();
    
    // 精确匹配
    if (titleMap.has(normalizedTitle)) {
      return titleMap.get(normalizedTitle)!;
    }

    // 相似性匹配
    let bestMatch: Bookmark | null = null;
    let bestSimilarity = 0;
    const threshold = 0.8;

    for (const [existingTitle, bookmark] of titleMap) {
      const similarity = this.calculateSimilarity(normalizedTitle, existingTitle);
      if (similarity > threshold && similarity > bestSimilarity) {
        bestMatch = bookmark;
        bestSimilarity = similarity;
      }
    }

    return bestMatch;
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
   * 设置默认冲突解决策略
   */
  setDefaultStrategy(strategy: ConflictResolutionStrategy): void {
    this.defaultStrategy = strategy;
  }

  /**
   * 获取默认冲突解决策略
   */
  getDefaultStrategy(): ConflictResolutionStrategy {
    return { ...this.defaultStrategy };
  }
}

// 导出单例实例
export const conflictResolver = ConflictResolver.getInstance();

