import { StorageService } from '../../services/storage';
import { chromeStorage } from '../../core/storage/chrome';
import { tagService } from '../../services/tagService';
import { resolveCategoryByName } from '../../utils/categoryTreeBuilder';
import {
  clearBookmarkArchivedPatch,
  isBookmarkArchived,
} from '../../utils/bookmarkArchive';
import { generateId } from '../../constants/index';
import { settingsInitialState } from './settingsSlice';
import { mergeWithFilteredBookmarks } from '../actions/filterActions';
import { preserveIdentities, bookmarkEquals } from '../../utils/identityCache';

const storageService = StorageService.getInstance();

export const bookmarkInitialState = {
  bookmarks: [] as any[],
  filteredBookmarks: [] as any[],
  tagStats: {} as Record<string, number>,
  categoryStats: {} as Record<string, number>,
};

export function createBookmarkSlice(
  set: (partial: any) => void,
  get: () => any
) {
  let orphanCleanupDone = false;
  return {
    loadBookmarks: async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) {
        set({ isLoading: true, error: null });
      }
      try {
        console.log('[store] loadBookmarks 开始读取...');
        const bookmarks = await storageService.getBookmarks();
        console.log('[store] loadBookmarks 读取到书签数:', bookmarks.length);
        const tagStats = await storageService.getTagStats(bookmarks);
        const categoryStats = await storageService.getCategoryStats(bookmarks);

        const stableBookmarks = preserveIdentities(get().bookmarks, bookmarks, bookmarkEquals);

        set(mergeWithFilteredBookmarks(get(), {
          bookmarks: stableBookmarks,
          tagStats,
          categoryStats,
          ...(silent ? {} : { isLoading: false }),
        }));

        if (!orphanCleanupDone) {
          orphanCleanupDone = true;
          tagService.cleanupOrphanedTagRefs().then(count => {
            if (count > 0) get().loadBookmarks({ silent: true });
          });
        }
        get().migrateCategoryData();
      } catch (error) {
        console.error('加载书签失败:', error);
        set({
          error: error instanceof Error ? error.message : '加载书签失败',
          ...(silent ? {} : { isLoading: false })
        });
      }
    },

    migrateCategoryData: async () => {
      try {
        const migrationFlag = await chromeStorage.get<{ categoryMigrationDone?: boolean }>('categoryMigrationDone');
        if (migrationFlag.categoryMigrationDone) return;

        const state = get();
        const bookmarks = state.bookmarks;
        const categories = state.categories;

        const needsMigration = bookmarks.some((b: any) => b.category && !b.categoryId);
        if (!needsMigration) {
          await chromeStorage.set({ categoryMigrationDone: true });
          return;
        }

        console.log('开始 category → categoryId 迁移...');

        let migrated = 0;
        const updatedBookmarks = bookmarks.map((bookmark: any) => {
          if (!bookmark.category || bookmark.categoryId) return bookmark;

          const matched = resolveCategoryByName(bookmark.category, categories);
          if (matched) {
            migrated++;
            return { ...bookmark, categoryId: matched.id };
          }

          return bookmark;
        });

        if (migrated > 0) {
          await chromeStorage.set({ bookmarks: updatedBookmarks });
          set(mergeWithFilteredBookmarks(get(), { bookmarks: updatedBookmarks }));
          console.log(`迁移完成：${migrated} 个书签已迁移`);
        }

        await chromeStorage.set({ categoryMigrationDone: true });
      } catch (error) {
        console.error('分类迁移失败:', error);
      }
    },

    addBookmark: async (bookmarkData: any) => {
      set({ isLoading: true, error: null });
      try {
        const existingBookmark = await storageService.getBookmarkByUrl(bookmarkData.url);

        if (existingBookmark) {
          const updates = {
            title: bookmarkData.title,
            description: bookmarkData.description,
            imagePreviewUrl: bookmarkData.imagePreviewUrl,
            imagePreviewKind: bookmarkData.imagePreviewKind,
            tagIds: bookmarkData.tagIds,
            categoryId: bookmarkData.categoryId,
            aiGenerated: bookmarkData.aiGenerated,
            updatedAt: Date.now()
          };

          await storageService.updateBookmark(existingBookmark.id, updates);

          const state = get();
          const updatedBookmarks = state.bookmarks.map((bookmark: any) =>
            bookmark.id === existingBookmark.id ? { ...bookmark, ...updates } : bookmark
          );

          const updatedCategoryStats = await storageService.getCategoryStats();

          set(mergeWithFilteredBookmarks(get(), {
            bookmarks: updatedBookmarks,
            categoryStats: updatedCategoryStats,
            isLoading: false,
          }));

          return { ...existingBookmark, ...updates };
        } else {
          const bookmark = {
            ...bookmarkData,
            id: generateId(),
            createdAt: Date.now(),
            updatedAt: Date.now()
          };

          await storageService.addBookmark(bookmark);

          const state = get();
          const updatedBookmarks = [...state.bookmarks, bookmark];

          const updatedCategoryStats = await storageService.getCategoryStats();

          set(mergeWithFilteredBookmarks(get(), {
            bookmarks: updatedBookmarks,
            categoryStats: updatedCategoryStats,
            isLoading: false,
          }));

          return bookmark;
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '添加书签失败', isLoading: false });
        throw error;
      }
    },

    updateBookmarksBatch: async (updates: Array<{ id: string; patch: Record<string, unknown> }>) => {
      if (updates.length === 0) return;
      set({ error: null });
      try {
        await storageService.batchUpdateBookmarks(
          updates.map(({ id, patch }) => ({ id, data: patch }))
        );

        const state = get();
        const patchById = new Map(updates.map(u => [u.id, u.patch]));
        const updatedBookmarks = state.bookmarks.map((bookmark: any) => {
          const patch = patchById.get(bookmark.id);
          return patch
            ? { ...bookmark, ...patch, updatedAt: Date.now() }
            : bookmark;
        });

        let updatedCategoryStats = state.categoryStats;
        if (updates.some(u => u.patch.categoryId !== undefined)) {
          updatedCategoryStats = await storageService.getCategoryStats();
        }

        set(mergeWithFilteredBookmarks(get(), {
          bookmarks: updatedBookmarks,
          categoryStats: updatedCategoryStats,
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '批量更新书签失败' });
      }
    },

    updateBookmark: async (id: string, updates: any) => {
      await get().updateBookmarksBatch([{ id, patch: updates }]);
    },

    deleteBookmark: async (id: string) => {
      set({ error: null });
      try {
        await storageService.deleteBookmark(id);

        const state = get();
        const updatedBookmarks = state.bookmarks.filter((bookmark: any) => bookmark.id !== id);
        const updatedSelectedBookmarks = state.selectedBookmarks.filter((selectedId: string) => selectedId !== id);

        const updatedCategoryStats = await storageService.getCategoryStats();

        set(mergeWithFilteredBookmarks(get(), {
          bookmarks: updatedBookmarks,
          selectedBookmarks: updatedSelectedBookmarks,
          categoryStats: updatedCategoryStats,
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '删除书签失败' });
      }
    },

    batchDeleteBookmarks: async (ids: string[]) => {
      set({ isLoading: true, error: null });
      try {
        await storageService.batchDeleteBookmarks(ids);

        const state = get();
        const updatedBookmarks = state.bookmarks.filter((bookmark: any) => !ids.includes(bookmark.id));

        const updatedCategoryStats = await storageService.getCategoryStats();

        set(mergeWithFilteredBookmarks(get(), {
          bookmarks: updatedBookmarks,
          selectedBookmarks: [],
          categoryStats: updatedCategoryStats,
          isLoading: false,
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '批量删除失败', isLoading: false });
      }
    },

    clearAllData: async () => {
      set({ isLoading: true, error: null });
      try {
        await storageService.clearAllData();
        set(mergeWithFilteredBookmarks(get(), {
          bookmarks: [],
          tags: [],
          categories: [],
          settings: settingsInitialState.settings,
          searchQuery: '',
          activeFilters: { tags: [], categories: [], status: [] },
          selectedBookmarks: [],
          tagStats: {},
          categoryStats: {},
          isLoading: false,
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '清空数据失败', isLoading: false });
      }
    },

    resetAllArchiveStatus: async () => {
      set({ isLoading: true, error: null });
      try {
        const state = get();
        const toReset = state.bookmarks.filter(isBookmarkArchived);

        if (toReset.length === 0) {
          set({ isLoading: false });
          return 0;
        }

        await storageService.batchUpdateBookmarks(
          toReset.map((b: any) => ({
            id: b.id,
            data: clearBookmarkArchivedPatch(),
          }))
        );

        await get().loadBookmarks();
        set({ isLoading: false, selectedBookmarks: [] });
        return toReset.length;
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : '重置归档状态失败',
        });
        throw error;
      }
    },

    exportData: async () => {
      try {
        const data = await storageService.exportData();
        return JSON.stringify(data, null, 2);
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '导出数据失败' });
        throw error;
      }
    },

    importData: async (jsonData: string) => {
      set({ isLoading: true, error: null });
      try {
        const data = JSON.parse(jsonData);
        await storageService.importData(data);

        await Promise.all([
          get().loadBookmarks(),
          get().loadTags(),
          get().loadCategories(),
          get().loadSettings()
        ]);

        set({ isLoading: false });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '导入数据失败', isLoading: false });
      }
    },

    createCheckpoint: async () => {
      try {
        const data = await storageService.createCheckpoint();
        return JSON.stringify(data, null, 2);
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '创建检查点失败' });
        throw error;
      }
    },

    restoreCheckpoint: async (jsonData: string) => {
      set({ isLoading: true, error: null });
      try {
        const data = JSON.parse(jsonData);
        await storageService.restoreCheckpoint(data);

        await Promise.all([
          get().loadBookmarks(),
          get().loadTags(),
          get().loadCategories(),
          get().loadSettings()
        ]);

        set({ isLoading: false });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '恢复检查点失败', isLoading: false });
      }
    },
  };
}
