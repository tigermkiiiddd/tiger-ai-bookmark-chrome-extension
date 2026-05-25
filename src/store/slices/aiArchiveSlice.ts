import { AIService } from '../../services/ai';
import { StorageService } from '../../services/storage';
import { screenshotService } from '../../services/screenshotService';
import { mergeWithFilteredBookmarks } from '../actions/filterActions';
import { tagService } from '../../services/tagService';
import { bookmarkStorage } from '../../core/storage/bookmarks';
import { checkpointManager } from '../../utils/CheckpointManager';
import { notificationManager } from '../../utils/NotificationManager';
import { buildCategoryArchiveContext } from '../../utils/buildCategoryArchiveContext';
import { applyAICategoryFromAnalysis as resolveCategoryIdFromAnalysis } from '../../utils/applyAICategoryFromAnalysis';
import {
  enrichBookmarkWithAI,
  ensureBookmarkThumbnail,
} from '../../utils/bookmarkAiEnrich';
import { PAGE_CAPTURE_PREVIEW_PATCH } from '../../utils/bookmarkThumbnail';
import { BookmarkUnreachableError } from '../../utils/linkCheckBeforeArchive';
import { bookmarkNeedsAiArchiveRun } from '../../utils/aiArchive';
import {
  clearBookmarkArchivedPatch,
  isBookmarkArchived,
  markBookmarkArchivedPatch,
} from '../../utils/bookmarkArchive';

const aiService = AIService.getInstance();
const storageService = StorageService.getInstance();

const MAX_CONCURRENT_ARCHIVE = 4;
const CONCURRENT_STAGGER_MS = 500;

export const aiArchiveInitialState = {
  aiArchiveProgress: {
    isActive: false,
    isPaused: false,
    current: 0,
    total: 0,
    currentBookmark: '',
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
    completedCount: 0,
    errors: [] as any[],
    startTime: 0,
    estimatedTimeRemaining: 0,
    processedIds: [] as string[],
    succeededIds: [] as string[],
    skippedIds: [] as string[],
    processingBookmarkId: [] as string[],
    currentIndex: 0
  },
  batchScreenshotProgress: {
    isActive: false,
    isPaused: false,
    current: 0,
    total: 0,
    currentBookmark: '',
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
  },
  aiArchiveGroomingProgress: {
    isActive: false,
    processed: 0,
    total: 0,
    currentBookmark: '',
    errors: [] as any[]
  },
  lastBatchResult: null as any,
  showRecoveryModal: false,
  recoveryInfo: null as any,
};

async function waitForArchiveControl(
  get: () => any,
  waitMs = 0
): Promise<'continue' | 'stopped'> {
  let remainingMs = waitMs;

  while (true) {
    const progress = get().aiArchiveProgress;
    if (!progress?.isActive) {
      return 'stopped';
    }

    if (!progress.isPaused && remainingMs <= 0) {
      return 'continue';
    }

    const stepMs = progress.isPaused ? 300 : Math.min(300, remainingMs);
    const startedAt = Date.now();
    await new Promise(resolve => setTimeout(resolve, stepMs));
    if (!progress.isPaused) {
      remainingMs -= Date.now() - startedAt;
    }
  }
}

async function applyAICategoryFromAnalysis(
  analysis: any,
  set: (partial: any) => void
): Promise<string | undefined> {
  const categoryId = await resolveCategoryIdFromAnalysis(analysis);
  if (categoryId) {
    const categories = await storageService.getCategories();
    set({ categories });
  }
  return categoryId;
}

