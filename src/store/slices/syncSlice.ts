export function createSyncSlice(
  set: (partial: any) => void,
  get: () => any
) {
  return {
    getChromeBookmarks: async () => {
      set({ isLoading: true, error: null });
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_CHROME_BOOKMARKS'
        });

        if (response.success) {
          set({ isLoading: false });
          return response.data;
        } else {
          throw new Error(response.error || '获取Chrome书签失败');
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '获取Chrome书签失败', isLoading: false });
        throw error;
      }
    },

    importChromeBookmarks: async (options: any, selectedFolders: any, onProgress: any) => {
      set({ isLoading: true, error: null });
      try {
        console.log('[store] importChromeBookmarks 发送消息到 background');
        const response = await chrome.runtime.sendMessage({
          type: 'IMPORT_CHROME_BOOKMARKS',
          payload: {
            selectedFolders,
            options,
            onProgress
          }
        });
        console.log('[store] importChromeBookmarks 收到响应:', response);

        if (response.success) {
          console.log('[store] importChromeBookmarks 成功，准备 reload');
          await get().loadBookmarks();
          console.log('[store] importChromeBookmarks reload 完成');
          set({ isLoading: false });
          return response.data;
        } else {
          throw new Error(response.error || '导入Chrome书签失败');
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '导入Chrome书签失败', isLoading: false });
        throw error;
      }
    },

    syncWithChrome: async (options: any) => {
      set({ isLoading: true, error: null });
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'SYNC_CHROME_BOOKMARKS',
          payload: { options }
        });

        if (response.success) {
          await get().loadBookmarks();
          await get().updateSettings({ lastSyncTime: Date.now() });

          set({ isLoading: false });
          return response.data;
        } else {
          throw new Error(response.error || '同步Chrome书签失败');
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '同步Chrome书签失败', isLoading: false });
        throw error;
      }
    },

    exportToChrome: async (bookmarkIds: string[], targetFolderId?: string) => {
      set({ isLoading: true, error: null });
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'EXPORT_TO_CHROME',
          payload: {
            bookmarkIds,
            targetFolderId
          }
        });

        if (response.success) {
          await get().loadBookmarks();
          set({ isLoading: false });
          return response.data;
        } else {
          throw new Error(response.error || '导出到Chrome失败');
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '导出到Chrome失败', isLoading: false });
        throw error;
      }
    },
  };
}
