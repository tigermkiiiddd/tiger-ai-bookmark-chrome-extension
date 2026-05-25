import { LinkStatus, type EnhancedLinkCheckResult, type LinkFailureType } from '../../types/index';

const SITE_ERROR_PATTERN =
  /failed to fetch|network|dns|name not resolved|refused|unreachable|connection|abort|timed out|timeout|ssl|certificate/i;

/**
 * 将检测结果归为两类失效：站点级 / 页面级。
 * 正常、重定向等非失效返回 null。
 */
export function classifyLinkFailure(
  result: EnhancedLinkCheckResult
): LinkFailureType | null {
  if (result.status === LinkStatus.ACTIVE || result.status === LinkStatus.REDIRECT) {
    return null;
  }

  const code = result.statusCode;

  if (result.status === LinkStatus.TIMEOUT) {
    return 'site_dead';
  }

  if (result.status === LinkStatus.DEAD) {
    if (code === 404 || code === 410) {
      return 'page_dead';
    }
    if (code !== undefined && code >= 500) {
      return 'site_dead';
    }
    if (code === undefined || code === 0) {
      return 'site_dead';
    }
    if (code >= 400 && code < 500) {
      return 'page_dead';
    }
    return 'page_dead';
  }

  if (result.status === LinkStatus.BLOCKED) {
    return null;
  }

  if (result.status === LinkStatus.UNKNOWN) {
    const msg = `${result.error ?? ''}`;
    if (SITE_ERROR_PATTERN.test(msg)) {
      return 'site_dead';
    }
    return null;
  }

  return 'page_dead';
}

export function applyFailureTypeToResult(
  result: EnhancedLinkCheckResult
): EnhancedLinkCheckResult {
  const failureType = classifyLinkFailure(result);
  if (!failureType) {
    return { ...result, failureType: undefined };
  }
  return { ...result, failureType };
}
