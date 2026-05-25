import { screenshotService } from '../../services/screenshotService';
import { notificationManager } from '../../utils/NotificationManager';
import {
  bookmarkNeedsPageScreenshot,
  PAGE_CAPTURE_PREVIEW_PATCH,
} from '../../utils/bookmarkThumbnail';
import {
  isBookmarkArchived,
  markBookmarkArchivedPatch,
} from '../../utils/bookmarkArchive';

export function createScreenshotSlice(
  set: (partial: any) => void,
  get: () => any
) {
  return {
    batchCaptureThumbnails: async (bookmarkIds: string[], options?: { force?: boolean; cooldownHours?: number; extractSEO?: boolean }) => {
      const state = get();
      const byId = new Map(state.bookmarks.map((b: any) => [b.id, b] as [string, any]));
      let bookmarksToCapture = bookmarkIds.map(id => byId.get(id)).filter((b): b is any => !!b);

      if (!options?.force) {
        bookmarksToCapture = bookmarksToCapture.filter((b: any) => bookmarkNeedsPageScreenshot(b));
      }

      const cooldownMs = (options?.cooldownHours ?? 0) * 3600000;
      if (cooldownMs > 0) {
        const now = Date.now();
        bookmarksToCapture = bookmarksToCapture.filter((b: any) => {
          if (!b.imagePreviewUpdatedAt) return true;
          return now - b.imagePreviewUpdatedAt > cooldownMs;
        });
      }

      if (bookmarksToCapture.length === 0) {
        notificationManager.showInfo(
          '没有需要截图的书签',
          options?.force ? '选中的书签列表为空' : '选中的书签都已存在缩略图'
        );
        return;
      }

      set({
        batchScreenshotProgress: {
          isActive: true,
          isPaused: false,
          current: 0,
          total: bookmarksToCapture.length,
          currentBookmark: '',
          successCount: 0,
          failureCount: 0,
          skippedCount: 0,
        }
      });

      const pendingUpdates: Array<{ id: string; patch: Record<string, unknown> }> = [];

      try {
        await screenshotService.captureBatch(
          bookmarksToCapture,
          (progress: any) => {
            set({
              batchScreenshotProgress: {
                ...get().batchScreenshotProgress!,
                current: progress.current,
                total: progress.total,
                currentBookmark: progress.currentTitle,
                successCount: progress.successCount,
                failureCount: progress.failureCount,
                skippedCount: progress.skippedCount
              }
            });
          },
          async (bookmarkId: string, dataUrl: string, seoData?: any) => {
            const currentBookmark = get().bookmarks.find((b: any) => b.id === bookmarkId);

            const patch: Record<string, unknown> = {
              imagePreviewUrl: dataUrl,
              imagePreviewUpdatedAt: Date.now(),
              ...PAGE_CAPTURE_PREVIEW_PATCH,
            };

            if (seoData) {
              if (seoData.description && !currentBookmark?.description) {
                patch.description = seoData.description;
              }
              if (seoData.favicon && !currentBookmark?.favicon) {
                patch.favicon = seoData.favicon;
              }
            }

            pendingUpdates.push({ id: bookmarkId, patch });
          },
          {
            shouldPause: () => !!get().batchScreenshotProgress?.isPaused,
            shouldStop: () => !get().batchScreenshotProgress?.isActive,
          },
          { force: options?.force, extractSEO: options?.extractSEO }
        );

        if (pendingUpdates.length > 0) {
          await get().updateBookmarksBatch(pendingUpdates);
        }

        notificationManager.showSuccess(
          options?.force ? '批量更新截图完成' : '批量截图完成',
          `成功处理 ${bookmarksToCapture.length} 个书签`
        );
      } catch (error) {
        console.error('批量截图失败:', error);
        notificationManager.showError(
          '批量截图失败',
          error instanceof Error ? error.message : '未知错误'
        );
      } finally {
        set({
          batchScreenshotProgress: {
            ...get().batchScreenshotProgress!,
            isActive: false
          },
          selectedBookmarks: []
        });
      }
    },

    refreshBookmarkThumbnail: async (id: string) => {
      const bookmark = get().bookmarks.find((b: any) => b.id === id);
      if (!bookmark) return;
      try {
        const { dataUrl, seoData } = await screenshotService.captureOne(bookmark, { force: true });
        if (dataUrl) {
          const updates: Record<string, unknown> = {
            imagePreviewUrl: dataUrl,
            imagePreviewUpdatedAt: Date.now(),
            status: bookmark.status,
            ...PAGE_CAPTURE_PREVIEW_PATCH,
            ...(isBookmarkArchived(bookmark) ? markBookmarkArchivedPatch() : {}),
          };
          if (seoData?.description && !bookmark.description) {
            updates.description = seoData.description;
          }
          if (seoData?.favicon && !bookmark.favicon) {
            updates.favicon = seoData.favicon;
          }
          await get().updateBookmarksBatch([{ id, patch: updates }]);
        }
      } catch (error) {
        console.error('更新截图失败:', error);
      }
    },

    cancelBatchCapture: () => {
      screenshotService.cancel();
    },
  };
}
