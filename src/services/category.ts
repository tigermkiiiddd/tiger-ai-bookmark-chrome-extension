/**
 * 分类管理服务
 * 提供分类的增删改查和业务逻辑
 */

import { categoryStorage } from '../core/storage/categories';
import { bookmarkStorage } from '../core/storage/bookmarks';
import type { Category, CreateCategoryData } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';
import { getDescendants, getCategoryPath } from '../utils/categoryTreeBuilder';

export class CategoryService {
  async getAllCategories(): Promise<Category[]> {
    return await categoryStorage.getAll();
  }

  async getCategoryById(id: string): Promise<Category | null> {
    return await categoryStorage.getById(id);
  }

  async getCategoryByName(name: string): Promise<Category | null> {
    return await categoryStorage.getByName(name);
  }

  async createCategory(data: CreateCategoryData): Promise<Category> {
    return await categoryStorage.create(data);
  }

  async updateCategory(id: string, updates: Partial<Omit<Category, 'id' | 'createdAt'>>): Promise<Category> {
    return await categoryStorage.update(id, updates);
  }

  async deleteCategory(id: string): Promise<void> {
    const bookmarks = await bookmarkStorage.getBookmarks();
    const descendants = getDescendants(id, await categoryStorage.getAll());
    const idsToDelete = new Set([id, ...descendants.map(d => d.id)]);

    const bookmarksToUpdate = bookmarks
      .filter(b => b.categoryId && idsToDelete.has(b.categoryId))
      .map(b => ({ ...b, categoryId: undefined, updatedAt: Date.now() }));

    if (bookmarksToUpdate.length > 0) {
      await bookmarkStorage.saveBatch(bookmarksToUpdate as any);
    }

    // 同时删除子分类
    for (const d of descendants) {
      await categoryStorage.delete(d.id);
    }
    await categoryStorage.delete(id);
  }

  async initializeDefaultCategories(): Promise<void> {
    const existingCategories = await categoryStorage.getAll();
    if (existingCategories.length > 0) return;

    const categories: Category[] = DEFAULT_CATEGORIES.map(cat => ({
      id: `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      parentId: null,
      createdAt: Date.now(),
    }));

    await categoryStorage.saveBatch(categories);
  }

  async searchCategories(query: string): Promise<Category[]> {
    const categories = await categoryStorage.getAll();
    const searchTerm = query.toLowerCase();
    return categories.filter(category =>
      category.name.toLowerCase().includes(searchTerm)
    );
  }

  async mergeCategories(sourceId: string, targetId: string): Promise<void> {
    const bookmarks = await bookmarkStorage.getBookmarks();
    const bookmarksToUpdate = bookmarks
      .filter(b => b.categoryId === sourceId)
      .map(b => ({ ...b, categoryId: targetId, updatedAt: Date.now() }));

    if (bookmarksToUpdate.length > 0) {
      await bookmarkStorage.saveBatch(bookmarksToUpdate as any);
    }

    await categoryStorage.delete(sourceId);
  }

  async createCategories(categoriesData: CreateCategoryData[]): Promise<Category[]> {
    const categories: Category[] = [];
    for (const data of categoriesData) {
      try {
        const category = await categoryStorage.create(data);
        categories.push(category);
      } catch (error) {
        console.warn(`创建分类 "${data.name}" 失败:`, error);
      }
    }
    return categories;
  }
}

export const categoryService = new CategoryService();
