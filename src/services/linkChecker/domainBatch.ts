import type { Bookmark, EnhancedLinkCheckResult } from '../../types/index';
import { LinkStatus } from '../../types/index';
import { extractDomain } from '../../utils/url';

export type DomainProbeState = 'pending' | 'reachable' | 'site_dead';

export interface DomainBatchPlan {
  orderedQueue: Bookmark[];
  domainGroups: Map<string, Bookmark[]>;
}

function urlPathScore(url: string): number {
  try {
    const u = new URL(url);
    const path = u.pathname;
    if (path === '/' || path === '') return 0;
    return path.length;
  } catch {
    return 9999;
  }
}

/** 同域内选路径最短的书签作为站点探测代表 */
export function pickDomainRepresentative(bookmarks: Bookmark[]): Bookmark {
  return [...bookmarks].sort((a, b) => urlPathScore(a.url) - urlPathScore(b.url))[0];
}

/** 按域名分组；默认保持传入顺序（与列表一致），可选按域名聚合并代表 URL 优先 */
export function buildDomainBatchPlan(
  queue: Bookmark[],
  options?: { preserveDisplayOrder?: boolean }
): DomainBatchPlan {
  const domainGroups = new Map<string, Bookmark[]>();

  for (const bookmark of queue) {
    const domain = extractDomain(bookmark.url);
    const group = domainGroups.get(domain);
    if (group) {
      group.push(bookmark);
    } else {
      domainGroups.set(domain, [bookmark]);
    }
  }

  if (options?.preserveDisplayOrder !== false) {
    return { orderedQueue: [...queue], domainGroups };
  }

  const orderedQueue: Bookmark[] = [];
  for (const group of domainGroups.values()) {
    const rep = pickDomainRepresentative(group);
    orderedQueue.push(rep);
    for (const b of group) {
      if (b.id !== rep.id) orderedQueue.push(b);
    }
  }

  return { orderedQueue, domainGroups };
}

export function createInheritedSiteDeadResult(
  bookmark: Bookmark,
  source: EnhancedLinkCheckResult
): EnhancedLinkCheckResult {
  return {
    bookmarkId: bookmark.id,
    url: bookmark.url,
    status: LinkStatus.DEAD,
    failureType: 'site_dead',
    statusCode: source.statusCode,
    error: source.error ?? '站点不可达，已跳过同域其余链接检测',
    checkedAt: Date.now(),
    method: 'domain-skip'
  };
}

export class DomainProbeCache {
  private readonly state = new Map<string, DomainProbeState>();
  private readonly siteDeadSource = new Map<string, EnhancedLinkCheckResult>();

  get(domain: string): DomainProbeState {
    return this.state.get(domain) ?? 'pending';
  }

  markReachable(domain: string): void {
    if (this.state.get(domain) !== 'site_dead') {
      this.state.set(domain, 'reachable');
    }
  }

  markSiteDead(domain: string, source: EnhancedLinkCheckResult): void {
    this.state.set(domain, 'site_dead');
    this.siteDeadSource.set(domain, source);
  }

  shouldSkipCheck(domain: string): boolean {
    return this.state.get(domain) === 'site_dead';
  }

  createSkippedResult(bookmark: Bookmark): EnhancedLinkCheckResult | null {
    const source = this.siteDeadSource.get(extractDomain(bookmark.url));
    if (!source) return null;
    return createInheritedSiteDeadResult(bookmark, source);
  }

  get skippedDomainCount(): number {
    return [...this.state.values()].filter(s => s === 'site_dead').length;
  }
}
