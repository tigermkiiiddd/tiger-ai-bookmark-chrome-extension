/**
 * Chrome Storage API 封装
 * 底层已迁移至 IndexedDB，保留原接口以保证上层兼容
 */

import { indexedDBStorage } from './indexeddb';

export interface StorageOptions {
  useSync?: boolean;
  namespace?: string;
}

export interface StorageUsage {
  used: number;
  quota: number;
}

export class ChromeStorageService {
  private static instance: ChromeStorageService;
  private defaultOptions: StorageOptions = {
    useSync: false,
    namespace: ''
  };

  private changedListeners: Array<(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void> = [];

  public static getInstance(): ChromeStorageService {
    if (!ChromeStorageService.instance) {
      ChromeStorageService.instance = new ChromeStorageService();
    }
    return ChromeStorageService.instance;
  }

  private constructor() {}

  /**
   * 获取存储数据（底层：IndexedDB）
   */
  async get<T = any>(keys: string | string[] | null, options?: StorageOptions): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      let result = await indexedDBStorage.get(keys);

      if (opts.namespace) {
        result = result[opts.namespace] ?? {};
      }

      return result as T;
    } catch (error) {
      console.error('IndexedDB get error:', error);
      throw new Error(`Failed to get data from IndexedDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 设置存储数据（底层：IndexedDB）
   */
  async set<T extends { [key: string]: any } = any>(items: T, options?: StorageOptions): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      let dataToSet = items;
      if (opts.namespace) {
        dataToSet = { [opts.namespace]: items } as unknown as T;
      }

      await indexedDBStorage.set(dataToSet as Record<string, any>);

      // 触发 change 事件（模拟 chrome.storage.onChanged）
      const changes: { [key: string]: chrome.storage.StorageChange } = {};
      for (const key of Object.keys(items)) {
        changes[key] = {
          newValue: (items as any)[key],
          oldValue: undefined
        };
      }
      this.notifyChanged(changes, opts.useSync ? 'sync' : 'local');
    } catch (error) {
      console.error('IndexedDB set error:', error);
      throw new Error(`Failed to set data to IndexedDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 删除存储数据（底层：IndexedDB）
   */
  async remove(keys: string | string[], options?: StorageOptions): Promise<void> {
    try {
      await indexedDBStorage.remove(keys);
    } catch (error) {
      console.error('IndexedDB remove error:', error);
      throw new Error(`Failed to remove data from IndexedDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 清空存储数据（底层：IndexedDB）
   */
  async clear(options?: StorageOptions): Promise<void> {
    try {
      await indexedDBStorage.clear();
    } catch (error) {
      console.error('IndexedDB clear error:', error);
      throw new Error(`Failed to clear IndexedDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 监听存储变化（模拟实现）
   */
  onChanged(callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void): void {
    this.changedListeners.push(callback);
  }

  /**
   * 移除存储变化监听器
   */
  removeListener(callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void): void {
    const index = this.changedListeners.indexOf(callback);
    if (index !== -1) {
      this.changedListeners.splice(index, 1);
    }
  }

  private notifyChanged(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void {
    for (const listener of this.changedListeners) {
      try {
        listener(changes, areaName);
      } catch (e) {
        console.error('Storage change listener error:', e);
      }
    }
  }

  /**
   * 获取存储使用情况
   */
  async getUsage(): Promise<{ local: StorageUsage; sync: StorageUsage }> {
    try {
      const used = await indexedDBStorage.getBytesInUse();
      // IndexedDB 没有固定配额，使用较大值作为参考
      const quota = 1024 * 1024 * 1024; // 1GB 参考值

      return {
        local: { used, quota },
        sync: { used: 0, quota: 0 }
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const chromeStorage = ChromeStorageService.getInstance();
