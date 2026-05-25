/**
 * Tag 实体存储服务（原生范式）
 * 存储 Tag[] 在 'tags' key 下，废弃旧 tagStats Record 模式
 */

import { chromeStorage } from './chrome';
import { bookmarkStorage } from './bookmarks';
import type { Tag } from '../../types/index';

const STORAGE_KEY = 'tags';

async function getAllTags(): Promise<Tag[]> {
  const result = await chromeStorage.get<{ tags?: Tag[] }>([STORAGE_KEY]);
  return result.tags || [];
}

async function saveTags(tags: Tag[]): Promise<void> {
  await chromeStorage.set({ [STORAGE_KEY]: tags });
}

/** 合并冲突：把源 tag 的子标签、书签引用全部转移到目标 tag，然后删除源 tag */
async function mergeInto(sourceId: string, targetId: string): Promise<void> {
  const tags = await getAllTags();
  // 重挂子标签
  const updated = tags.map(t =>
    t.parentId === sourceId ? { ...t, parentId: targetId } : t
  );
  // 删除源 tag
  const filtered = updated.filter(t => t.id !== sourceId);
  await saveTags(filtered);

  // 转移书签引用
  const bookmarks = await bookmarkStorage.getBookmarks();
  let changed = false;
  const updatedBookmarks = bookmarks.map(b => {
    const tagIds = b.tagIds || [];
    if (!tagIds.includes(sourceId)) return b;
    changed = true;
    const replaced = tagIds.map(tid => tid === sourceId ? targetId : tid);
    return { ...b, tagIds: [...new Set(replaced)] };
  });
  if (changed) {
    await bookmarkStorage.importBookmarks(updatedBookmarks);
  }
}

export const tagStorage = {
  /** 获取所有 Tag 实体 */
  async getAll(): Promise<Tag[]> {
    return getAllTags();
  },

  /** 根据 id 获取单个 Tag */
  async getById(id: string): Promise<Tag | null> {
    const tags = await getAllTags();
    return tags.find(t => t.id === id) || null;
  },

  /** 根据 name 查找 Tag（精确匹配，全局第一个） */
  async findByName(name: string): Promise<Tag | null> {
    const tags = await getAllTags();
    return tags.find(t => t.name === name) || null;
  },

  /** 按完整路径查找 Tag："技术/前端/React" → 逐层 walk */
  async findTagByPath(path: string): Promise<Tag | null> {
    const segments = path.split('/').map(s => s.trim()).filter(Boolean);
    if (segments.length === 0) return null;
    const tags = await getAllTags();
    let parentId: string | undefined;
    let result: Tag | null = null;
    for (const seg of segments) {
      const match = tags.find(t => t.name === seg && t.parentId === parentId);
      if (!match) return null;
      result = match;
      parentId = match.id;
    }
    return result;
  },

  /** 创建 Tag（同目录同名自动去重，返回已有 tag） */
  async create(name: string, color?: string, parentId?: string): Promise<Tag> {
    const tags = await getAllTags();
    const existing = tags.find(t => t.name === name && t.parentId === parentId);
    if (existing) return existing;
    const tag: Tag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name,
      color: color || '#3B82F6',
      parentId,
      createdAt: Date.now(),
    };
    tags.push(tag);
    await saveTags(tags);
    return tag;
  },

  /** 更新 Tag */
  async update(id: string, updates: Partial<Omit<Tag, 'id' | 'createdAt'>>): Promise<Tag | null> {
    const tags = await getAllTags();
    const index = tags.findIndex(t => t.id === id);
    if (index === -1) return null;
    const updated = { ...tags[index], ...updates, updatedAt: Date.now() };
    tags[index] = updated;
    await saveTags(tags);
    return updated;
  },

  /** 删除 Tag，并递归删除其子标签 */
  async delete(id: string): Promise<void> {
    const tags = await getAllTags();
    const idsToDelete = new Set<string>();

    const childrenByParent = new Map<string | undefined, Tag[]>();
    for (const tag of tags) {
      const pid = tag.parentId;
      const arr = childrenByParent.get(pid);
      if (arr) arr.push(tag);
      else childrenByParent.set(pid, [tag]);
    }

    function collectDescendants(pid: string) {
      idsToDelete.add(pid);
      const children = childrenByParent.get(pid);
      if (children) for (const child of children) collectDescendants(child.id);
    }
    collectDescendants(id);

    const filtered = tags.filter(t => !idsToDelete.has(t.id));
    await saveTags(filtered);
  },

  /** 批量删除，返回实际删除的所有 ID（含自动扩展的子孙） */
  async deleteMany(ids: string[]): Promise<string[]> {
    const idSet = new Set(ids);
    const tags = await getAllTags();

    const childrenByParent = new Map<string | undefined, Tag[]>();
    for (const tag of tags) {
      const pid = tag.parentId;
      const arr = childrenByParent.get(pid);
      if (arr) arr.push(tag);
      else childrenByParent.set(pid, [tag]);
    }

    function collectDescendants(pid: string) {
      idSet.add(pid);
      const children = childrenByParent.get(pid);
      if (children) for (const child of children) collectDescendants(child.id);
    }
    ids.forEach(id => collectDescendants(id));

    const filtered = tags.filter(t => !idSet.has(t.id));
    await saveTags(filtered);
    return Array.from(idSet);
  },

  /** 移动标签到新的父节点（冲突时自动合并到同名目标） */
  async move(id: string, parentId: string | undefined): Promise<Tag | null> {
    const tags = await getAllTags();
    const source = tags.find(t => t.id === id);
    if (!source) return null;
    // 检查目标目录下是否已有同名
    const conflict = tags.find(t => t.name === source.name && t.parentId === parentId && t.id !== id);
    if (conflict) {
      await mergeInto(id, conflict.id);
      return conflict;
    }
    return this.update(id, { parentId });
  },

  /** 重命名（冲突时自动合并到同名兄弟） */
  async rename(id: string, newName: string): Promise<Tag | null> {
    const tags = await getAllTags();
    const source = tags.find(t => t.id === id);
    if (!source) return null;
    // 检查同目录下是否已有同名兄弟
    const conflict = tags.find(t => t.name === newName && t.parentId === source.parentId && t.id !== id);
    if (conflict) {
      await mergeInto(id, conflict.id);
      return conflict;
    }
    return this.update(id, { name: newName });
  },

  /** 批量插入标签（用于撤销/恢复） */
  async batchInsert(tagsToInsert: Tag[]): Promise<void> {
    const tags = await getAllTags();
    tags.push(...tagsToInsert);
    await saveTags(tags);
  },

  /** 替换全部标签（用于批量合并清理） */
  async replaceAll(tags: Tag[]): Promise<void> {
    await saveTags(tags);
  },
};
