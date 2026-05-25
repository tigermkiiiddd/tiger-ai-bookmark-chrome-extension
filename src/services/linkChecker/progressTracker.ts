import type { EnhancedLinkCheckResult, LinkCheckResult } from '../../types/index';
import { LinkStatus } from '../../types/index';
import {
  createEmptyDetailedProgress,
  type EngineCheckProgress,
  type DetailedProgress,
  type ProgressInfo
} from './types';

export class LinkCheckProgressTracker {
  currentProgress: EngineCheckProgress = {
    total: 0,
    completed: 0,
    active: 0,
    dead: 0,
    errors: 0,
    startTime: 0,
    status: 'idle'
  };

  detailedProgress: DetailedProgress = createEmptyDetailedProgress();
  checkResults: EnhancedLinkCheckResult[] = [];

  private processedInCurrentSecond = 0;
  private lastThroughputUpdate = 0;

  resetForNewRun(total: number): void {
    this.checkResults = [];
    this.currentProgress = {
      total,
      completed: 0,
      active: 0,
      dead: 0,
      errors: 0,
      startTime: Date.now(),
      status: 'running'
    };
    this.initializeDetailed(total);
    this.processedInCurrentSecond = 0;
    this.lastThroughputUpdate = Date.now();
  }

  restore(snapshot: {
    currentProgress: EngineCheckProgress;
    detailedProgress: DetailedProgress;
    checkResults: EnhancedLinkCheckResult[];
  }): void {
    this.currentProgress = snapshot.currentProgress;
    this.detailedProgress = {
      ...createEmptyDetailedProgress(),
      ...snapshot.detailedProgress,
      recentResults: Array.isArray(snapshot.detailedProgress?.recentResults)
        ? snapshot.detailedProgress.recentResults
        : [],
      statusDistribution: {
        ...createEmptyDetailedProgress().statusDistribution,
        ...(snapshot.detailedProgress?.statusDistribution ?? {})
      }
    };
    this.checkResults = Array.isArray(snapshot.checkResults)
      ? snapshot.checkResults
      : [];
  }

  initializeDetailed(batchSize: number): void {
    const totalBatches = Math.ceil(
      Math.max(this.currentProgress.total, 1) / batchSize
    );

    this.detailedProgress = {
      total: this.currentProgress.total,
      completed: this.currentProgress.completed,
      active: this.currentProgress.active,
      dead: this.currentProgress.dead,
      errors: this.currentProgress.errors,
      startTime: this.currentProgress.startTime,
      status: this.currentProgress.status,
      currentBatch: 0,
      totalBatches,
      recentResults: [],
      statusDistribution: createEmptyDetailedProgress().statusDistribution,
      averageResponseTime: 0,
      throughput: 0
    };

    this.processedInCurrentSecond = 0;
    this.lastThroughputUpdate = Date.now();
  }

  setCurrentUrl(url: string): void {
    this.currentProgress.currentUrl = url;
  }

  setCurrentBatch(batch: number): void {
    this.detailedProgress.currentBatch = batch;
  }

  recordResult(result: EnhancedLinkCheckResult): void {
    this.checkResults.push(result);
    this.currentProgress.completed++;

    switch (result.status) {
      case LinkStatus.ACTIVE:
        this.currentProgress.active++;
        break;
      case LinkStatus.DEAD:
        this.currentProgress.dead++;
        break;
      default:
        this.currentProgress.errors++;
    }

    this.detailedProgress.statusDistribution[result.status]++;

    const recentEntry: LinkCheckResult = {
      bookmarkId: result.bookmarkId,
      url: result.url,
      status: result.status as LinkCheckResult['status'],
      failureType: result.failureType,
      responseTime: result.responseTime || 0,
      checkedAt: result.checkedAt,
      method: result.method
    };

    this.detailedProgress.recentResults.push(recentEntry);
    if (this.detailedProgress.recentResults.length > 10) {
      this.detailedProgress.recentResults.shift();
    }

    if (result.responseTime) {
      const withTime = this.checkResults.filter(r => r.responseTime);
      const totalResponseTime = withTime.reduce(
        (sum, r) => sum + (r.responseTime || 0),
        0
      );
      this.detailedProgress.averageResponseTime =
        totalResponseTime / withTime.length;
    }

    if (this.currentProgress.completed > 0) {
      const elapsed = Date.now() - this.currentProgress.startTime;
      const avgTime = elapsed / this.currentProgress.completed;
      const remaining =
        this.currentProgress.total - this.currentProgress.completed;
      this.currentProgress.estimatedEndTime = Date.now() + avgTime * remaining;
    }
  }

  updateThroughput(): void {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastThroughputUpdate;

    if (timeSinceLastUpdate >= 1000) {
      this.detailedProgress.throughput = this.processedInCurrentSecond;
      this.processedInCurrentSecond = 0;
      this.lastThroughputUpdate = now;
    } else {
      this.processedInCurrentSecond++;
    }
  }

  getProgress(): EngineCheckProgress {
    return { ...this.currentProgress };
  }

  getDetailedProgress(): DetailedProgress | null {
    return { ...this.detailedProgress };
  }

  getRecentResults(): LinkCheckResult[] {
    const recent = this.detailedProgress.recentResults;
    return Array.isArray(recent) ? [...recent] : [];
  }

  getAllResults(): LinkCheckResult[] {
    return this.checkResults.map(r => ({
      bookmarkId: r.bookmarkId,
      url: r.url,
      status: r.status as LinkCheckResult['status'],
      failureType: r.failureType,
      responseTime: r.responseTime,
      statusCode: r.statusCode,
      error: r.error,
      checkedAt: r.checkedAt,
      method: r.method
    }));
  }

  getProgressInfo(): ProgressInfo {
    return {
      progress: this.getProgress(),
      detailedProgress: this.getDetailedProgress(),
      recentResults: this.getRecentResults(),
      allResults: this.getAllResults(),
      currentUrl: this.currentProgress.currentUrl
    };
  }

  toSnapshot(): {
    currentProgress: EngineCheckProgress;
    detailedProgress: DetailedProgress;
    checkResults: EnhancedLinkCheckResult[];
    processedCount: number;
    totalCount: number;
  } {
    return {
      currentProgress: this.currentProgress,
      detailedProgress: this.detailedProgress,
      checkResults: this.checkResults,
      processedCount: this.currentProgress.completed,
      totalCount: this.currentProgress.total
    };
  }
}
