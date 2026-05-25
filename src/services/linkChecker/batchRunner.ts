import type { Bookmark, EnhancedLinkCheckResult } from '../../types/index';
import { LinkStatus } from '../../types/index';
import { extractDomain } from '../../utils/url';
import {
  LINK_CHECK_MAX_CONCURRENT,
  PROGRESS_SAVE_EVERY_N,
  PROGRESS_SAVE_INTERVAL_MS
} from './constants';
import { checkBookmark, createErrorResult, toDetectionOptions } from './bookmarkChecker';
import {
  buildDomainBatchPlan,
  DomainProbeCache
} from './domainBatch';
import { DomainConcurrencyGate } from './domainConcurrency';
import { applyFailureTypeToResult } from './failureClassifier';
import {
  saveCheckResultToBookmarks,
  saveProgressSnapshot
} from './persistence';
import type { LinkCheckProgressTracker } from './progressTracker';
import type { LinkCheckOptions } from './types';
import { TaskConcurrencyQueue } from './taskQueue';

function clampConcurrency(requested?: number): number {
  const n = requested ?? LINK_CHECK_MAX_CONCURRENT;
  return Math.min(LINK_CHECK_MAX_CONCURRENT, Math.max(1, n));
}

async function resolveCheckResult(
  bookmark: Bookmark,
  domain: string,
  domainCache: DomainProbeCache,
  gate: DomainConcurrencyGate,
  detectionOptions: ReturnType<typeof toDetectionOptions>,
  options: LinkCheckOptions
): Promise<EnhancedLinkCheckResult> {
  if (domainCache.shouldSkipCheck(domain)) {
    const inherited = domainCache.createSkippedResult(bookmark);
    if (inherited) {
      console.log(`同域跳过检测: ${bookmark.url} (${domain})`);
      return inherited;
    }
  }

  await gate.acquire(domain);
  try {
    if (domainCache.shouldSkipCheck(domain)) {
      const inherited = domainCache.createSkippedResult(bookmark);
      if (inherited) {
        console.log(`同域跳过检测: ${bookmark.url} (${domain})`);
        return inherited;
      }
    }

    let result = await checkBookmark(bookmark, detectionOptions, options);
    result = applyFailureTypeToResult(result);

    if (result.status === LinkStatus.ACTIVE) {
      domainCache.markReachable(domain);
    } else if (result.failureType === 'site_dead') {
      domainCache.markSiteDead(domain, result);
    } else if (result.failureType === 'page_dead') {
      domainCache.markReachable(domain);
    }

    return result;
  } finally {
    gate.release(domain);
  }
}

async function processBookmark(
  bookmark: Bookmark,
  index: number,
  domainCache: DomainProbeCache,
  gate: DomainConcurrencyGate,
  detectionOptions: ReturnType<typeof toDetectionOptions>,
  options: LinkCheckOptions,
  tracker: LinkCheckProgressTracker
): Promise<EnhancedLinkCheckResult> {
  const domain = extractDomain(bookmark.url);
  tracker.setCurrentBatch(index + 1);
  tracker.setCurrentUrl(bookmark.url);

  try {
    return await resolveCheckResult(
      bookmark,
      domain,
      domainCache,
      gate,
      detectionOptions,
      options
    );
  } catch (error) {
    const result = applyFailureTypeToResult(createErrorResult(bookmark, error));
    if (result.failureType === 'site_dead') {
      domainCache.markSiteDead(domain, result);
    }
    return result;
  }
}

export async function runBookmarkBatch(
  tracker: LinkCheckProgressTracker,
  queue: Bookmark[],
  options: LinkCheckOptions,
  shouldContinue: () => boolean,
  onResultSaved?: () => void
): Promise<void> {
  const detectionOptions = toDetectionOptions(options);
  const domainCache = new DomainProbeCache();
  const domainGate = new DomainConcurrencyGate();
  const { orderedQueue } = buildDomainBatchPlan(queue, {
    preserveDisplayOrder: options.preserveDisplayOrder ?? true
  });

  const concurrency = clampConcurrency(options.maxConcurrent);
  const taskQueue = new TaskConcurrencyQueue(concurrency);
  let lastProgressSaveTime = 0;

  const tasks = orderedQueue.map((bookmark, index) =>
    taskQueue.run(async () => {
      if (!shouldContinue()) return;

      const result = await processBookmark(
        bookmark,
        index,
        domainCache,
        domainGate,
        detectionOptions,
        options,
        tracker
      );

      tracker.recordResult(result);
      await saveCheckResultToBookmarks(result);
      onResultSaved?.();

      console.log(
        `已完成检测 ${tracker.currentProgress.completed}/${orderedQueue.length}: ${bookmark.url} - ${result.status}${result.failureType ? ` (${result.failureType})` : ''}`
      );

      tracker.updateThroughput();

      const shouldSaveProgress =
        tracker.currentProgress.completed % PROGRESS_SAVE_EVERY_N === 0 ||
        Date.now() - lastProgressSaveTime > PROGRESS_SAVE_INTERVAL_MS;

      if (shouldSaveProgress) {
        await saveProgressSnapshot(tracker.toSnapshot());
        lastProgressSaveTime = Date.now();
      }
    })
  );

  await Promise.all(tasks);

  if (domainCache.skippedDomainCount > 0) {
    console.log(
      `同域合并: ${domainCache.skippedDomainCount} 个域名判定为站点失效并已跳过其余 URL`
    );
  }

  console.log(
    `链接检测完成: ${orderedQueue.length} 个 URL，队列并发上限 ${concurrency}（FIFO，跨域并行 / 同域串行探测）`
  );
}
