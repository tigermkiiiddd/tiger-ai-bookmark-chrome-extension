/**
 * 分类存储服务
 * 管理分类的存储和检索
 */

import { chromeStorage } from './chrome';
import type { Category } from '../../types';

export interface CreateCategoryData {
  name: string;
  color?: string;
  icon?: string;
  parentId?: string | null;
}

export class CategoryStorage {
  private readonly STORAGE_KEY = 'categories';

  /**
   * 获取所有分类
   */
  async getAll(): Promise<Category[]> {
    const result = await chromeStorage.get<{ categories?: Category[] }>([this.STORAGE_KEY]);
    return result.categories || [];
  }

  /**
   * 根据ID获取分类
   */
  async getById(id: string): Promise<Category | null> {
    const categories = await this.getAll();
    return categories.find(category => category.id === id) || null;
  }

  /**
   * 根据名称获取分类
   */
  async getByName(name: string): Promise<Category | null> {
    const categories = await this.getAll();
    return categories.find(category => category.name === name) || null;
  }

  /**
   * 创建分类
   */
  async create(data: CreateCategoryData): Promise<Category> {
    const categories = await this.getAll();
    
    // 检查名称是否已存在
    const existing = categories.find(cat => cat.name === data.name);
    if (existing) {
      throw new Error(`分类 "${data.name}" 已存在`);
    }

    const category: Category = {
      id: `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: data.name,
      color: data.color || '#6B7280',
      icon: data.icon || '📁',
      parentId: data.parentId ?? null,
      createdAt: Date.now(),
    };

    categories.push(category);
    await chromeStorage.set({ [this.STORAGE_KEY]: categories });
    
    return category;
  }

  /**
   * 更新分类
   */
  async update(id: string, updates: Partial<Omit<Category, 'id' | 'createdAt' | 'bookmarkCount'>>): Promise<Category> {
    const categories = await this.getAll();
    const index = categories.findIndex(cat => cat.id === id);
    
    if (index === -1) {
      throw new Error(`分类不存在: ${id}`);
    }

    // 如果更新名称，检查是否重复
    if (updates.name && updates.name !== categories[index].name) {
      const existing = categories.find(cat => cat.name === updates.name && cat.id !== id);
      if (existing) {
        throw new Error(`分类名称 "${updates.name}" 已存在`);
      }
    }

    categories[index] = {
      ...categories[index],
      ...updates,
      updatedAt: Date.now()
    };

    await chromeStorage.set({ [this.STORAGE_KEY]: categories });
    return categories[index];
  }

  /**
   * 删除分类
   */
  async delete(id: string): Promise<void> {
    const categories = await this.getAll();
    const filteredCategories = categories.filter(cat => cat.id !== id);
    await chromeStorage.set({ [this.STORAGE_KEY]: filteredCategories });
  }

  /**
   * 统计各分类的书签数量（派生计算）
   */
  async getBookmarkCounts(): Promise<Map<string, number>> {
    const { chromeStorage } = await import('./chrome');
    const result = await chromeStorage.get<{ bookmarks?: any[] }>(['bookmarks']);
    const bookmarks = result.bookmarks || [];
    const counts = new Map<string, number>();
    for (const b of bookmarks) {
      if (b.categoryId) {
        counts.set(b.categoryId, (counts.get(b.categoryId) || 0) + 1);
      }
    }
    return counts;
  }

  /**
   * 批量保存分类（更新已存在的）
   */
  async saveBatch(categories: Category[]): Promise<void> {
    const existing = await this.getAll();
    const categoryMap = new Map(existing.map(c => [c.id, c]));
    for (const category of categories) {
      categoryMap.set(category.id, category);
    }
    await chromeStorage.set({ [this.STORAGE_KEY]: Array.from(categoryMap.values()) });
  }

  /**
   * 获取分类统计信息
   */
  async getStats(): Promise<{
    total: number;
  }> {
    const categories = await this.getAll();
    return { total: categories.length };
  }

  /**
   * 清空所有分类
   */
  async clear(): Promise<void> {
    await chromeStorage.set({ [this.STORAGE_KEY]: [] });
  }
}

// 单例实例
export const categoryStorage = new CategoryStorage();



