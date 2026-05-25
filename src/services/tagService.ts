/**
 * Tag 统一抽象层
 * 所有标签操作的唯一入口。对外暴露文本标签接口，对内管理 Tag 实体。
 * Bookmark.tagIds 的翻译、树形结构、统计全部由这里收口。
 */

import { tagStorage } from '../core/storage/tagStorage';
import { bookmarkStorage } from '../core/storage/bookmarks';
import type { Bookmark, Tag, TagTreeNode } from '../types/index';

// ==================== 树形工具 ====================

function buildTagTree(tags: Tag[]): TagTreeNode[] {
  const tagMap = new Map<string, TagTreeNode>();
  const roots: TagTreeNode[] = [];

  // 先建节点
  for (const tag of tags) {
    tagMap.set(tag.id, { ...tag, children: [], level: 1 });
  }

  // 再挂父子关系
  for (const node of tagMap.values()) {
    if (node.parentId && tagMap.has(node.parentId)) {
      const parent = tagMap.get(node.parentId)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function getTagPath(tagId: string, tags: Tag[]): string[] {
  const path: string[] = [];
  const tagMap = new Map(tags.map(t => [t.id, t]));
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

function getDescendantIds(tagId: string, tags: Tag[]): string[] {
  const result: string[] = [];
  function collect(pid: string) {
    for (const tag of tags) {
      if (tag.parentId === pid) {
        result.push(tag.id);
        collect(tag.id);
      }
    }
  }
  collect(tagId);
  return result;
}

// ==================== TagService ====================

export class TagService {
  // ---- CRUD ----

  async getAllTags(): Promise<Tag[]> {
    return tagStorage.getAll();
  }

  async getTagById(id: string): Promise<Tag | null> {
    return tagStorage.getById(id);
  }

  async createTag(name: string, color?: string, parentId?: string): Promise<Tag> {
    const allTags = await tagStorage.getAll();
    const existing = allTags.find(t => t.name === name && t.parentId === parentId);
    if (existing) return existing;
    return tagStorage.create(name, color, parentId);
  }

  async updateTag(id: string, updates: Partial<Omit<Tag, 'id' | 'createdAt'>>): Promise<Tag | null> {
    return tagStorage.update(id, updates);
  }

  async deleteTag(id: string): Promise<void> {
    return tagStorage.delete(id);
  }

  async moveTag(id: string, parentId?: string): Promise<Tag | null> {
    return tagStorage.move(id, parentId);
  }

  async renameTag(id: string, newName: string): Promise<Tag | null> {
    return tagStorage.rename(id, newName);
  }

  // ---- 树形 ----

  async getTagTree(): Promise<TagTreeNode[]> {
    const tags = await tagStorage.getAll();
    return buildTagTree(tags);
  }

  async getTagPath(tagId: string): Promise<string[]> {
    const tags = await tagStorage.getAll();
    return getTagPath(tagId, tags);
  }

  async getTagPathString(tagId: string): Promise<string> {
    const path = await this.getTagPath(tagId);
    return path.join('/');
  }

  async getDescendantIds(tagId: string): Promise<string[]> {
    const tags = await tagStorage.getAll();
    return getDescendantIds(tagId, tags);
  }

  // ---- 翻译（核心） ----

  /** tagId[] → name[] */
  async resolveTagNames(tagIds: string[]): Promise<string[]> {
    const tags = await tagStorage.getAll();
    const map = new Map(tags.map(t => [t.id, t.name]));
    return tagIds.map(id => map.get(id) ?? id);
  }

  /** tagId[] → path[] 如 ["技术/前端/React"] */
  async resolveTagPaths(tagIds: string[]): Promise<string[]> {
    const tags = await tagStorage.getAll();
    return tagIds.map(id => getTagPath(id, tags).join('/'));
  }

  /**
   * 文本标签名 → tagId[]
   * 自动创建不存在的 Tag，返回 tagId 数组。
   * 支持层级路径，如 "技术/前端/React" 会逐级创建父子关系。
   */
  async ensureTagIds(names: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const name of names) {
      const trimmed = name.trim();
      if (!trimmed) continue;

      // 解析层级路径，如 "技术/前端/React"
      const pathParts = trimmed.split('/').map(p => p.trim()).filter(Boolean);
      if (pathParts.length === 0) continue;

      let parentId: string | undefined;
      let currentTag: Tag | null = null;

      for (const part of pathParts) {
        const allTags = await tagStorage.getAll();
        const existing = allTags.find(t => t.name === part && t.parentId === parentId);

        if (existing) {
          currentTag = existing;
        } else {
          currentTag = await tagStorage.create(part, undefined, parentId);
        }
        parentId = currentTag.id;
      }

      if (currentTag) {
        ids.push(currentTag.id);
      }
    }
    return ids;
  }

  /** 根据标签名查找 tagId，找不到返回 null */
  async findTagIdByName(name: string): Promise<string | null> {
    const tag = await tagStorage.findByName(name);
    return tag?.id ?? null;
  }

  // ---- 统计（实时计算） ----

  async getTagCounts(bookmarksOverride?: Bookmark[]): Promise<Map<string, number>> {
    const [bookmarks, tags] = bookmarksOverride
      ? [bookmarksOverride, await tagStorage.getAll()]
      : await Promise.all([
          bookmarkStorage.getBookmarks(),
          tagStorage.getAll(),
        ]);

    const counts = new Map<string, number>();
    for (const tag of tags) {
      counts.set(tag.id, 0);
    }

    for (const bookmark of bookmarks) {
      for (const tagId of bookmark.tagIds || []) {
        counts.set(tagId, (counts.get(tagId) || 0) + 1);
      }
    }

    return counts;
  }

  /** 获取标签云数据 */
  async getTagCloud(limit: number = 50): Promise<Array<{ tagId: string; name: string; count: number; weight: number }>> {
    const counts = await this.getTagCounts();
    const tags = await tagStorage.getAll();

    const entries = tags
      .map(tag => ({
        tagId: tag.id,
        name: tag.name,
        count: counts.get(tag.id) || 0,
      }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const maxCount = entries.length > 0 ? entries[0].count : 1;
    return entries.map(e => ({
      ...e,
      weight: Math.max(0.1, e.count / maxCount),
    }));
  }

  /** 合并同目录下的同名标签（一次性清理） */
  async mergeSameParentDuplicates(): Promise<{ merged: number; details: string[] }> {
    const [tags, bookmarks] = await Promise.all([
      tagStorage.getAll(),
      bookmarkStorage.getBookmarks(),
    ]);

    const groups = new Map<string, Tag[]>();
    for (const t of tags) {
      const key = `${t.name}::${t.parentId ?? ''}`;
      const arr = groups.get(key) || [];
      arr.push(t);
      groups.set(key, arr);
    }

    let mergedCount = 0;
    const details: string[] = [];

    for (const [, group] of groups) {
      if (group.length <= 1) continue;
      group.sort((a, b) => a.createdAt - b.createdAt);
      const survivor = group[0];
      const duplicates = group.slice(1);
      const dupeIds = new Set(duplicates.map(d => d.id));

      // 重挂子标签
      tags.forEach(t => {
        if (dupeIds.has(t.parentId || '')) t.parentId = survivor.id;
      });

      // 转移书签引用
      let bookmarkChanged = false;
      const updatedBookmarks = bookmarks.map(b => {
        const tagIds = b.tagIds || [];
        if (!tagIds.some(tid => dupeIds.has(tid))) return b;
        bookmarkChanged = true;
        const replaced = tagIds.map(tid => dupeIds.has(tid) ? survivor.id : tid);
        return { ...b, tagIds: [...new Set(replaced)] };
      });

      // 保存：移除重复 tag
      const finalTags = tags.filter(t => !dupeIds.has(t.id));
      await tagStorage.replaceAll(finalTags);
      if (bookmarkChanged) {
        await bookmarkStorage.importBookmarks(updatedBookmarks);
      }

      mergedCount += duplicates.length;
      details.push(`合并了 ${duplicates.length} 个重复的 "${survivor.name}"`);
    }

    return { merged: mergedCount, details };
  }

  /** 清理书签上指向已删除 tag 的残留 tagIds，返回清理的书签数 */
  async cleanupOrphanedTagRefs(): Promise<number> {
    const [bookmarks, tags] = await Promise.all([
      bookmarkStorage.getBookmarks(),
      tagStorage.getAll(),
    ]);

    const validIds = new Set(tags.map(t => t.id));
    let changed = false;

    const updated = bookmarks.map(b => {
      const ids = b.tagIds || [];
      const cleaned = ids.filter((tid: string) => validIds.has(tid));
      if (cleaned.length !== ids.length) {
        changed = true;
        return { ...b, tagIds: cleaned };
      }
      return b;
    });

    if (changed) {
      await bookmarkStorage.importBookmarks(updated);
    }

    return changed ? updated.filter((b, i) => (b.tagIds || []).length !== (bookmarks[i].tagIds || []).length).length : 0;
  }

  /** 清理未被任何书签引用的标签 */
  async cleanupUnusedTags(): Promise<number> {
    const [bookmarks, tags] = await Promise.all([
      bookmarkStorage.getBookmarks(),
      tagStorage.getAll(),
    ]);

    const usedIds = new Set<string>();
    for (const b of bookmarks) {
      for (const id of b.tagIds || []) {
        usedIds.add(id);
      }
    }

    const unused = tags.filter(t => !usedIds.has(t.id));
    if (unused.length > 0) {
      await tagStorage.deleteMany(unused.map(t => t.id));
    }
    return unused.length;
  }
}

export const tagService = new TagService();
