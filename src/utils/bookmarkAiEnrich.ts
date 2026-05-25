import { bookmarkStorage } from '../core/storage/bookmarks.js';
import { settingsStorage } from '../core/storage/settings.js';
import { AIService } from '../services/ai.js';
import { extractPageContentForAI } from '../services/pageContentExtractionService.js';
import { screenshotService } from '../services/screenshotService.js';
import { tagService } from '../services/tagService.js';
import { StorageService } from '../services/storage.js';
import type { AIAnalysisResult, Bookmark, PageAnalysis } from '../types/index.js';
import { applyAICategoryFromAnalysis } from './applyAICategoryFromAnalysis.js';
import { buildCategoryArchiveContext } from './buildCategoryArchiveContext.js';
import {
  bookmarkNeedsPageScreenshot,
  PAGE_CAPTURE_PREVIEW_PATCH,
} from './bookmarkThumbnail.js';
import { assertBookmarkReachableBeforeArchiveById } from './linkCheckBeforeArchive.js';
import {
  isBookmarkArchived,
  markBookmarkArchivedPatch
} from './bookmarkArchive.js';
import {
  applyBookmarkUrlRewriteFromFinalUrl,
  isLikelyTemporaryRedirectUrl,
} from '../services/linkChecker/urlRewrite.js';

const SCREENSHOT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

export function isWithinScreenshotCooldown(bookmark: Bookmark): boolean {
  if (!bookmark.imagePreviewUpdatedAt) return false;
  return Date.now() - bookmark.imagePreviewUpdatedAt < SCREENSHOT_COOLDOWN_MS;
}

/**
 * 无整页缩略图（或仅为 favicon/logo/og 占位）时打开目标页截图
 * 30 天内已更新过的跳过，避免重复截图
 */
export async function ensureBookmarkThumbnail(
  bookmark: Bookmark,
  options: { required?: boolean } = {}
): Promise<Bookmark> {
  if (!bookmarkNeedsPageScreenshot(bookmark)) {
    return bookmark;
  }

  if (isWithinScreenshotCooldown(bookmark)) {
    return bookmark;
  }

  try {
    const { dataUrl, seoData, finalUrl } = await screenshotService.captureOne(bookmark);
    if (!dataUrl) {
      if (options.required) {
        throw new Error('截图失败：未返回页面截图');
      }
      return bookmark;
    }

    // 若页面发生跳转且最终 URL 不是临时页，自动更新书签地址
    let updatedBookmark = bookmark;
    if (finalUrl && !isLikelyTemporaryRedirectUrl(finalUrl)) {
      const rewriteResult = await applyBookmarkUrlRewriteFromFinalUrl(bookmark.id, bookmark.url, finalUrl);
      if (rewriteResult.updated && rewriteResult.newUrl) {
        const fresh = await bookmarkStorage.getBookmarkById(bookmark.id);
        if (fresh) updatedBookmark = fresh;
      }
    }

    const patch: Partial<Bookmark> = {
      imagePreviewUrl: dataUrl,
      imagePreviewUpdatedAt: Date.now(),
      status: updatedBookmark.status === 'dead' ? 'active' : updatedBookmark.status,
      ...PAGE_CAPTURE_PREVIEW_PATCH,
      ...(isBookmarkArchived(updatedBookmark) ? markBookmarkArchivedPatch() : {}),
    };
    if (seoData?.description && !updatedBookmark.description) {
      patch.description = seoData.description;
    }
    if (seoData?.favicon && !updatedBookmark.favicon) {
      patch.favicon = seoData.favicon;
    }
    await bookmarkStorage.updateBookmark(bookmark.id, patch);
    return { ...updatedBookmark, ...patch };
  } catch (error) {
    if (options.required) {
      throw error;
    }
    console.warn('[ensureBookmarkThumbnail] 截图失败，继续 AI 分析:', bookmark.url, error);
    return bookmark;
  }
}

export interface EnrichBookmarkOptions {
  /** 是否标记为 AI 已归档（Popup 后台添加为 false） */
  setAiArchived?: boolean;
  /** 批量归档时预构建的上下文，避免每个书签重复读全量数据 */
  cachedContext?: {
    categories: any[];
    bookmarks: Bookmark[];
    categoryContext: any;
    existingTags: any[];
  };
  /** 后台环境可直接传入页面加载器，保证正文提取和可选截图复用同一个窗口 */
  loadPageForAI?: (
    bookmark: Bookmark,
    options: { captureScreenshot: boolean }
  ) => Promise<{ pageAnalysis?: PageAnalysis; finalUrl?: string; screenshotDataUrl?: string }>;
  /** Popup 等环境已提取的页面数据，传入后跳过窗口加载 */
  preFetchedData?: {
    pageAnalysis: PageAnalysis;
    screenshotDataUrl?: string;
    finalUrl?: string;
  };
}

