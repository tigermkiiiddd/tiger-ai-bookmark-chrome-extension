/**
 * 链接检查门面（生产环境唯一入口）
 *
 * UI / background 请通过本模块调用，不要直接 import LinkCheckEngine。
 * 批量检测：startBatchCheck → LinkCheckEngine
 * 单 URL 检测：checkSingleLink → linkChecker/bookmarkChecker.checkUrl
 */

import type { Bookmark, LinkCheckProgress, LinkCheckResult } from '../../types/index';
import LinkCheckEngine from '../../services/linkChecker/LinkCheckEngine';
import {
  checkUrl,
  toLinkCheckResult
} from '../../services/linkChecker/bookmarkChecker';
import type { LinkCheckOptions as EngineLinkCheckOptions } from '../../services/linkChecker/types';

export type LinkCheckOptions = Partial<EngineLinkCheckOptions>;

export class LinkCheckService {
  private static instance: LinkCheckService;

  public static getInstance(): LinkCheckService {
    if (!LinkCheckService.instance) {
      LinkCheckService.instance = new LinkCheckService();
    }
    return LinkCheckService.instance;
  }

  private get engine(): LinkCheckEngine {
    return LinkCheckEngine.getInstance();
  }

  async startBatchCheck(
    bookmarks: Bookmark[],
    options?: LinkCheckOptions
  ): Promise<void> {
    return this.engine.startBatchCheck(bookmarks, options);
  }

  pauseCheck(): void {
    this.engine.pauseCheck();
  }

  async resumeCheck(): Promise<void> {
    return this.engine.resumeCheck();
  }

  stopCheck(): void {
    this.engine.stopCheck();
  }

  getProgress(): LinkCheckProgress {
    return this.engine.getProgress();
  }

  getProgressInfo() {
    return this.engine.getProgressInfo();
  }

  generateReport() {
    return this.engine.generateReport();
  }

  /** 单 URL 检测（不占用批量进度状态，供将来 API / 脚本使用） */
  async checkSingleLink(
    url: string,
    options?: LinkCheckOptions
  ): Promise<LinkCheckResult> {
    const result = await checkUrl(url, options);
    return toLinkCheckResult(result);
  }
}

export const linkCheckService = LinkCheckService.getInstance();
