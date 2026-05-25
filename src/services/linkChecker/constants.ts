import type { LinkCheckOptions } from './types';
import { DEFAULT_SKIP_MS } from '../../utils/linkCheck';

/** 仅链接检测所需配置，避免 background 拉入整份 constants  barrel */
const LINK_CHECK_CONFIG = {
  DEFAULT_TIMEOUT: 10_000,
  RETRY_ATTEMPTS: 2
} as const;

/** 检测任务队列：同时最多执行的任务数（硬上限） */
export const LINK_CHECK_MAX_CONCURRENT = 10;

export const DEFAULT_LINK_CHECK_OPTIONS: LinkCheckOptions = {
  maxConcurrent: LINK_CHECK_MAX_CONCURRENT,
  timeout: LINK_CHECK_CONFIG.DEFAULT_TIMEOUT,
  retryAttempts: LINK_CHECK_CONFIG.RETRY_ATTEMPTS,
  useMultipleStrategies: true,
  skipRecentlyChecked: true,
  skipWithinMs: DEFAULT_SKIP_MS,
  preserveDisplayOrder: true
};

export function mergeLinkCheckOptions(
  partial?: Partial<LinkCheckOptions>
): LinkCheckOptions {
  const merged = { ...DEFAULT_LINK_CHECK_OPTIONS, ...partial };
  if (merged.skipWithinMs == null) {
    merged.skipWithinMs = DEFAULT_LINK_CHECK_OPTIONS.skipWithinMs;
  }
  merged.maxConcurrent = Math.min(
    LINK_CHECK_MAX_CONCURRENT,
    Math.max(1, merged.maxConcurrent ?? LINK_CHECK_MAX_CONCURRENT)
  );
  return merged;
}

export const PROGRESS_SAVE_INTERVAL_MS = 30_000;
export const PROGRESS_SAVE_EVERY_N = 10;