function buildAIContentFromPageAnalysis(bookmark: Bookmark, pageAnalysis?: PageAnalysis): string {
  const pageContent = pageAnalysis?.content?.trim();
  if (!pageContent) {
    throw new Error(`无法提取网页正文，跳过 AI 归档：${bookmark.title || bookmark.url}`);
  }

  const parts = [
    pageAnalysis?.title || bookmark.title,
    pageContent,
    bookmark.description,
    bookmark.url,
  ];

  return parts
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join('\n\n')
    .trim();
}

/**
 * 对已有书签执行 AI 分析并写回（与 store.aiArchiveBookmark 内核一致）
 */
export async function enrichBookmarkWithAI(
  bookmarkId: string,
  options: EnrichBookmarkOptions = {}
): Promise<Partial<Bookmark>> {
  const { setAiArchived = false, cachedContext, loadPageForAI } = options;

  const settings = await settingsStorage.getSettings();
  const bookmarkForAnalysis = await assertBookmarkReachableBeforeArchiveById(
    bookmarkId,
    settings
  );

  if (!settings?.aiApiKey?.trim()) {
    throw new Error('请在设置中配置 AI API 密钥');
  }

  const captureScreenshot =
    !!options.preFetchedData?.screenshotDataUrl
      ? false
      : (bookmarkNeedsPageScreenshot(bookmarkForAnalysis) &&
        !isWithinScreenshotCooldown(bookmarkForAnalysis));

  const pageLoadTask = options.preFetchedData
    ? Promise.resolve(options.preFetchedData)
    : loadPageForAI
      ? loadPageForAI(bookmarkForAnalysis, { captureScreenshot })
      : extractPageContentForAI(bookmarkForAnalysis.url, { captureScreenshot });

  // 页面加载/正文提取与上下文准备并行；AI 等正文到位后再开始。
  const [pageLoadResult, analysis] = await Promise.all([
    pageLoadTask,
    (async () => {
      let categoryContext: any;
      let existingTags: any[];

      if (cachedContext) {
        categoryContext = cachedContext.categoryContext;
        existingTags = cachedContext.existingTags;
      } else {
        const storageService = StorageService.getInstance();
        const categories = await storageService.getCategories();
        const bookmarks = await bookmarkStorage.getBookmarks();
        categoryContext = buildCategoryArchiveContext({ categories, bookmarks });
        existingTags = await tagService.getAllTags();
      }

      const aiService = AIService.getInstance();
      await aiService.initialize(settings);

      const pageLoadResult = await pageLoadTask;
      const content = buildAIContentFromPageAnalysis(bookmarkForAnalysis, pageLoadResult.pageAnalysis);
      const tagCounts = await tagService.getTagCounts();
      return await aiService.analyzeContent(
        content,
        bookmarkForAnalysis.url,
        undefined,
        categoryContext,
        existingTags,
        tagCounts
      );
    })(),
  ]);

  const categoryId = await applyAICategoryFromAnalysis(analysis);

  const tagIds = await tagService.ensureTagIds(analysis.tags || []);
  let bookmarkAfterPageLoad = bookmarkForAnalysis;
  if (pageLoadResult.finalUrl && !isLikelyTemporaryRedirectUrl(pageLoadResult.finalUrl)) {
    const rewriteResult = await applyBookmarkUrlRewriteFromFinalUrl(
      bookmarkForAnalysis.id,
      bookmarkForAnalysis.url,
      pageLoadResult.finalUrl
    );
    if (rewriteResult.updated) {
      const fresh = await bookmarkStorage.getBookmarkById(bookmarkForAnalysis.id);
      if (fresh) bookmarkAfterPageLoad = fresh;
    }
  }

  const updates: Partial<Bookmark> = {
    tagIds,
    categoryId,
    aiGenerated: analysis,
    updatedAt: Date.now(),
    ...(bookmarkAfterPageLoad.status === 'dead' ? { status: 'active' as const } : {}),
  };

  if (setAiArchived) {
    Object.assign(updates, markBookmarkArchivedPatch());
  }

  if (pageLoadResult.screenshotDataUrl) {
    updates.imagePreviewUrl = pageLoadResult.screenshotDataUrl;
    updates.imagePreviewUpdatedAt = Date.now();
    updates.imagePreviewKind = 'page_capture';
  }

  await bookmarkStorage.updateBookmark(bookmarkId, updates);
  return updates;
}
