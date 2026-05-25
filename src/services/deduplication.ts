import type { Bookmark } from '../types/index';

export interface DupGroup {
  id: string;
  type: 'exact' | 'similar';
  normalizedKey: string;
  bookmarks: Bookmark[];
}

export interface DupAnalysisResult {
  exactGroups: DupGroup[];
  similarGroups: DupGroup[];
  stats: {
    totalBookmarks: number;
    duplicateCount: number;
    groupsCount: number;
  };
}

const PAGINATION_PARAMS = new Set([
  'page', 'p', 'pn', 'pg', 'pageno', 'pagenum',
  'currentpage', 'start', 'offset',
]);

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.protocol = 'https';
    u.hostname = u.hostname.replace(/^www\./, '');
    // sort params
    u.searchParams.sort();
    // remove trailing slash (only on path, not root)
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

function stripPaginationParams(url: string): string {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (PAGINATION_PARAMS.has(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }
    u.searchParams.sort();
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function groupBy<K>(items: Bookmark[], keyFn: (b: Bookmark) => K): Map<K, Bookmark[]> {
  const map = new Map<K, Bookmark[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) group.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export function analyzeDuplicates(bookmarks: Bookmark[]): DupAnalysisResult {
  const urlMap = new Map<string, Bookmark>();
  const seen = new Set<string>();

  // Phase 1: exact duplicates (normalized URL identical)
  const exactGroups: DupGroup[] = [];
  const exactMap = groupBy(bookmarks, b => normalizeUrl(b.url));

  for (const [key, group] of exactMap) {
    if (group.length > 1) {
      const id = `exact_${exactGroups.length}`;
      exactGroups.push({ id, type: 'exact', normalizedKey: key, bookmarks: group });
      for (const b of group) seen.add(b.id);
    }
  }

  // Phase 2: similar pages (strip pagination params, but exclude already-found exact dupes)
  const similarGroups: DupGroup[] = [];
  const remaining = bookmarks.filter(b => !seen.has(b.id));
  const similarMap = groupBy(remaining, b => stripPaginationParams(normalizeUrl(b.url)));

  for (const [key, group] of similarMap) {
    if (group.length > 1) {
      const id = `similar_${similarGroups.length}`;
      similarGroups.push({ id, type: 'similar', normalizedKey: key, bookmarks: group });
      for (const b of group) seen.add(b.id);
    }
  }

  const duplicateCount =
    exactGroups.reduce((s, g) => s + g.bookmarks.length, 0) +
    similarGroups.reduce((s, g) => s + g.bookmarks.length, 0);

  return {
    exactGroups,
    similarGroups,
    stats: {
      totalBookmarks: bookmarks.length,
      duplicateCount,
      groupsCount: exactGroups.length + similarGroups.length,
    },
  };
}

export interface SuspectedDuplicateMatch {
  bookmark: Bookmark;
  matchType: 'exact' | 'similar';
}

/** Popup 等非阻塞场景：按当前 URL 查找库中疑似重复书签 */
export function findSuspectedDuplicates(
  targetUrl: string,
  bookmarks: Bookmark[],
  excludeIds: string[] = []
): SuspectedDuplicateMatch[] {
  const trimmed = targetUrl?.trim();
  if (!trimmed) return [];

  const exclude = new Set(excludeIds);
  const normTarget = normalizeUrl(trimmed);
  const normTargetSimilar = stripPaginationParams(normTarget);

  const exact: SuspectedDuplicateMatch[] = [];
  const similar: SuspectedDuplicateMatch[] = [];
  const exactIds = new Set<string>();

  for (const bookmark of bookmarks) {
    if (exclude.has(bookmark.id)) continue;
    const normBookmark = normalizeUrl(bookmark.url);
    if (normBookmark === normTarget) {
      exact.push({ bookmark, matchType: 'exact' });
      exactIds.add(bookmark.id);
    }
  }

  for (const bookmark of bookmarks) {
    if (exclude.has(bookmark.id) || exactIds.has(bookmark.id)) continue;
    const normBookmarkSimilar = stripPaginationParams(normalizeUrl(bookmark.url));
    if (normBookmarkSimilar === normTargetSimilar) {
      similar.push({ bookmark, matchType: 'similar' });
    }
  }

  return [...exact, ...similar];
}
