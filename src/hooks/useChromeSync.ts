/**
 * Chrome同步相关自定义Hooks
 * 提供Chrome书签同步操作的React Hooks
 */

import { useState, useCallback } from 'react';
import { chromeSyncService } from '../core/sync/chrome-sync';
import type { ChromeBookmark, ChromeSyncResult, SyncOptions } from '../types/index';

export interface UseChromeSyncReturn {
  loading: boolean;
  error: string | null;
  getChromeBookmarks: () => Promise<ChromeBookmark[]>;
  getChromeFolders: () => Promise<ChromeBookmark[]>;
  importBookmarks: (
    chromeBookmarks: ChromeBookmark[],
    options: SyncOptions,
    onProgress?: (progress: { current: number; total: number; bookmark: ChromeBookmark }) => void
  ) => Promise<ChromeSyncResult>;
  exportBookmarks: (bookmarkIds: string[], targetFolderId?: string) => Promise<{ exported: number; errors: number }>;
  syncBookmarks: (options: SyncOptions) => Promise<{
    importResult: ChromeSyncResult;
    exportResult: { exported: number; errors: number };
  }>;
}

export function useChromeSync(): UseChromeSyncReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 设置错误状态
  const setErrorState = useCallback((err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    setError(errorMessage);
    console.error('Chrome sync error:', err);
  }, []);

  // 获取Chrome书签
  const getChromeBookmarks = useCallback(async (): Promise<ChromeBookmark[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const bookmarks = await chromeSyncService.getAllChromeBookmarks();
      return bookmarks;
    } catch (err) {
      setErrorState(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setErrorState]);

  // 获取Chrome文件夹
  const getChromeFolders = useCallback(async (): Promise<ChromeBookmark[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const folders = await chromeSyncService.getChromeBookmarkFolders();
      return folders;
    } catch (err) {
      setErrorState(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setErrorState]);

  // 导入书签
  const importBookmarks = useCallback(async (
    chromeBookmarks: ChromeBookmark[],
    options: SyncOptions,
    onProgress?: (progress: { current: number; total: number; bookmark: ChromeBookmark }) => void
  ): Promise<ChromeSyncResult> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await chromeSyncService.importChromeBookmarks(
        chromeBookmarks,
        options,
        onProgress
      );
      return result;
    } catch (err) {
      setErrorState(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setErrorState]);

  // 导出书签
  const exportBookmarks = useCallback(async (
    bookmarkIds: string[],
    targetFolderId?: string
  ): Promise<{ exported: number; errors: number }> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await chromeSyncService.exportToChrome(bookmarkIds, targetFolderId);
      return result;
    } catch (err) {
      setErrorState(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setErrorState]);

  // 双向同步
  const syncBookmarks = useCallback(async (options: SyncOptions) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await chromeSyncService.syncBookmarks(options);
      return result;
    } catch (err) {
      setErrorState(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setErrorState]);

  return {
    loading,
    error,
    getChromeBookmarks,
    getChromeFolders,
    importBookmarks,
    exportBookmarks,
    syncBookmarks
  };
}

