/**
 * AI分析服务
 * 处理AI分析相关功能
 */

import type { AIAnalysisResult, PageAnalysis } from '../../types/index';
import { aiService } from '../../services/ai';
import { tagService } from '../../services/tagService';

export interface AIAnalysisOptions {
  enableAI?: boolean;
  content?: string;
  url?: string;
  pageAnalysis?: PageAnalysis;
}

export class AIAnalysisService {
  private static instance: AIAnalysisService;

  public static getInstance(): AIAnalysisService {
    if (!AIAnalysisService.instance) {
      AIAnalysisService.instance = new AIAnalysisService();
    }
    return AIAnalysisService.instance;
  }

  private constructor() {}

  /**
   * 分析页面内容
   */
  async analyzePageContent(options: AIAnalysisOptions): Promise<AIAnalysisResult | null> {
    if (!options.enableAI || !options.content || !options.url) {
      return null;
    }

    try {
      const existingTags = await tagService.getAllTags();
      const result = await aiService.analyzeContent(
        options.content,
        options.url,
        options.pageAnalysis,
        undefined,
        existingTags
      );

      return result;
    } catch (error) {
      console.error('AI分析失败:', error);
      throw new Error(`AI分析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 批量分析书签
   */
  async batchAnalyzeBookmarks(
    bookmarks: Array<{ id: string; url: string; content?: string }>,
    onProgress?: (current: number, total: number, bookmarkId: string) => void
  ): Promise<Array<{ bookmarkId: string; result: AIAnalysisResult | null; error?: string }>> {
    const results: Array<{ bookmarkId: string; result: AIAnalysisResult | null; error?: string }> = [];
    
    for (let i = 0; i < bookmarks.length; i++) {
      const bookmark = bookmarks[i];
      
      if (onProgress) {
        onProgress(i + 1, bookmarks.length, bookmark.id);
      }

      try {
        if (bookmark.content) {
          const result = await this.analyzePageContent({
            enableAI: true,
            content: bookmark.content,
            url: bookmark.url
          });
          
          results.push({
            bookmarkId: bookmark.id,
            result
          });
        } else {
          results.push({
            bookmarkId: bookmark.id,
            result: null,
            error: '缺少页面内容'
          });
        }
      } catch (error) {
        results.push({
          bookmarkId: bookmark.id,
          result: null,
          error: error instanceof Error ? error.message : '分析失败'
        });
      }
    }

    return results;
  }

  /**
   * 生成标签建议
   */
  async generateTagSuggestions(tags: import('../../types/index').Tag[], tagCounts: Map<string, number>): Promise<any[]> {
    try {
      return await aiService.generateTagSuggestions(tags, tagCounts);
    } catch (error) {
      console.error('生成标签建议失败:', error);
      throw error;
    }
  }

  /**
   * 检查AI服务是否可用
   */
  async isAIServiceAvailable(): Promise<boolean> {
    try {
      // 尝试初始化AI服务
      await aiService.initialize({
        aiApiKey: 'test',
      } as any);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取AI服务状态
   */
  getAIStatus(): {
    isInitialized: boolean;
    cacheSize: number;
    lastError?: string;
  } {
    return {
      isInitialized: aiService.getCacheSize() >= 0,
      cacheSize: aiService.getCacheSize(),
      lastError: undefined
    };
  }

  /**
   * 清除AI缓存
   */
  clearAICache(): void {
    aiService.clearCache();
  }
}

// 导出单例实例
export const aiAnalysisService = AIAnalysisService.getInstance();
