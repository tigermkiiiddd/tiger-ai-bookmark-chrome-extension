/**
 * 兼容旧 import 路径：`import LinkCheckEngine from './services/linkChecker'`
 *
 * 业务代码（background / UI）请使用：
 *   import { linkCheckService } from './core/background/linkCheckService'
 */
export { LinkCheckEngine, default } from './linkChecker/index';
export type {
  CheckReport,
  DomainStats,
  LinkCheckOptions,
  Recommendation
} from './linkChecker/types';
