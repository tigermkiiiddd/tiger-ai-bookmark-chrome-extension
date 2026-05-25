/**
 * 同步服务统一导出
 * 提供所有同步服务的统一访问入口
 */

export { ChromeSyncService, chromeSyncService } from './chrome-sync';
export { ConflictResolver, conflictResolver } from './conflict';

// 重新导出类型
export type { ConflictResolutionStrategy } from './conflict';

