import type { Bookmark, EnhancedLinkCheckResult, LinkCheckResult } from '../../types/index';
import { toLinkCheckResult } from './bookmarkChecker';
import { runBookmarkBatch } from './batchRunner';
import { mergeLinkCheckOptions } from './constants';
import {
  clearProgressSnapshot,
  restoreProgressSnapshot,
  saveProgressSnapshot
} from './persistence';
import { LinkCheckProgressTracker } from './progressTracker';
import { buildCheckReport } from './reportGenerator';
import type {
  CheckReport,
  EngineCheckProgress,
  DetailedProgress,
  LinkCheckOptions,
  ProgressInfo
} from './types';
import { filterBookmarksToCheck } from './types';

export class LinkCheckEngine {
  private static instance: LinkCheckEngine;

  private readonly tracker = new LinkCheckProgressTracker();
  private checkQueue: Bookmark[] = [];
  private abortController?: AbortController;
  private isProcessing = false;

  private constructor() {}

  public static getInstance(): LinkCheckEngine {
    if (!LinkCheckEngine.instance) {
      LinkCheckEngine.instance = new LinkCheckEngine();
    }
    return LinkCheckEngine.instance;
  }

  async startBatchCheck(
    bookmarks: Bookmark[],
    options: Partial<LinkCheckOptions> = {}
  ): Promise<void> {
    const opts = mergeLinkCheckOptions(options);

    if (this.isProcessing) {
      console.warn('检查已在进行中，忽略重复请求');
      return;
    }

    this.isProcessing = true;

    try {
      if (this.tracker.currentProgress.status === 'running') {
        console.log('检查正在进行中，先停止当前检查');
        this.stopCheck();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const snapshot = await restoreProgressSnapshot();
      const filtered = filterBookmarksToCheck(bookmarks, {
        skipRecentlyChecked: opts.skipRecentlyChecked,
        skipWithinMs: opts.skipWithinMs
      });

      if (!snapshot) {
        this.checkQueue = filtered;
        this.tracker.resetForNewRun(this.checkQueue.length);
        this.tracker.initializeDetailed(opts.maxConcurrent);
      } else {
        console.log('已恢复之前的检测进度，继续检测');
        this.tracker.restore(snapshot);
        this.checkQueue = filtered.slice(snapshot.processedCount);
      }

      this.tracker.currentProgress.status = 'running';
      this.abortController = new AbortController();

      await runBookmarkBatch(
        this.tracker,
        this.checkQueue,
        opts,
        () => this.tracker.currentProgress.status === 'running'
      );

      this.tracker.currentProgress.status = 'completed';
      await clearProgressSnapshot();
    } catch (error) {
      console.error('批量检查失败:', error);
      this.tracker.currentProgress.status = 'error';
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  pauseCheck(): void {
    if (this.tracker.currentProgress.status === 'running') {
      this.tracker.currentProgress.status = 'paused';
      this.abortController?.abort();
    }
  }

  async resumeCheck(): Promise<void> {
    if (this.tracker.currentProgress.status === 'paused') {
      this.tracker.currentProgress.status = 'running';
      this.abortController = new AbortController();
      await runBookmarkBatch(
        this.tracker,
        this.checkQueue,
        mergeLinkCheckOptions(),
        () => this.tracker.currentProgress.status === 'running'
      );
    }
  }

  stopCheck(): void {
    this.tracker.currentProgress.status = 'idle';
    this.abortController?.abort();
    this.checkQueue = [];
    this.isProcessing = false;
  }

  getProgress(): EngineCheckProgress {
    return this.tracker.getProgress();
  }

  getDetailedProgress(): DetailedProgress | null {
    return this.tracker.getDetailedProgress();
  }

  getRecentResults(): LinkCheckResult[] {
    return this.tracker.getRecentResults();
  }

  getProgressInfo(): ProgressInfo {
    return this.tracker.getProgressInfo();
  }

  getResults(): LinkCheckResult[] {
    return this.tracker.checkResults.map(toLinkCheckResult);
  }

  getEnhancedResults(): EnhancedLinkCheckResult[] {
    return [...this.tracker.checkResults];
  }

  generateReport(): CheckReport {
    return buildCheckReport(
      this.tracker.currentProgress,
      this.tracker.checkResults
    );
  }

  async restoreProgressFromStorage(): Promise<boolean> {
    const snapshot = await restoreProgressSnapshot();
    if (!snapshot) return false;

    this.tracker.restore(snapshot);
    return true;
  }

  async clearProgressFromStorage(): Promise<void> {
    await clearProgressSnapshot();
  }
}

export default LinkCheckEngine;
