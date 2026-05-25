import type { EnhancedLinkCheckResult } from '../../types/index';
import { LinkStatus } from '../../types/index';
import { extractDomain } from '../../utils/url';
import type {
  CheckReport,
  DomainStats,
  EngineCheckProgress,
  Recommendation
} from './types';

export function buildCheckReport(
  progress: EngineCheckProgress,
  results: EnhancedLinkCheckResult[]
): CheckReport {
  const now = Date.now();
  const domainMap = new Map<string, DomainStats>();
  const responseTimeMap = new Map<string, number[]>();

  results.forEach(result => {
    const domain = extractDomain(result.url);
    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        domain,
        total: 0,
        active: 0,
        dead: 0,
        errorRate: 0
      });
    }

    const stats = domainMap.get(domain)!;
    stats.total++;

    if (result.status === LinkStatus.ACTIVE) {
      stats.active++;
    } else if (result.status === LinkStatus.DEAD) {
      stats.dead++;
    }

    if (result.responseTime && result.status === LinkStatus.ACTIVE) {
      if (!responseTimeMap.has(domain)) {
        responseTimeMap.set(domain, []);
      }
      responseTimeMap.get(domain)!.push(result.responseTime);
    }
  });

  const domainAnalysis: DomainStats[] = Array.from(domainMap.values()).map(
    stats => {
      stats.errorRate = stats.total > 0 ? stats.dead / stats.total : 0;

      const responseTimes = responseTimeMap.get(stats.domain);
      if (responseTimes?.length) {
        stats.avgResponseTime =
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      }

      return stats;
    }
  );

  const siteDeadLinks = results.filter(
    r => r.status === LinkStatus.DEAD && r.failureType === 'site_dead'
  ).length;
  const pageDeadLinks = results.filter(
    r =>
      r.status === LinkStatus.DEAD &&
      (r.failureType === 'page_dead' || !r.failureType)
  ).length;

  return {
    timestamp: now,
    totalChecked: progress.completed,
    activeLinks: progress.active,
    deadLinks: progress.dead,
    siteDeadLinks,
    pageDeadLinks,
    errorLinks: progress.errors,
    duration: now - progress.startTime,
    domainAnalysis,
    suggestions: generateSuggestions(domainAnalysis, results)
  };
}

function generateSuggestions(
  domainAnalysis: DomainStats[],
  results: EnhancedLinkCheckResult[]
): Recommendation[] {
  const suggestions: Recommendation[] = [];

  const highErrorDomains = domainAnalysis.filter(
    stats => stats.errorRate > 0.5 && stats.total > 1
  );

  if (highErrorDomains.length > 0) {
    suggestions.push({
      type: 'cleanup',
      message: `发现 ${highErrorDomains.length} 个域名的失效率超过50%，建议清理相关书签`,
      affectedUrls: highErrorDomains.map(d => d.domain),
      priority: 'high',
      action: 'review-domain-bookmarks'
    });
  }

  const deadResults = results.filter(r => r.status === LinkStatus.DEAD);
  if (deadResults.length > results.length * 0.1) {
    suggestions.push({
      type: 'cleanup',
      message: `发现 ${deadResults.length} 个失效链接，建议进行批量清理`,
      affectedUrls: deadResults.map(r => r.url),
      priority: 'medium',
      action: 'batch-delete-dead-links'
    });
  }

  const timeoutResults = results.filter(r => r.status === LinkStatus.TIMEOUT);
  if (timeoutResults.length > 0) {
    suggestions.push({
      type: 'verify',
      message: `有 ${timeoutResults.length} 个链接检查超时，建议手动验证`,
      affectedUrls: timeoutResults.map(r => r.url),
      priority: 'low',
      action: 'manual-verify'
    });
  }

  return suggestions;
}
