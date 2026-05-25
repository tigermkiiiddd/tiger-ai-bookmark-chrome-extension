import type { Tag } from '../types/index.js';

/** tagId → 从根到叶的完整路径，如 "漫画/奇幻/魔法" */
export function getTagPathSegments(tagId: string, tags: Tag[]): string[] {
  const tagMap = new Map(tags.map(t => [t.id, t]));
  return getTagPathSegmentsWithMap(tagId, tagMap);
}

export function getTagPathSegmentsWithMap(tagId: string, tagMap: Map<string, Tag>): string[] {
  const path: string[] = [];
  let current = tagMap.get(tagId);
  let safety = 0;
  while (current && safety < 50) {
    path.unshift(current.name);
    if (!current.parentId) break;
    current = tagMap.get(current.parentId);
    safety++;
  }
  return path;
}

export function formatTagPath(tagId: string, tags: Tag[]): string {
  const segments = getTagPathSegments(tagId, tags);
  return segments.length > 0 ? segments.join('/') : tagId;
}

export function formatTagPathWithMap(tagId: string, tagMap: Map<string, Tag>): string {
  const segments = getTagPathSegmentsWithMap(tagId, tagMap);
  return segments.length > 0 ? segments.join('/') : tagId;
}

export function resolveTagPaths(tagIds: string[], tags: Tag[]): string[] {
  return tagIds.map(id => formatTagPath(id, tags));
}

export function getFlatTagDisplayNames(tagIds: string[] | undefined, tagPathById: Map<string, string>): string[] {
  const names = new Set<string>();
  for (const id of tagIds ?? []) {
    const full = tagPathById.get(id);
    if (!full) { names.add(id); continue; }
    for (const segment of full.split('/')) {
      names.add(segment);
    }
  }
  return Array.from(names);
}

/** 预计算所有 tag 的展示路径，供列表/卡片批量渲染 */
export function buildTagPathByIdMap(tags: Tag[]): Map<string, string> {
  const tagMap = new Map(tags.map(t => [t.id, t]));
  const map = new Map<string, string>();
  for (const tag of tags) {
    map.set(tag.id, formatTagPathWithMap(tag.id, tagMap));
  }
  return map;
}