export function createAIArchiveSlice(
  set: (partial: any) => void,
  get: () => any
) {
  return {
    analyzeWithAI: async (url: string, content?: string) => {
      const { settings, tags } = get();
      await aiService.initialize(settings);
      const categoryContext = buildCategoryArchiveContext(get());
      return await aiService.analyzeContent(content || url, url, undefined, categoryContext, tags);
    },

    autoTagBookmark: async (id: string, content: string, url: string) => {
      set({ error: null });
      try {
        const { settings, bookmarks } = get();
        await aiService.initialize(settings);

        let bookmark = bookmarks.find((b: any) => b.id === id);
        if (!bookmark) {
          await get().loadBookmarks();
          bookmark = get().bookmarks.find((b: any) => b.id === id);
        }

        let imagePreviewUrl: string | undefined;
        if (bookmark) {
          const withThumbnail = await ensureBookmarkThumbnail(bookmark);
          imagePreviewUrl = withThumbnail.imagePreviewUrl;
        }

        const { tags } = get();
        const categoryContext = buildCategoryArchiveContext(get());
        const tagCounts = await tagService.getTagCounts();
        console.debug('🤖 AI归档开始:', { id, content: content?.substring(0, 100), url });

        const result = await aiService.analyzeContent(content, url, undefined, categoryContext, tags, tagCounts);

        console.debug('🤖 AI分析结果:', {
          tags: result.tags,
          category: result.category,
          categoryDecision: result.categoryDecision,
          categoryReason: result.categoryReason,
          keywords: result.keywords,
          summary: result.summary?.substring(0, 100)
        });

        const categoryId = await applyAICategoryFromAnalysis(result, set);

        const tagIds = await tagService.ensureTagIds(result.tags);
        await get().loadTags();
        await get().updateBookmark(id, {
          tagIds,
          categoryId,
          aiGenerated: result,
          ...(imagePreviewUrl
            ? { imagePreviewUrl, ...PAGE_CAPTURE_PREVIEW_PATCH }
            : {}),
        });

        console.debug('🤖 书签更新完成:', { id, categoryId: get().bookmarks.find((b: any) => b.id === id)?.categoryId });
      } catch (error) {
        console.error('🤖 AI归档失败:', error);
        set({ error: error instanceof Error ? error.message : 'AI分析失败' });
      }
    },

    batchAIArchiveBookmarks: async (ids: string[]) => {
      const { settings, bookmarks, updateBookmark } = get();

      const startTime = Date.now();
      const byId = new Map(bookmarks.map((b: any) => [b.id, b] as [string, any]));
      const allSelectedBookmarks = ids
        .map(id => byId.get(id))
        .filter((b): b is any => !!b);
      const bookmarksToProcess = allSelectedBookmarks.filter((b: any) =>
        bookmarkNeedsAiArchiveRun(b)
      );
      const skippedCount = allSelectedBookmarks.length - bookmarksToProcess.length;

      set({
        error: null,
        aiArchiveProgress: {
          isActive: true,
          isPaused: false,
          current: 0,
          total: bookmarksToProcess.length,
          currentBookmark: '',
          successCount: 0,
          failureCount: 0,
          skippedCount,
          completedCount: 0,
          errors: [],
          startTime,
          estimatedTimeRemaining: 0,
          processedIds: [],
          succeededIds: [],
          skippedIds: [],
          processingBookmarkId: [],
          currentIndex: 0
        },
        lastBatchResult: null,
      });

      if (bookmarksToProcess.length === 0) {
        set({
          lastBatchResult: {
            total: allSelectedBookmarks.length,
            successCount: 0,
            failureCount: 0,
            skippedCount: skippedCount,
            errors: [],
          },
          aiArchiveProgress: {
            isActive: false,
            isPaused: false,
            current: 0,
            total: 0,
            currentBookmark: '',
            successCount: 0,
            failureCount: 0,
            skippedCount: 0,
            completedCount: 0,
            errors: [],
            startTime: 0,
            estimatedTimeRemaining: 0,
            processedIds: [],
            succeededIds: [],
            skippedIds: [],
            processingBookmarkId: [],
            currentIndex: 0
          },
          selectedBookmarks: [],
        });
        return;
      }

      try {
        await aiService.initialize(settings);

        if (!get().aiArchiveProgress?.isActive) {
          return;
        }

        await get().processArchiveQueue(bookmarksToProcess);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred during batch processing.';
        console.error('Batch AI archiving failed:', error);
        set({
          error: message,
          aiArchiveProgress: {
            ...get().aiArchiveProgress!,
            isActive: false,
            failureCount: get().aiArchiveProgress!.failureCount + 1
          },
        });
      }
    },

    processArchiveQueue: async (bookmarksToProcess: any[]) => {
      const state = get();
      const { settings } = state;

      const sessionId = `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      checkpointManager.setSessionId(sessionId);

      let successCount = 0;
      let failureCount = 0;
      let skippedCount = 0;
      const errors: any[] = [];
      const succeededIds: string[] = [];
      const skippedIds: string[] = [];
      const processedIds: string[] = [];
      const processingIds: string[] = [];
      const startTime = Date.now();
      let lastProgressFlush = 0;
      const PROGRESS_THROTTLE_MS = 500;

      const pendingUpdates = new Map<string, Partial<typeof bookmarksToProcess[0]>>();
      const BATCH_FLUSH_SIZE = 10;

      const flushPendingUpdates = async (force = false) => {
        if (!force && pendingUpdates.size < BATCH_FLUSH_SIZE) return;
        if (pendingUpdates.size === 0) return;
        const updates = Array.from(pendingUpdates.entries()).map(([id, data]) => ({ id, data }));
        pendingUpdates.clear();
        await storageService.batchUpdateBookmarks(updates);
      };

      let cachedContext: {
        categories: any[];
        bookmarks: any[];
        categoryContext: any;
        existingTags: any[];
      } | undefined;
      try {
        const categories = await storageService.getCategories();
        const allBookmarks = await bookmarkStorage.getBookmarks();
        const categoryContext = buildCategoryArchiveContext({ categories, bookmarks: allBookmarks });
        const existingTags = await tagService.getAllTags();
        cachedContext = { categories, bookmarks: allBookmarks, categoryContext, existingTags };
      } catch (e) {
        console.warn('构建缓存上下文失败，将逐个构建:', e);
      }

      const addProcessing = (id: string) => {
        processingIds.push(id);
        set({ aiArchiveProgress: { ...get().aiArchiveProgress!, processingBookmarkId: [...processingIds] } });
      };
      const removeProcessing = (id: string) => {
        const idx = processingIds.indexOf(id);
        if (idx !== -1) processingIds.splice(idx, 1);
      };

      const flushProgressStats = (force = false) => {
        const now = Date.now();
        if (!force && now - lastProgressFlush < PROGRESS_THROTTLE_MS) return;
        lastProgressFlush = now;
        const completed = successCount + failureCount + skippedCount;
        set({
          aiArchiveProgress: {
            ...get().aiArchiveProgress!,
            processingBookmarkId: [...processingIds],
            successCount,
            failureCount,
            skippedCount,
            completedCount: completed,
            current: completed,
            errors,
            succeededIds,
            skippedIds,
            processedIds,
            estimatedTimeRemaining: completed > 0
              ? Math.round(((now - startTime) / completed) * (bookmarksToProcess.length - completed) / 1000)
              : 0,
          },
        });
      };

      const processOne = async (bookmark: any) => {
        if (!bookmarkNeedsAiArchiveRun(bookmark)) {
          skippedCount++;
          skippedIds.push(bookmark.id);
          processedIds.push(bookmark.id);
          flushProgressStats(true);
          return;
        }

        const wasArchivedAtStart = isBookmarkArchived(bookmark);
        addProcessing(bookmark.id);
        flushProgressStats();

        try {
          const updates = await get().aiArchiveBookmark(bookmark.id, cachedContext);
          if (!get().aiArchiveProgress?.isActive) {
            removeProcessing(bookmark.id);
            return;
          }
          if (updates) {
            pendingUpdates.set(bookmark.id, updates);
          }
          successCount++;
          succeededIds.push(bookmark.id);
          processedIds.push(bookmark.id);
          await flushPendingUpdates();
        } catch (error) {
          if (error instanceof BookmarkUnreachableError) {
            console.warn(`跳过不可达链接: ${bookmark.title}`, (error as Error).message);
            skippedCount++;
            skippedIds.push(bookmark.id);
            processedIds.push(bookmark.id);
            await flushPendingUpdates(true);
          } else {
            console.error(`处理书签失败: ${bookmark.title}`, error);
            failureCount++;
            processedIds.push(bookmark.id);
            errors.push({
              bookmarkId: bookmark.id,
              bookmarkTitle: bookmark.title,
              message: error instanceof Error ? error.message : '未知错误',
              timestamp: Date.now(),
              retryCount: 0
            });
            if (!wasArchivedAtStart) {
              pendingUpdates.set(bookmark.id, clearBookmarkArchivedPatch());
            }
          }
        } finally {
          removeProcessing(bookmark.id);
          flushProgressStats(true);
        }
      };

      try {
        // 并发池：最多 MAX_CONCURRENT_ARCHIVE 并发，错开 CONCURRENT_STAGGER_MS 启动
        let nextIndex = 0;
        const running = new Set<Promise<void>>();

        const launchNext = async (): Promise<boolean> => {
          // 暂停等待
          while (get().aiArchiveProgress?.isPaused && get().aiArchiveProgress?.isActive) {
            await new Promise(r => setTimeout(r, 200));
          }
          if (!get().aiArchiveProgress?.isActive) return false;
          if (nextIndex >= bookmarksToProcess.length) return false;

          const bookmark = bookmarksToProcess[nextIndex++];
          const p = processOne(bookmark).then(() => { running.delete(p); });
          running.add(p);

          // 每批启动后保存 checkpoint
          if (nextIndex % 10 === 0) {
            await flushPendingUpdates(true);
            await checkpointManager.saveCheckpoint({
              sessionId,
              currentIndex: nextIndex,
              totalBookmarks: bookmarksToProcess.length,
              bookmarkQueue: bookmarksToProcess.slice(nextIndex),
              successCount,
              failureCount,
              skippedCount,
              failedBookmarks: errors,
              startTime,
              isPaused: false
            });
          }
          return true;
        };

        // 初始启动：错开 stagger
        while (nextIndex < MAX_CONCURRENT_ARCHIVE && nextIndex < bookmarksToProcess.length) {
          if (!await launchNext()) break;
          if (nextIndex < MAX_CONCURRENT_ARCHIVE && nextIndex < bookmarksToProcess.length) {
            await new Promise(r => setTimeout(r, CONCURRENT_STAGGER_MS));
          }
        }

        // 持续补充：每当有任务完成就启动新的
        while (running.size > 0) {
          await Promise.race(running);
          if (!get().aiArchiveProgress?.isActive) break;
          while (running.size < MAX_CONCURRENT_ARCHIVE) {
            if (!await launchNext()) break;
            await new Promise(r => setTimeout(r, CONCURRENT_STAGGER_MS));
          }
        }

        await Promise.all(running);
        await flushPendingUpdates(true);

        if (!get().aiArchiveProgress?.isActive) return;

        const duration = Date.now() - startTime;
        const finalResult = {
          total: bookmarksToProcess.length,
          successCount,
          failureCount,
          skippedCount,
          errors,
          duration
        };

        set({
          aiArchiveProgress: {
            ...get().aiArchiveProgress!,
            isActive: false,
            processingBookmarkId: [],
            current: bookmarksToProcess.length,
            successCount,
            failureCount,
            skippedCount,
            completedCount: successCount + failureCount + skippedCount,
            errors
          },
          lastBatchResult: finalResult,
          selectedBookmarks: []
        });

        await checkpointManager.clearCheckpoint();

        if (successCount > 0) {
          notificationManager.showSuccess(
            '批量归档完成',
            `成功处理 ${successCount} 个书签${failureCount > 0 ? `，失败 ${failureCount} 个` : ''}`
          );
        } else if (failureCount > 0) {
          notificationManager.showError(
            '批量归档失败',
            `处理失败 ${failureCount} 个书签`
          );
        }

        await Promise.all([
          get().loadBookmarks({ silent: true }),
          get().loadCategories(),
        ]);

      } catch (error) {
        console.error('批量归档过程中发生错误:', error);

        await flushPendingUpdates(true);

        set({
          aiArchiveProgress: {
            ...get().aiArchiveProgress!,
            isActive: false,
            processingBookmarkId: [],
            failureCount: failureCount + 1
          },
          error: error instanceof Error ? error.message : '批量归档过程中发生未知错误'
        });

        notificationManager.showError(
          '批量归档错误',
          error instanceof Error ? error.message : '处理过程中发生未知错误'
        );

        throw error;
      }
    },

    aiArchiveBookmark: async (id: string, cachedContext?: any) => {
      let bookmark = get().bookmarks.find((b: any) => b.id === id);

      if (!bookmark) {
        await get().loadBookmarks();
        bookmark = get().bookmarks.find((b: any) => b.id === id);
      }

      if (!bookmark) {
        throw new Error(`书签不存在: ${id}`);
      }

      try {
        const updates = await enrichBookmarkWithAI(id, {
          setAiArchived: true,
          cachedContext,
        });

        const state = get();
        const updatedBookmarks = state.bookmarks.map((b: any) =>
          b.id === id
            ? { ...b, ...updates, updatedAt: updates.updatedAt ?? Date.now() }
            : b
        );
        set(mergeWithFilteredBookmarks(get(), { bookmarks: updatedBookmarks }));

        if (updates.categoryId !== undefined) {
          const [categories, categoryStats] = await Promise.all([
            storageService.getCategories(),
            storageService.getCategoryStats(),
          ]);
          set(mergeWithFilteredBookmarks(get(), {
            categories,
            categoryStats,
            bookmarks: get().bookmarks,
          }));
        }

        if (updates.tagIds !== undefined) {
          await get().loadTags();
        }

        return updates;
      } catch (error) {
        console.error('AI归档书签失败:', error);
        throw error;
      }
    },

    startAutoArchive: async () => {
      const state = get();
      const visible = state.getFilteredBookmarks();
      const unprocessedBookmarks = visible.filter((bookmark: any) =>
        bookmarkNeedsAiArchiveRun(bookmark)
      );

      if (unprocessedBookmarks.length === 0) {
        notificationManager.showInfo('没有需要归档的书签', '当前列表中的书签均已归档或链接失效');
        return;
      }

      const bookmarkIds = unprocessedBookmarks.map((b: any) => b.id);
      await get().batchAIArchiveBookmarks(bookmarkIds);
    },

    pauseArchive: () => {
      const state = get();
      if (state.aiArchiveProgress?.isActive) {
        set({
          aiArchiveProgress: {
            ...state.aiArchiveProgress!,
            isPaused: true
          }
        });
      }
    },

    resumeArchive: async () => {
      const state = get();
      if (state.aiArchiveProgress?.isPaused) {
        const hasActiveQueue = state.aiArchiveProgress.isActive;
        set({
          aiArchiveProgress: {
            ...state.aiArchiveProgress!,
            isPaused: false
          }
        });

        if (hasActiveQueue) {
          return;
        }

        try {
          const checkpoint = await checkpointManager.loadCheckpoint();
          if (checkpoint && checkpoint.bookmarkQueue.length > 0) {
            await get().processArchiveQueue(checkpoint.bookmarkQueue);
          }
        } catch (error) {
          console.error('恢复归档处理失败:', error);
          set({
            error: error instanceof Error ? error.message : '恢复处理失败',
            aiArchiveProgress: {
              ...state.aiArchiveProgress!,
              isActive: false,
              isPaused: false
            }
          });
        }
      }
    },

    cancelArchive: async () => {
      const state = get();
      if (state.aiArchiveProgress?.isActive) {
        screenshotService.cancel();
        await checkpointManager.clearCheckpoint();

        set({
          aiArchiveProgress: {
            isActive: false,
            isPaused: false,
            current: 0,
            total: 0,
            currentBookmark: '',
            successCount: 0,
            failureCount: 0,
            skippedCount: 0,
            completedCount: 0,
            errors: [],
            startTime: 0,
            estimatedTimeRemaining: 0,
            processedIds: [],
            succeededIds: [],
            skippedIds: [],
            processingBookmarkId: [],
            currentIndex: 0
          },
          isLoading: false,
          selectedBookmarks: []
        });

        notificationManager.showInfo('归档已取消', '批量归档处理已被用户取消');
      }
    },

    checkForRecovery: async () => {
      try {
        const hasCheckpoint = await checkpointManager.hasValidCheckpoint();
        if (hasCheckpoint) {
          const recoveryInfo = await checkpointManager.getRecoveryInfo();
          if (recoveryInfo) {
            set({ recoveryInfo, showRecoveryModal: true });
            return true;
          }
        }
        return false;
      } catch (error) {
        console.error('检查恢复状态失败:', error);
        return false;
      }
    },

    showRecoveryDialog: () => {
      set({ showRecoveryModal: true });
    },

    recoverFromCheckpoint: async () => {
      try {
        const checkpoint = await checkpointManager.loadCheckpoint();
        if (!checkpoint) {
          notificationManager.showError('未找到有效的检查点数据', '请重新开始归档');
          return;
        }

        checkpointManager.setSessionId(checkpoint.sessionId);

        set({
          aiArchiveProgress: {
            isActive: true,
            isPaused: checkpoint.isPaused,
            current: checkpoint.currentIndex,
            total: checkpoint.totalBookmarks,
            currentBookmark: '',
            successCount: checkpoint.successCount,
            failureCount: checkpoint.failureCount,
            skippedCount: checkpoint.skippedCount,
            completedCount: checkpoint.successCount + checkpoint.failureCount + checkpoint.skippedCount,
            errors: checkpoint.failedBookmarks.map((fb: any) => ({
              bookmarkId: fb.bookmarkId,
              message: fb.message,
              retryCount: fb.retryCount || 0,
              timestamp: fb.timestamp || Date.now()
            })),
            startTime: checkpoint.startTime,
            estimatedTimeRemaining: 0,
            processedIds: [],
            succeededIds: [],
            skippedIds: [],
            processingBookmarkId: [],
            currentIndex: checkpoint.currentIndex
          },
          showRecoveryModal: false,
          recoveryInfo: null,
        });

        if (checkpoint.bookmarkQueue.length > 0) {
          notificationManager.showSuccess('恢复处理进度', `剩余 ${checkpoint.bookmarkQueue.length} 个书签`);
          await get().processArchiveQueue(checkpoint.bookmarkQueue);
        } else {
          set({
            aiArchiveProgress: {
              ...get().aiArchiveProgress!,
              isActive: false,
            },
            lastBatchResult: {
              total: checkpoint.totalBookmarks,
              successCount: checkpoint.successCount,
              failureCount: checkpoint.failureCount,
              skippedCount: checkpoint.skippedCount,
              errors: checkpoint.failedBookmarks.map((fb: any) => ({
                bookmarkId: fb.bookmarkId,
                message: fb.message
              })),
              duration: Date.now() - checkpoint.startTime,
            },
          });
          await checkpointManager.clearCheckpoint();
          notificationManager.showSuccess('批量归档已完成', '所有书签已成功归档');
        }
      } catch (error) {
        console.error('恢复检查点失败:', error);
        notificationManager.showError('恢复处理失败', '请重新开始归档');
        set({ showRecoveryModal: false, recoveryInfo: null });
      }
    },

    clearCheckpoint: async () => {
      try {
        await checkpointManager.clearCheckpoint();
        set({ showRecoveryModal: false, recoveryInfo: null });
        notificationManager.showSuccess('检查点已清除', '归档状态已重置');
      } catch (error) {
        console.error('清除检查点失败:', error);
        notificationManager.showError('清除检查点失败', '请手动重试');
      }
    },

    calculateEstimatedTime: (currentIndex: number, total: number) => {
      const state = get();
      const progress = state.aiArchiveProgress;
      if (!progress || currentIndex === 0) return 0;

      const elapsed = Date.now() - progress.startTime;
      const avgTimePerItem = elapsed / currentIndex;
      const remaining = total - currentIndex;
      return Math.round(remaining * avgTimePerItem / 1000);
    },
  };
}
