import type { Category } from '../../types/index';
import type { StorageService } from '../../services/storage';
import { DEFAULT_CATEGORIES } from '../../constants/index';
import { getDescendants } from '../../utils/categoryTreeBuilder';
import { mergeWithFilteredBookmarks } from './filterActions';
import { preserveIdentities } from '../../utils/identityCache';

export function createCategoryActions(
  set: (partial: any) => void,
  get: () => any,
  storageService: StorageService
) {
  return {
    loadCategories: async () => {
      const state = get();
      if (state.categories && state.categories.length > 0) {
        return;
      }

      try {
        let categories = await storageService.getCategories();
        categories = categories.filter((c: Category) =>
          c && typeof c.id === 'string' && typeof c.name === 'string'
        );

        if (!categories || categories.length === 0) {
          await Promise.all(
            DEFAULT_CATEGORIES.map((defaultCat) => {
              const category: Category = {
                id: `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: defaultCat.name,
                color: defaultCat.color,
                icon: defaultCat.icon,
                parentId: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              return storageService.addCategory(category);
            })
          );
          categories = await storageService.getCategories();
        }

        const stableCategories = preserveIdentities(get().categories, categories);
        set(mergeWithFilteredBookmarks(get(), { categories: stableCategories }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '加载分类失败' });
      }
    },

    createCategory: async (name: string, icon?: string): Promise<string> => {
      try {
        const category: Category = {
          id: `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name,
          icon: icon || '📁',
          color: '#6b7280',
          parentId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storageService.addCategory(category);
        const state = get();
        set(mergeWithFilteredBookmarks(get(), { categories: [...state.categories, category] }));
        return category.id;
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '添加分类失败' });
        throw error;
      }
    },

    createSubCategory: async (parentId: string, name: string, icon?: string) => {
      try {
        const subCategory: Category = {
          id: `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name,
          icon: icon || '📁',
          color: '#9ca3af',
          parentId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storageService.addCategory(subCategory);
        const state = get();
        set(mergeWithFilteredBookmarks(get(), { categories: [...state.categories, subCategory] }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '创建子分类失败' });
        throw error;
      }
    },

    updateCategory: async (categoryId: string, updates: Partial<Category>) => {
      try {
        const updatedCategory = await storageService.updateCategory(categoryId, updates);
        const state = get();
        const updatedCategoryStats = await storageService.getCategoryStats();
        set(mergeWithFilteredBookmarks(get(), {
          categories: state.categories.map((c: Category) =>
            c.id === categoryId ? updatedCategory : c
          ),
          bookmarks: state.bookmarks,
          categoryStats: updatedCategoryStats,
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '更新分类失败' });
        throw error;
      }
    },

    moveCategory: async (categoryId: string, newParentId: string | null) => {
      if (newParentId) {
        let check: string | null | undefined = newParentId;
        let safety = 0;
        while (check && safety < 20) {
          if (check === categoryId) return;
          const cat = get().categories.find((c: Category) => c.id === check);
          check = cat?.parentId;
          safety++;
        }
      }
      try {
        await storageService.updateCategory(categoryId, { parentId: newParentId });
        const state = get();
        set(mergeWithFilteredBookmarks(get(), {
          categories: state.categories.map((c: Category) =>
            c.id === categoryId ? { ...c, parentId: newParentId, updatedAt: Date.now() } : c
          ),
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '移动分类失败' });
      }
    },

    deleteCategory: async (id: string) => {
      try {
        const state = get();
        const categoryToDelete = state.categories.find((c: Category) => c.id === id);
        if (!categoryToDelete) throw new Error('分类不存在');

        const descendants = getDescendants(id, state.categories);
        if (descendants.length > 0) {
          const confirmMessage = `分类 "${categoryToDelete.name}" 包含 ${descendants.length} 个子分类，删除后子分类也将被删除。确定要继续吗？`;
          if (!confirm(confirmMessage)) return;
        }

        const idsToDelete = new Set([id, ...descendants.map((d: Category) => d.id)]);
        const updatedBookmarks = state.bookmarks.map((b: any) =>
          b.categoryId && idsToDelete.has(b.categoryId)
            ? { ...b, categoryId: undefined, updatedAt: Date.now() }
            : b
        );

        await storageService.deleteCategory(id);
        for (const child of descendants) {
          await storageService.deleteCategory(child.id);
        }

        set(mergeWithFilteredBookmarks(get(), {
          categories: state.categories.filter((c: Category) => !idsToDelete.has(c.id)),
          bookmarks: updatedBookmarks,
        }));
        get().loadBookmarks();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '删除分类失败' });
      }
    },
  };
}
