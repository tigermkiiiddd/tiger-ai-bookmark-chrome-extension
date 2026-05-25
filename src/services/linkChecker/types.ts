import type { Bookmark, EnhancedLinkCheckResult, LinkCheckResult } from '../../types/index';
import { LinkStatus } from '../../types/index';

export interface LinkCheckOptions {
  maxConcurrent: number;
  timeout: number;
  retryAttempts: number;
  useMultipleStrategies: boolean;
  skipRecentlyChecked: boolean;
  /** 跳过此时间窗口内已检测的书签（毫秒） */
  skipWithinMs?: number;
  /** 保持传入队列顺序，不按域名重排（与列表显示一致） */
  preserveDisplayOrder?: boolean;
}

export type CheckProgressStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface EngineCheckProgress {
  total: number;
  completed: number;
  active: number;
  dead: number;
  errors: number;
  startTime: number;
  status: CheckProgressStatus;
  currentUrl?: string;
  estimatedEndTime?: number;
}

export interface DetailedProgress {
  total: number;
  completed: number;
  active: number;
  dead: number;
  errors: number;
  startTime: number;
  status: CheckProgressStatus;
  currentBatch: number;
  totalBatches: number;
  recentResults: LinkCheckResult[];
  statusDistribution: Record<LinkStatus, number>;
  averageResponseTime: number;
  throughput: number;
}

export interface DomainStats {
  domain: string;
  total: number;
  active: number;
  dead: number;
  errorRate: number;
  avgResponseTime?: number;
}

export interface Recommendation {
  type: string;
  message: string;
  affectedUrls: string[];
  priority: 'high' | 'medium' | 'low';
  action: string;
}

export interface CheckReport {
  timestamp: number;
  totalChecked: number;
  activeLinks: number;
  deadLinks: number;
  siteDeadLinks: number;
  pageDeadLinks: number;
  errorLinks: number;
  duration: number;
  domainAnalysis: DomainStats[];
  suggestions: Recommendation[];
}

export interface ProgressSnapshot {
  currentProgress: EngineCheckProgress;
  detailedProgress: DetailedProgress;
  checkResults: EnhancedLinkCheckResult[];
  processedCount: number;
  totalCount: number;
  lastSavedAt: number;
}

export interface ProgressInfo {
  progress: EngineCheckProgress;
  detailedProgress: DetailedProgress | null;
  recentResults: LinkCheckResult[];
  allResults: LinkCheckResult[];
  currentUrl?: string;
}

export function createEmptyDetailedProgress(): DetailedProgress {
  return {
    total: 0,
    completed: 0,
    active: 0,
    dead: 0,
    errors: 0,
    startTime: Date.now(),
    status: 'idle',
    currentBatch: 0,
    totalBatches: 0,
    recentResults: [],
    statusDistribution: {
      [LinkStatus.ACTIVE]: 0,
      [LinkStatus.DEAD]: 0,
      [LinkStatus.REDIRECT]: 0,
      [LinkStatus.TIMEOUT]: 0,
      [LinkStatus.UNKNOWN]: 0,
      [LinkStatus.PENDING]: 0,
      [LinkStatus.CHECKING]: 0,
      [LinkStatus.BLOCKED]: 0
    },
    averageResponseTime: 0,
    throughput: 0
  };
}

export { filterBookmarksToCheck } from '../../utils/bookmarkQueue';
