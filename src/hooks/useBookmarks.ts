/**
 * 书签相关自定义Hooks
 * 提供书签操作的React Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import { bookmarkStorage } from '../core/storage/bookmarks';
import type { Bookmark, AddBookmarkData, UpdateBookmarkData, SearchQuery } from '../types/index';

export interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  loading: boolean;
  error: string | null;
  addBookmark: (data: AddBookmarkData) => Promise<void>;
  updateBookmark: (id: string, updates: UpdateBookmarkData) => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  batchDeleteBookmarks: (ids: string[]) => Promise<void>;
  searchBookmarks: (query: SearchQuery) => Promise<Bookmark[]>;
  refreshBookmarks: () => Promise<void>;
}

export function useBookmarks(): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载书签
  const loadBookmarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await bookmarkStorage.getBookmarks();
      setBookmarks(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load bookmarks';
      setError(errorMessage);
      console.error('Failed to load bookmarks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 添加书签
  const addBookmark = useCallback(async (data: AddBookmarkData) => {
    setError(null);
    
    try {
      const bookmark: Bookmark = {
        ...data,
        id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'active',
        tagIds: data.tagIds || []
      };
      
      await bookmarkStorage.addBookmark(bookmark);
      setBookmarks(prev => [...prev, bookmark]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add bookmark';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // 更新书签
  const updateBookmark = useCallback(async (id: string, updates: UpdateBookmarkData) => {
    setError(null);
    
    try {
      const updatedBookmark = await bookmarkStorage.updateBookmark(id, updates);
      setBookmarks(prev => prev.map(b => b.id === id ? updatedBookmark : b));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update bookmark';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // 删除书签
  const deleteBookmark = useCallback(async (id: string) => {
    setError(null);
    
    try {
      await bookmarkStorage.deleteBookmark(id);
      setBookmarks(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete bookmark';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // 批量删除书签
  const batchDeleteBookmarks = useCallback(async (ids: string[]) => {
    setError(null);
    
    try {
      await bookmarkStorage.batchDeleteBookmarks(ids);
      setBookmarks(prev => prev.filter(b => !ids.includes(b.id)));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete bookmarks';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // 搜索书签
  const searchBookmarks = useCallback(async (query: SearchQuery) => {
    setError(null);
    
    try {
      return await bookmarkStorage.searchBookmarks(query);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search bookmarks';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // 刷新书签
  const refreshBookmarks = useCallback(async () => {
    await loadBookmarks();
  }, [loadBookmarks]);

  // 初始化加载
  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  return {
    bookmarks,
    loading,
    error,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    batchDeleteBookmarks,
    searchBookmarks,
    refreshBookmarks
  };
}

