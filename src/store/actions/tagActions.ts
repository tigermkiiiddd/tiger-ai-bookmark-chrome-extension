import type { Tag } from '../../types/index';
import type { StorageService } from '../../services/storage';
import { tagService } from '../../services/tagService';
import { tagStorage } from '../../core/storage/tagStorage';
import { bookmarkStorage } from '../../core/storage/bookmarks';
import { mergeWithFilteredBookmarks } from './filterActions';
import { preserveIdentities } from '../../utils/identityCache';

export function createTagActions(
  set: (partial: any) => void,
  get: () => any,
  storageService: StorageService
) {
  return {
    loadTags: async () => {
      try {
        const tags = await storageService.getTags();
        const stableTags = preserveIdentities(get().tags, tags);
        set(mergeWithFilteredBookmarks(get(), { tags: stableTags }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '加载标签失败' });
      }
    },

    createTag: async (name: string, color?: string) => {
      try {
        const tag: Tag = {
          id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name,
          color: color || '#3B82F6',
          createdAt: Date.now()
        };
        await storageService.addTag(tag);
        const state = get();
        set(mergeWithFilteredBookmarks(get(), { tags: [...state.tags, tag] }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '添加标签失败' });
      }
    },

    updateTag: async (tagId: string, updates: Partial<Tag>) => {
      try {
        const state = get();
        const existingTag = state.tags.find((t: Tag) => t.id === tagId);
        if (!existingTag) throw new Error('标签不存在');

        const updatedTag = { ...existingTag, ...updates };
        await storageService.addTag(updatedTag);
        set(mergeWithFilteredBookmarks(get(), {
          tags: state.tags.map((t: Tag) => t.id === tagId ? updatedTag : t),
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '更新标签失败' });
        throw error;
      }
    },

    deleteTag: async (id: string) => {
      try {
        await storageService.deleteTag(id);
        const state = get();
        const updatedBookmarks = state.bookmarks.map((b: any) => {
          if (!b.tagIds?.includes(id)) return b;
          return { ...b, tagIds: b.tagIds.filter((tid: string) => tid !== id) };
        });
        const updatedTagStats = { ...state.tagStats };
        delete updatedTagStats[id];
        set(mergeWithFilteredBookmarks(get(), {
          tags: state.tags.filter((tag: Tag) => tag.id !== id),
          bookmarks: updatedBookmarks,
          tagStats: updatedTagStats,
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '删除标签失败' });
      }
    },

    renameTag: async (id: string, newName: string) => {
      try {
        const updated = await tagService.renameTag(id, newName);
        if (!updated) throw new Error('标签不存在');
        const state = get();
        set(mergeWithFilteredBookmarks(get(), {
          tags: state.tags.map((t: Tag) => t.id === id ? updated : t),
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '重命名标签失败' });
        throw error;
      }
    },

    moveTag: async (id: string, parentId?: string) => {
      try {
        const updated = await tagService.moveTag(id, parentId);
        if (!updated) throw new Error('标签不存在');
        const state = get();
        set(mergeWithFilteredBookmarks(get(), {
          tags: state.tags.map((t: Tag) => t.id === id ? updated : t),
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '移动标签失败' });
        throw error;
      }
    },

    cleanupOrphanedTagRefs: async () => {
      try {
        const count = await tagService.cleanupOrphanedTagRefs();
        await get().loadBookmarks();
        return count;
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '清理残留标签引用失败' });
        throw error;
      }
    },

    mergeDuplicateTags: async () => {
      try {
        const result = await tagService.mergeSameParentDuplicates();
        await get().loadTags();
        await get().loadBookmarks();
        return result;
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '合并重复标签失败' });
        throw error;
      }
    },

    mergeTags: async (sourceTagIds: string[], targetTagId: string) => {
      try {
        const state = get();
        for (const bookmark of state.bookmarks) {
          const hasSource = bookmark.tagIds?.some((tid: string) => sourceTagIds.includes(tid));
          if (hasSource) {
            const newTagIds = [...new Set(
              (bookmark.tagIds || [])
                .filter((tid: string) => !sourceTagIds.includes(tid))
                .concat(targetTagId)
            )];
            await get().updateBookmark(bookmark.id, { tagIds: newTagIds });
          }
        }
        await tagStorage.deleteMany(sourceTagIds);
        await tagService.cleanupUnusedTags();
        await get().loadTags();
        await get().loadBookmarks();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '合并标签失败' });
        throw error;
      }
    },

    deleteTags: async (tagIds: string[]) => {
      try {
        if (tagIds.length === 0) return;

        const deletedIds = await tagStorage.deleteMany(tagIds);
        const idSet = new Set(deletedIds);

        const state = get();
        let changed = false;
        const updatedBookmarks = state.bookmarks.map((b: any) => {
          const cleaned = (b.tagIds || []).filter((tid: string) => !idSet.has(tid));
          if (cleaned.length !== (b.tagIds || []).length) {
            changed = true;
            return { ...b, tagIds: cleaned };
          }
          return b;
        });
        if (changed) await bookmarkStorage.importBookmarks(updatedBookmarks);

        const updatedTagStats = { ...state.tagStats };
        for (const tid of idSet) {
          delete updatedTagStats[tid];
        }

        set(mergeWithFilteredBookmarks(get(), {
          tags: state.tags.filter((t: Tag) => !idSet.has(t.id)),
          bookmarks: updatedBookmarks,
          tagStats: updatedTagStats,
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '批量删除标签失败' });
        throw error;
      }
    },
  };
}
