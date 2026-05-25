import type {
  Bookmark,
  EnhancedLinkCheckResult,
  LinkCheckResult
} from '../../types/index';
import { LinkStatus } from '../../types/index';
import {
  MultiStrategyDetectionEngine,
  type LinkDetectionOptions
} from '../linkDetectionStrategies';
import { mergeLinkCheckOptions } from './constants';
import type { LinkCheckOptions } from './types';

const detectionEngine = new MultiStrategyDetectionEngine();

export function toDetectionOptions(
  options: LinkCheckOptions
): LinkDetectionOptions {
  return {
    timeout: options.timeout,
    maxRedirects: 5,
    followRedirects: true,
    checkContent: options.useMultipleStrategies,
    validateSSL: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };
}

export async function checkBookmark(
  bookmark: Bookmark,
  detectionOptions: LinkDetectionOptions,
  checkOptions: LinkCheckOptions
): Promise<EnhancedLinkCheckResult> {
  try {
    const maxStrategies = checkOptions.useMultipleStrategies ? 3 : 1;
    return await detectionEngine.detectWithStrategies(
      bookmark,
      detectionOptions,
      maxStrategies
    );
  } catch (error) {
    return {
      bookmarkId: bookmark.id,
      url: bookmark.url,
      status: LinkStatus.UNKNOWN,
      error: error instanceof Error ? error.message : '检测失败',
      checkedAt: Date.now(),
      method: 'multi'
    };
  }
}

export function createErrorResult(
  bookmark: Bookmark,
  error: unknown
): EnhancedLinkCheckResult {
  return {
    bookmarkId: bookmark.id,
    url: bookmark.url,
    status: LinkStatus.UNKNOWN,
    error: error instanceof Error ? error.message : String(error) || '检查失败',
    checkedAt: Date.now(),
    method: 'head'
  };
}

export function syntheticBookmark(url: string, id?: string): Bookmark {
  const bookmarkId = id ?? `url-check-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id: bookmarkId,
    url,
    title: url,
    tagIds: [],
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export async function checkUrl(
  url: string,
  options?: Partial<LinkCheckOptions>
): Promise<EnhancedLinkCheckResult> {
  const opts = mergeLinkCheckOptions(options);
  const bookmark = syntheticBookmark(url);
  return checkBookmark(bookmark, toDetectionOptions(opts), opts);
}

export function linkStatusToResultStatus(
  status: LinkStatus
): LinkCheckResult['status'] {
  switch (status) {
    case LinkStatus.ACTIVE:
      return 'active';
    case LinkStatus.DEAD:
      return 'dead';
    case LinkStatus.TIMEOUT:
      return 'timeout';
    default:
      return 'unknown';
  }
}

export function toLinkCheckResult(
  result: EnhancedLinkCheckResult
): LinkCheckResult {
  return {
    bookmarkId: result.bookmarkId,
    url: result.url,
    status: linkStatusToResultStatus(result.status),
    failureType: result.failureType,
    responseTime: result.responseTime,
    statusCode: result.statusCode,
    error: result.error,
    checkedAt: result.checkedAt,
    method: result.method
  };
}
