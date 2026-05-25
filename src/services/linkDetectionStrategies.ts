import { LinkStatus, type EnhancedLinkCheckResult, type Bookmark } from '../types/index';

/** 将 HTTP 状态码映射为链接状态（403/429 等防爬常见，不应一律判 DEAD） */
export function mapHttpStatusToLinkStatus(statusCode: number): LinkStatus {
  if (statusCode >= 200 && statusCode < 300) return LinkStatus.ACTIVE;
  if (statusCode >= 300 && statusCode < 400) return LinkStatus.REDIRECT;
  if (statusCode === 404 || statusCode === 410) return LinkStatus.DEAD;
  if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
    return LinkStatus.BLOCKED;
  }
  if (statusCode >= 400 && statusCode < 500) return LinkStatus.BLOCKED;
  if (statusCode >= 500) return LinkStatus.UNKNOWN;
  return LinkStatus.UNKNOWN;
}

/**
 * 链接检测策略接口
 */
export interface LinkDetectionStrategy {
  name: string;
  priority: number;
  canHandle(url: string): boolean;
  detect(bookmark: Bookmark, options: LinkDetectionOptions): Promise<EnhancedLinkCheckResult>;
}

/**
 * 链接检测选项
 */
export interface LinkDetectionOptions {
  timeout: number;
  maxRedirects: number;
  followRedirects: boolean;
  checkContent: boolean;
  validateSSL: boolean;
  userAgent?: string;
  headers?: Record<string, string>;
}

/**
 * HTTP策略 - 使用fetch进行完整HTTP检测
 */
export class HttpDetectionStrategy implements LinkDetectionStrategy {
  name = 'http';
  priority = 1;

  canHandle(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  async detect(bookmark: Bookmark, options: LinkDetectionOptions): Promise<EnhancedLinkCheckResult> {
    const startTime = Date.now();
    const redirectChain: string[] = [bookmark.url];
    let currentUrl = bookmark.url;
    let redirectCount = 0;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout);

      const response = await fetch(currentUrl, {
        method: 'GET',
        signal: controller.signal,
        redirect: options.followRedirects ? 'follow' : 'manual',
        headers: {
          'User-Agent': options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      // 处理重定向
      if (response.redirected) {
        redirectChain.push(response.url);
        currentUrl = response.url;
      }

      const status = response.ok
        ? LinkStatus.ACTIVE
        : mapHttpStatusToLinkStatus(response.status);

      // 获取内容信息
      const contentType = response.headers.get('content-type') || undefined;
      const lastModified = response.headers.get('last-modified') || undefined;
      const serverInfo = response.headers.get('server') || undefined;

      // SSL信息（仅HTTPS）
      let sslInfo;
      if (currentUrl.startsWith('https://')) {
        sslInfo = {
          valid: response.ok, // 简化的SSL验证
          issuer: 'Unknown',
          expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 // 默认1年后过期
        };
      }

      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        finalUrl: currentUrl !== bookmark.url ? currentUrl : undefined,
        status,
        responseTime,
        statusCode: response.status,
        redirectChain: redirectChain.length > 1 ? redirectChain : undefined,
        contentType,
        lastModified,
        serverInfo,
        sslInfo,
        checkedAt: Date.now(),
        method: 'http'
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          bookmarkId: bookmark.id,
          url: bookmark.url,
          status: LinkStatus.TIMEOUT,
          error: '请求超时',
          responseTime: Date.now() - startTime,
          checkedAt: Date.now(),
          method: 'http'
        };
      }
      
      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        status: LinkStatus.UNKNOWN,
        error: error instanceof Error ? error.message : '网络错误',
        responseTime: Date.now() - startTime,
        checkedAt: Date.now(),
        method: 'http'
      };
    }
  }
}

/**
 * HEAD请求策略 - 轻量级检测
 */
export class HeadDetectionStrategy implements LinkDetectionStrategy {
  name = 'head';
  priority = 2;

  canHandle(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  async detect(bookmark: Bookmark, options: LinkDetectionOptions): Promise<EnhancedLinkCheckResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout);

      const response = await fetch(bookmark.url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors',
        headers: {
          'User-Agent': options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      const status =
        response.ok || response.status === 0
          ? LinkStatus.ACTIVE
          : mapHttpStatusToLinkStatus(response.status);

      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        status,
        responseTime,
        statusCode: response.status,
        contentType: response.headers.get('content-type') || undefined,
        lastModified: response.headers.get('last-modified') || undefined,
        serverInfo: response.headers.get('server') || undefined,
        checkedAt: Date.now(),
        method: 'head'
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          bookmarkId: bookmark.id,
          url: bookmark.url,
          status: LinkStatus.TIMEOUT,
          error: '请求超时',
          responseTime: Date.now() - startTime,
          checkedAt: Date.now(),
          method: 'head'
        };
      }

      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        status: LinkStatus.UNKNOWN,
        error: error instanceof Error ? error.message : '网络错误',
        responseTime: Date.now() - startTime,
        checkedAt: Date.now(),
        method: 'head'
      };
    }
  }
}

/**
 * 内容脚本策略 - 通过标签页检测
 */
export class ContentScriptDetectionStrategy implements LinkDetectionStrategy {
  name = 'content';
  priority = 3;

  canHandle(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  async detect(bookmark: Bookmark, options: LinkDetectionOptions): Promise<EnhancedLinkCheckResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout);

      // 使用GET请求获取页面内容进行分析
      const response = await fetch(bookmark.url, {
        method: 'GET',
        signal: controller.signal,
        redirect: options.followRedirects ? 'follow' : 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        mode: 'cors'
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          bookmarkId: bookmark.id,
          url: bookmark.url,
          status: mapHttpStatusToLinkStatus(response.status),
          responseTime,
          statusCode: response.status,
          checkedAt: Date.now(),
          method: 'content'
        };
      }

      // 分析响应内容
      const text = await response.text();
      const finalUrl = response.url !== bookmark.url ? response.url : undefined;
      
      // 内容分析
      const contentAnalysis = {
        hasHtmlStructure: /<html[^>]*>/i.test(text) || /<!DOCTYPE/i.test(text),
        hasContent: text.trim().length > 100,
        has404Indicators: /404|not found|page not found/i.test(text),
        hasErrorIndicators: /error|错误|失败|服务器错误|server error/i.test(text),
        isEmpty: text.trim().length < 50,
        contentLength: text.length
      };

      // 判断页面状态
      let status: LinkStatus;
      if (contentAnalysis.has404Indicators) {
        status = LinkStatus.DEAD;
      } else if (contentAnalysis.hasErrorIndicators || contentAnalysis.isEmpty) {
        status = LinkStatus.UNKNOWN;
      } else if (contentAnalysis.hasHtmlStructure && contentAnalysis.hasContent) {
        status = LinkStatus.ACTIVE;
      } else if (contentAnalysis.hasContent) {
        // 有内容但不是标准HTML，可能是API或其他类型的响应
        status = LinkStatus.ACTIVE;
      } else {
        status = LinkStatus.UNKNOWN;
      }

      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        finalUrl,
        status,
        responseTime,
        statusCode: response.status,
        contentType: response.headers.get('content-type') || undefined,
        checkedAt: Date.now(),
        method: 'content'
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          bookmarkId: bookmark.id,
          url: bookmark.url,
          status: LinkStatus.TIMEOUT,
          error: '请求超时',
          responseTime: Date.now() - startTime,
          checkedAt: Date.now(),
          method: 'content'
        };
      }
      
      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        status: LinkStatus.UNKNOWN,
        error: error instanceof Error ? error.message : '内容检测失败',
        responseTime: Date.now() - startTime,
        checkedAt: Date.now(),
        method: 'content'
      };
    }
  }
}

/**
 * 域名解析策略 - 基础连通性检测
 */
export class DomainResolutionStrategy implements LinkDetectionStrategy {
  name = 'domain';
  priority = 4;

  canHandle(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  async detect(bookmark: Bookmark, options: LinkDetectionOptions): Promise<EnhancedLinkCheckResult> {
    const startTime = Date.now();

    try {
      const domain = this.extractDomain(bookmark.url);
      
      // 使用Google的favicon服务检测域名可达性
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout);

      const response = await fetch(faviconUrl, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      const status = response.ok ? LinkStatus.ACTIVE : LinkStatus.UNKNOWN;

      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        status,
        responseTime,
        statusCode: response.status,
        checkedAt: Date.now(),
        method: 'domain'
      };
    } catch (error) {
      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        status: LinkStatus.UNKNOWN,
        error: error instanceof Error ? error.message : '域名检测失败',
        responseTime: Date.now() - startTime,
        checkedAt: Date.now(),
        method: 'domain'
      };
    }
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }
}

/**
 * 多策略检测引擎
 */
export class MultiStrategyDetectionEngine {
  private strategies: LinkDetectionStrategy[];

  constructor() {
    this.strategies = [
      new HttpDetectionStrategy(),
      new HeadDetectionStrategy(),
      new ContentScriptDetectionStrategy(),
      new DomainResolutionStrategy()
    ].sort((a, b) => a.priority - b.priority);
  }

  /**
   * 使用多策略检测链接
   */
  async detectWithStrategies(
    bookmark: Bookmark,
    options: LinkDetectionOptions,
    maxStrategies: number = 2
  ): Promise<EnhancedLinkCheckResult> {
    const applicableStrategies = this.strategies
      .filter(strategy => strategy.canHandle(bookmark.url))
      .slice(0, maxStrategies);

    let bestResult: EnhancedLinkCheckResult | null = null;
    const errors: string[] = [];

    for (const strategy of applicableStrategies) {
      try {
        const result = await strategy.detect(bookmark, options);
        
        // 如果得到明确的活跃状态，直接返回
        if (result.status === LinkStatus.ACTIVE) {
          return result;
        }
        
        // 保存最好的结果（优先级：DEAD > REDIRECT > TIMEOUT > UNKNOWN）
        if (!bestResult || this.isResultBetter(result, bestResult)) {
          bestResult = result;
        }
      } catch (error) {
        errors.push(`${strategy.name}: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    // 如果没有任何结果，返回错误结果
    if (!bestResult) {
      return {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        status: LinkStatus.UNKNOWN,
        error: `所有策略都失败: ${errors.join('; ')}`,
        checkedAt: Date.now(),
        method: 'multi'
      };
    }

    return bestResult;
  }

  /**
   * 判断结果是否更好
   */
  private isResultBetter(current: EnhancedLinkCheckResult, best: EnhancedLinkCheckResult): boolean {
    // 多策略合并时优先「更可能仍可访问」的结果，避免防爬 403 覆盖为 DEAD
    const reachabilityPriority = {
      [LinkStatus.ACTIVE]: 8,
      [LinkStatus.REDIRECT]: 7,
      [LinkStatus.BLOCKED]: 6,
      [LinkStatus.UNKNOWN]: 5,
      [LinkStatus.TIMEOUT]: 4,
      [LinkStatus.CHECKING]: 3,
      [LinkStatus.PENDING]: 2,
      [LinkStatus.DEAD]: 1
    };

    return reachabilityPriority[current.status] > reachabilityPriority[best.status];
  }

  /**
   * 获取可用策略
   */
  getAvailableStrategies(): string[] {
    return this.strategies.map(s => s.name);
  }
}

export default MultiStrategyDetectionEngine;