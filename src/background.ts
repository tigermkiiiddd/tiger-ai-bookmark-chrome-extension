// Background Script - Service Worker
import type { ChromeMessage, Bookmark, Settings, AIAnalysisResult, SyncOptions, BookmarkSyncResult, CaptureSEOData, PageAnalysis } from './types/index.js';
import { bookmarkStorage } from './core/storage/bookmarks.js';
import { chromeStorage } from './core/storage/chrome.js';
import { bookmarkMatchesStatusFilters } from './utils/statusFilter.js';
import ChromeBookmarkService from './services/chromeBookmarks.js';
import { linkCheckService } from './core/background/linkCheckService.js';
import { settingsStorage } from './core/storage/settings.js';
import { mergeLinkCheckOptions } from './services/linkChecker/constants.js';
import {
  buildLinkCheckRuntimeOptions,
  orderBookmarksByIds
} from './utils/linkCheck.js';
import { AIService } from './services/ai.js';
import { tagService } from './services/tagService.js';
import {
  registerBookmarkTabRedirectWatcher,
  startWatchingBookmarkTab
} from './core/background/bookmarkTabRedirectWatcher.js';
import { buildCategoryArchiveContext } from './utils/buildCategoryArchiveContext.js';
import { StorageService } from './services/storage.js';
import { enrichBookmarkWithAI } from './utils/bookmarkAiEnrich.js';

// ═══════════════════════════════════════════
// Screenshot Service (runs in Service Worker)
// ═══════════════════════════════════════════

const OFFSCREEN_PATH = 'src/offscreen/imageCompressor.html';
const CAPTURE_VIEWPORT_WIDTH = 1170;
const CAPTURE_VIEWPORT_HEIGHT = 720;
const THUMBNAIL_WIDTH = 300;
const THUMBNAIL_HEIGHT = 169;
const THUMBNAIL_QUALITY = 0.8;
const CAPTURE_DELAY_MS = 300;
const STABILITY_THRESHOLD_MS = 500;
const MAX_STABILITY_WAIT_MS = 8000;
const PAGE_LOAD_TIMEOUT_MS = 15000;
const AI_ENRICH_QUEUE_KEY = 'aiEnrichQueue';
const AI_ENRICH_ALARM_NAME = 'ai-enrich-queue-drain';
const AI_ENRICH_RETRY_DELAY_MINUTES = 1;

let offscreenReady = false;
let aiEnrichDrainPromise: Promise<void> | null = null;

interface AIEnrichQueueItem {
  bookmarkId: string;
  pageAnalysis?: PageAnalysis;
  enqueuedAt: number;
  attemptCount: number;
  lastError?: string;
}

async function ensureOffscreen(): Promise<void> {
  if (offscreenReady) return;
  const exists = await chrome.offscreen.hasDocument?.();
  if (exists) { offscreenReady = true; return; }
  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL(OFFSCREEN_PATH),
    reasons: ['WORKERS' as chrome.offscreen.Reason],
    justification: '图片压缩需要 Canvas API',
  });
  offscreenReady = true;
}

/** Compress a dataUrl via the offscreen document. Returns WebP dataUrl. */
async function compressInOffscreen(dataUrl: string): Promise<string> {
  await ensureOffscreen();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('压缩超时')), 10000);
    chrome.runtime.sendMessage(
      {
        type: 'COMPRESS_IMAGE',
        payload: {
          dataUrl,
          maxWidth: THUMBNAIL_WIDTH,
          maxHeight: THUMBNAIL_HEIGHT,
          quality: THUMBNAIL_QUALITY,
          mimeType: 'image/webp',
        },
      },
      (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || '压缩失败'));
        }
      }
    );
  });
}

/** 检查页面 DOM 是否已就绪（不依赖 tab.status） */
async function isPageDomReady(tabId: number): Promise<boolean> {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        hasBody: !!document.body,
        readyState: document.readyState,
        title: document.title,
      }),
    });
    return result?.hasBody === true && (result.readyState === 'interactive' || result.readyState === 'complete');
  } catch {
    return false;
  }
}

/** Wait for a tab to finish loading. */
function waitForTabLoad(tabId: number, timeoutMs = PAGE_LOAD_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    const timeout = setTimeout(async () => {
      chrome.tabs.onUpdated.removeListener(listener);
      // 最后检查：页面 DOM 是否已就绪（某些网站永远不会触发 complete）
      const domReady = await isPageDomReady(tabId);
      if (domReady) {
        done();
        return;
      }
      reject(new Error('页面加载超时'));
    }, timeoutMs);

    const listener = (_tabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (_tabId === tabId && info.status === 'complete') {
        done();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      if (tab.status === 'complete') {
        done();
      }
    });
  });
}

/**
 * Inject a content script that detects when the page is truly stable
 * (no DOM mutations, no loading images) before we take the screenshot.
 */
async function waitForPageStability(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return new Promise<void>((resolve) => {
          const MAX_WAIT = 8000;
          const THRESHOLD = 500;
          const start = Date.now();
          let lastChange = Date.now();

          const observer = new MutationObserver(() => { lastChange = Date.now(); });
          observer.observe(document.body, { childList: true, subtree: true, attributes: true });

          const hasLoadingImages = () => {
            for (const img of document.querySelectorAll('img')) {
              if (!img.complete && img.src) return true;
            }
            return false;
          };

          const check = setInterval(() => {
            const stable = (Date.now() - lastChange >= THRESHOLD) && !hasLoadingImages();
            const expired = Date.now() - start >= MAX_WAIT;
            if (stable || expired) {
              clearInterval(check);
              observer.disconnect();
              resolve();
            }
          }, 200);
        });
      },
    });
  } catch {
    // Scripting may fail on restricted pages; skip stability check
  }
}

/** Full capture pipeline: popup window → stability → capture → compress */
async function handleCaptureUrl(
  url: string,
  options?: { extractSEO?: boolean }
): Promise<{ success: boolean; data?: string; seoData?: CaptureSEOData; finalUrl?: string; error?: string }> {
  const restricted = ['chrome://', 'chrome-extension://', 'moz-extension://', 'edge://', 'about:', 'data:', 'file://'];
  if (restricted.some((p) => url.startsWith(p))) {
    return { success: false, error: '受限页面' };
  }

  let windowId: number | undefined;
  try {
    // 1. Create popup window offscreen at 1x1
    const screen = (await chrome.system?.display?.getInfo?.()?.catch?.(() => undefined))?.[0];
    const availWidth = screen?.workArea?.width ?? 1920;
    const availHeight = screen?.workArea?.height ?? 1080;

    const w = await chrome.windows.create({
      url,
      type: 'popup',
      left: availWidth - CAPTURE_VIEWPORT_WIDTH,
      top: availHeight - CAPTURE_VIEWPORT_HEIGHT,
      width: CAPTURE_VIEWPORT_WIDTH,
      height: CAPTURE_VIEWPORT_HEIGHT,
      focused: true,
    });

    if (!w?.tabs?.length || !w.id) {
      return { success: false, error: '创建窗口失败' };
    }
    windowId = w.id;
    const tabId = w.tabs[0].id!;

    // Mute the tab
    await chrome.tabs.update(tabId, { muted: true });

    // 2. Wait for page load
    await waitForTabLoad(tabId);

    // 3. Inject CSS to hide scrollbars
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        css: 'html, body { overflow: hidden !important; }',
      });
    } catch { /* ignore on restricted pages */ }

    // 4. Focus the window (required for captureVisibleTab)
    await chrome.windows.update(windowId, { focused: true });

    // 5. Wait for page stability (lazy images, animations, etc.)
    await waitForPageStability(tabId);

    // 5.5 Get final URL after any redirects
    const tab = await chrome.tabs.get(tabId);
    const finalUrl = tab.url;

    // 6. 并行：截图 + SEO提取
    const [captureResult, seoResult] = await Promise.all([
      (async () => {
        await new Promise(r => setTimeout(r, CAPTURE_DELAY_MS));
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
          format: 'jpeg',
          quality: 85,
        });
        let compressed = dataUrl;
        try {
          compressed = await compressInOffscreen(dataUrl);
        } catch (e) {
          console.warn('[Screenshot] 压缩失败，使用原图:', e);
        }
        return compressed;
      })(),
      (async () => {
        if (!options?.extractSEO) return undefined;
        try {
          await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
          await new Promise(r => setTimeout(r, 500));
          const pageInfo = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_INFO' });
          if (pageInfo?.success && pageInfo.data) {
            return {
              description: pageInfo.data.description || undefined,
              favicon: pageInfo.data.favicon || undefined,
            } as CaptureSEOData;
          }
        } catch (e) {
          console.warn('[Screenshot] SEO提取失败(非致命):', e);
        }
        return undefined;
      })(),
    ]);

    return { success: true, data: captureResult, seoData: seoResult, finalUrl };
  } catch (error) {
    console.error('[Screenshot] captureUrl 失败:', error);
    return { success: false, error: (error as Error).message };
  } finally {
    if (windowId) {
      try { await chrome.windows.remove(windowId); } catch { /* already closed */ }
    }
  }
}

async function handleExtractPageContentForAI(
  url: string,
  options: { captureScreenshot?: boolean } = {}
): Promise<{
  success: boolean;
  data?: PageAnalysis;
  finalUrl?: string;
  screenshotDataUrl?: string;
  error?: string;
}> {
  const restricted = ['chrome://', 'chrome-extension://', 'moz-extension://', 'edge://', 'about:', 'data:', 'file://'];
  if (restricted.some((p) => url.startsWith(p))) {
    return { success: false, error: '受限页面' };
  }

  let windowId: number | undefined;
  try {
    const screen = (await chrome.system?.display?.getInfo?.()?.catch?.(() => undefined))?.[0];
    const availWidth = screen?.workArea?.width ?? 1920;
    const availHeight = screen?.workArea?.height ?? 1080;

    const w = await chrome.windows.create({
      url,
      type: 'popup',
      left: availWidth - CAPTURE_VIEWPORT_WIDTH,
      top: availHeight - CAPTURE_VIEWPORT_HEIGHT,
      width: CAPTURE_VIEWPORT_WIDTH,
      height: CAPTURE_VIEWPORT_HEIGHT,
      focused: true,
    });

    if (!w?.tabs?.length || !w.id) {
      return { success: false, error: '创建窗口失败' };
    }

    windowId = w.id;
    const tabId = w.tabs[0].id!;
    await chrome.tabs.update(tabId, { muted: true });
    await waitForTabLoad(tabId);

    const tabAfterLoad = await chrome.tabs.get(tabId);
    if (tabAfterLoad.url?.startsWith('chrome-error://')) {
      return { success: false, error: '页面无法访问（DNS 或网络错误）' };
    }

    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        css: 'html, body { overflow: hidden !important; }',
      });
    } catch { /* ignore on restricted pages */ }

    await chrome.windows.update(windowId, { focused: true });

    const tab = await chrome.tabs.get(tabId);
    const finalUrl = tab.url;

    let pageAnalysis: PageAnalysis | undefined;
    try {
      // manifest 已配置 content script 自动注入（run_at: document_idle），
      // 不需要手动 executeScript，避免重复注入和竞态。
      // 轮询等待 content script 就绪（最多 20 次 × 500ms = 10s，document_idle 可能较晚触发）
      let ready = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 500));
        try {
          const ping = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
          if (ping?.success) {
            ready = true;
            break;
          }
        } catch {
          // 未就绪，继续轮询
        }
      }
      if (!ready) {
        return { success: false, finalUrl, error: 'Content Script 初始化超时' };
      }

      const response = await chrome.tabs.sendMessage(tabId, { type: 'ANALYZE_PAGE' });
      if (response?.success && response.data) {
        pageAnalysis = response.data as PageAnalysis;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Frame with ID') && msg.includes('error page')) {
        return { success: false, finalUrl, error: '页面无法访问（可能已失效或被阻止）' };
      }
      if (msg.includes('Cannot access contents of url') || msg.includes('Cannot access a chrome:// URL')) {
        return { success: false, finalUrl, error: '页面无法访问（受限或已失效）' };
      }
      return {
        success: false,
        finalUrl,
        error: `页面正文提取失败: ${msg}`,
      };
    }

    if (!pageAnalysis?.content?.trim()) {
      return { success: false, finalUrl, error: '页面正文为空' };
    }

    let screenshotDataUrl: string | undefined;
    if (options.captureScreenshot) {
      try {
        await waitForPageStability(tabId);
        await new Promise(r => setTimeout(r, CAPTURE_DELAY_MS));
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
          format: 'jpeg',
          quality: 85,
        });
        try {
          screenshotDataUrl = await compressInOffscreen(dataUrl);
        } catch (error) {
          console.warn('[AIPageLoad] 截图压缩失败，使用原图:', error);
          screenshotDataUrl = dataUrl;
        }
      } catch (error) {
        console.warn('[AIPageLoad] 截图失败，AI 正文分析继续:', error);
      }
    }

    return {
      success: true,
      data: pageAnalysis,
      finalUrl,
      screenshotDataUrl,
    };
  } catch (error) {
    console.error('[AIPageLoad] 打开页面提取正文失败:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (windowId) {
      try { await chrome.windows.remove(windowId); } catch { /* already closed */ }
    }
  }
}

/** Capture the active/visible tab (user's current tab). */
async function handleCaptureActiveTab(tabId?: number): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    let tab: chrome.tabs.Tab;
    if (tabId) {
      tab = await chrome.tabs.get(tabId);
    } else {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) return { success: false, error: '没有活动标签页' };
      tab = activeTab;
    }

    if (!tab.id || !tab.windowId) return { success: false, error: '无效标签页' };

    const restricted = ['chrome://', 'chrome-extension://', 'moz-extension://', 'edge://', 'about:', 'data:', 'file://'];
    if (tab.url && restricted.some((p) => tab.url!.startsWith(p))) {
      return { success: false, error: '受限页面' };
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 85,
    });

    let compressed = dataUrl;
    try {
      compressed = await compressInOffscreen(dataUrl);
    } catch (e) {
      console.warn('[Screenshot] 压缩失败，使用原图:', e);
    }

    return { success: true, data: compressed };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// 初始化扩展
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // 首次安装时的初始设置
    const defaultSettings: Settings = {
      theme: 'system',
      aiAutoTagging: true,
      contentSafetyLevel: 'BLOCK_NONE',
      syncDirection: 'bidirectional'
    };
    
    await chromeStorage.set({ settings: defaultSettings });
    console.log('TIGERMARKIII installed successfully');
  }

  void scheduleAiEnrichQueueDrain();
});

chrome.runtime.onStartup.addListener(() => {
  void scheduleAiEnrichQueueDrain();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AI_ENRICH_ALARM_NAME) {
    void triggerAiEnrichQueueDrain();
  }
});

// 监听来自popup和content script的消息
chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
  console.log('🔄 Background收到消息:', message.type, { sender: sender.tab?.url });

  // 添加消息验证
  if (!message || !message.type) {
    console.error('❌ 无效消息格式:', message);
    sendResponse({ success: false, error: '无效消息格式' });
    return false;
  }

  try {
    switch (message.type) {
      case 'ADD_BOOKMARK':
        handleAddBookmark(message.payload, sendResponse);
        return true; // 保持消息通道开放

      case 'ANALYZE_PAGE':
        handleAnalyzePage(message.payload, sendResponse);
        return true;

      case 'PING':
        sendResponse({ success: true, message: 'Background script is alive' });
        return false;

      case 'WATCH_BOOKMARK_TAB_REDIRECT': {
        const payload = message.payload as {
          tabId?: number;
          bookmarkId?: string;
          initialUrl?: string;
        };
        if (
          payload?.tabId != null &&
          payload.bookmarkId &&
          payload.initialUrl
        ) {
          startWatchingBookmarkTab(
            payload.tabId,
            payload.bookmarkId,
            payload.initialUrl
          );
        }
        sendResponse({ success: true });
        return false;
      }

      case 'CAPTURE_URL':
        handleCaptureUrl(message.payload.url, { extractSEO: !!message.payload.extractSEO })
          .then(result => sendResponse(result));
        return true;

      case 'EXTRACT_PAGE_CONTENT_FOR_AI':
        handleExtractPageContentForAI(message.payload.url, {
          captureScreenshot: !!message.payload.captureScreenshot,
        }).then(result => sendResponse(result));
        return true;

      case 'CAPTURE_ACTIVE_TAB':
        handleCaptureActiveTab(message.payload?.tabId ?? sender.tab?.id)
          .then(result => sendResponse(result));
        return true;

      case 'BATCH_CHECK_LINKS':
        handleBatchCheckLinks(message.payload)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'GET_LINK_CHECK_PROGRESS':
        handleGetLinkCheckProgress()
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'PAUSE_LINK_CHECK':
        handlePauseLinkCheck()
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'RESUME_LINK_CHECK':
        handleResumeLinkCheck()
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'STOP_LINK_CHECK':
        handleStopLinkCheck()
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'CAPTURE_SCREENSHOT': {
        // Legacy fallback: capture the sender's tab
        const tid = message.payload?.tabId ?? sender.tab?.id;
        handleCaptureActiveTab(tid)
          .then(result => sendResponse(result));
        return true;
      }

      case 'GET_SCREENSHOT': {
        const tid2 = sender.tab?.id;
        handleCaptureActiveTab(tid2)
          .then(result => sendResponse(result));
        return true;
      }

      case 'COMPRESS_IMAGE':
        // Forward to offscreen document — don't respond here, let offscreen handle it
        return false;

      // 已废弃：使用 BATCH_CHECK_LINKS 替代
      case 'CHECK_BROKEN_LINKS':
        // 功能已移除，返回空结果
        sendResponse({ success: true, brokenLinks: [] });
        return false;

      case 'GET_BOOKMARKS':
        handleGetBookmarks(message.payload)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'GET_CHROME_BOOKMARKS':
        handleGetChromeBookmarks()
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'IMPORT_CHROME_BOOKMARKS':
        handleImportChromeBookmarks(message.payload)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'SYNC_CHROME_BOOKMARKS':
        handleSyncChromeBookmarks(message.payload)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'EXPORT_TO_CHROME':
        handleExportToChrome(message.payload)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'AI_BOOKMARK_ENRICH':
        handleAiBookmarkEnrich(message.payload)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'CONTENT_SCRIPT_READY':
        sendResponse({ success: true });
        return false;

      default:
        console.warn('⚠️ 未知消息类型:', message.type);
        sendResponse({ success: false, error: '未知消息类型' });
        return false;
    }
  } catch (error) {
    console.error('❌ 消息处理异常:', error);
    sendResponse({ success: false, error: `消息处理失败: ${error instanceof Error ? error.message : String(error)}` });
    return false;
  }
});

// AI 书签智能添加（后台分析，popup 已预提取页面正文避免开窗口）
async function handleAiBookmarkEnrich(payload: {
  bookmarkId: string;
  pageAnalysis?: PageAnalysis;
  screenshotDataUrl?: string;
}): Promise<void> {
  const { bookmarkId, pageAnalysis } = payload;
  if (!bookmarkId) {
    throw new Error('缺少 bookmarkId');
  }

  await enqueueAiEnrichTask({
    bookmarkId,
    pageAnalysis,
  });

  void triggerAiEnrichQueueDrain();
}

async function getAiEnrichQueue(): Promise<AIEnrichQueueItem[]> {
  const result = await chromeStorage.get<{ aiEnrichQueue?: AIEnrichQueueItem[] }>(AI_ENRICH_QUEUE_KEY);
  return Array.isArray(result.aiEnrichQueue) ? result.aiEnrichQueue : [];
}

async function setAiEnrichQueue(queue: AIEnrichQueueItem[]): Promise<void> {
  await chromeStorage.set({ [AI_ENRICH_QUEUE_KEY]: queue });
}

async function enqueueAiEnrichTask(item: {
  bookmarkId: string;
  pageAnalysis?: PageAnalysis;
}): Promise<void> {
  const queue = await getAiEnrichQueue();
  const filtered = queue.filter((entry) => entry.bookmarkId !== item.bookmarkId);
  filtered.push({
    bookmarkId: item.bookmarkId,
    pageAnalysis: item.pageAnalysis,
    enqueuedAt: Date.now(),
    attemptCount: 0,
  });
  await setAiEnrichQueue(filtered);
  await scheduleAiEnrichQueueDrain();
}

async function scheduleAiEnrichQueueDrain(delayInMinutes = AI_ENRICH_RETRY_DELAY_MINUTES): Promise<void> {
  await chrome.alarms.create(AI_ENRICH_ALARM_NAME, { delayInMinutes });
}

function triggerAiEnrichQueueDrain(): Promise<void> {
  if (!aiEnrichDrainPromise) {
    aiEnrichDrainPromise = drainAiEnrichQueue().finally(() => {
      aiEnrichDrainPromise = null;
    });
  }
  return aiEnrichDrainPromise;
}

async function drainAiEnrichQueue(): Promise<void> {
  while (true) {
    const queue = await getAiEnrichQueue();
    const nextItem = queue[0];

    if (!nextItem) {
      return;
    }

    try {
      await enrichBookmarkWithAI(nextItem.bookmarkId, {
        setAiArchived: true,
        ...(nextItem.pageAnalysis
          ? { preFetchedData: { pageAnalysis: nextItem.pageAnalysis } }
          : {}),
      });

      await setAiEnrichQueue(queue.slice(1));
    } catch (error) {
      const updatedQueue = [...queue];
      updatedQueue[0] = {
        ...nextItem,
        attemptCount: nextItem.attemptCount + 1,
        lastError: error instanceof Error ? error.message : String(error),
      };
      await setAiEnrichQueue(updatedQueue);
      console.error('[AIEnrichQueue] 后台 AI 富化失败:', nextItem.bookmarkId, error);
      await scheduleAiEnrichQueueDrain(AI_ENRICH_RETRY_DELAY_MINUTES);
      return;
    }
  }
}

// 处理添加书签
async function handleAddBookmark(data: any, sendResponse: (response: any) => void): Promise<void> {
  console.log('📚 开始添加书签:', data);
  
  try {
    const { url, title, content, useAI = true, imagePreviewUrl } = data;

    // 生成唯一ID
    const id = `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    let aiGenerated: AIAnalysisResult | undefined;

    if (useAI && content) {
      try {
        console.log('🤖 开始AI分析...');
        // 调用AI分析
        aiGenerated = await analyzeContentWithAI(content, url);
        console.log('✅ AI分析完成:', aiGenerated);
      } catch (error) {
        console.error('❌ AI分析失败:', error);
      }
    }

    const tagIds = await tagService.ensureTagIds(aiGenerated?.tags || []);
    const bookmark: Bookmark = {
      id,
      url,
      title,
      tagIds,
      categoryId: undefined, // AI结果需要store层解析
      createdAt: now,
      updatedAt: now,
      status: 'active',
      imagePreviewUrl,
      aiGenerated
    };

    // 保存到存储
    await bookmarkStorage.addBookmark(bookmark);
    console.log('💾 书签已保存到存储');
    
    console.log('✅ 书签添加成功:', bookmark.id);
    sendResponse({ success: true, data: bookmark });
  } catch (error) {
    console.error('❌ 添加书签失败:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : '添加书签失败' });
  }
}

// 处理页面分析（增强版）
async function handleAnalyzePage(data: any, sendResponse: (response: any) => void): Promise<void> {
  console.log('🔍 开始页面分析:', { url: data.url });
  
  try {
    const { url, content, pageAnalysis } = data;
    const result = await analyzeContentWithAI(content, url, pageAnalysis);
    console.log('✅ 页面分析完成:', result);
    sendResponse({ success: true, data: result });
  } catch (error) {
    console.error('❌ 页面分析失败:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : '页面分析失败' });
  }
}

// AI内容分析（增强版）
async function analyzeContentWithAI(content: string, url: string, pageAnalysis?: any): Promise<AIAnalysisResult> {
  const settings = await settingsStorage.getSettings();

  const ai = AIService.getInstance();
  await ai.initialize(settings);

  const storageService = StorageService.getInstance();
  const categories = await storageService.getCategories();
  const bookmarks = await bookmarkStorage.getBookmarks();
  const categoryContext = buildCategoryArchiveContext({ categories, bookmarks });

  return await ai.analyzeContent(content, url, pageAnalysis, categoryContext);
}

// 获取书签
async function handleGetBookmarks(payload?: { query?: string; filters?: any }): Promise<Bookmark[]> {
  const bookmarks = await bookmarkStorage.getBookmarks();

  if (!payload?.query && !payload?.filters) {
    return bookmarks;
  }

  // 简单的搜索和过滤逻辑
  let filteredBookmarks = bookmarks;

  if (payload.query) {
    const query = payload.query.toLowerCase();
    filteredBookmarks = filteredBookmarks.filter((bookmark: Bookmark) =>
      bookmark.title.toLowerCase().includes(query) ||
      bookmark.url.toLowerCase().includes(query)
    );
  }

  if (payload.filters) {
    if (payload.filters.tags && payload.filters.tags.length > 0) {
      filteredBookmarks = filteredBookmarks.filter((bookmark: Bookmark) =>
        payload.filters.tags.some((tagId: string) => bookmark.tagIds?.includes(tagId))
      );
    }

    if (payload.filters.categories && payload.filters.categories.length > 0) {
      filteredBookmarks = filteredBookmarks.filter((bookmark: Bookmark) =>
        payload.filters.categories.includes(bookmark.categoryId)
      );
    }

    if (payload.filters.status && payload.filters.status.length > 0) {
      filteredBookmarks = filteredBookmarks.filter((bookmark: Bookmark) =>
        bookmarkMatchesStatusFilters(bookmark, payload.filters.status)
      );
    }
  }

  return filteredBookmarks;
}

// 处理批量链接检查
async function handleBatchCheckLinks(
  payload: { bookmarkIds?: string[]; options?: any } = {}
): Promise<{ started: boolean; total: number; message: string }> {
  try {
    const bookmarks = await bookmarkStorage.getBookmarks();

    let toCheck = bookmarks;
    if (payload.bookmarkIds && payload.bookmarkIds.length > 0) {
      const idSet = new Set(payload.bookmarkIds);
      const matched = bookmarks.filter((b: Bookmark) => idSet.has(b.id));
      toCheck = orderBookmarksByIds(matched, payload.bookmarkIds);
    }
    
    if (toCheck.length === 0) {
      return {
        started: false,
        total: 0,
        message: '没有找到需要检查的书签'
      };
    }

    const settings = await settingsStorage.getSettings();
    const options = mergeLinkCheckOptions({
      ...buildLinkCheckRuntimeOptions(settings),
      ...payload.options
    });

    await linkCheckService.startBatchCheck(toCheck, options);

    await settingsStorage.updateSettings({ lastLinkCheckAt: Date.now() });

    console.log('批量链接检查开始，共', toCheck.length, '个书签');

    return {
      started: true,
      total: toCheck.length,
      message: `批量链接检查已开始，共 ${toCheck.length} 个书签`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('批量链接检查失败:', error);
    if (message.includes('document is not defined')) {
      return {
        started: false,
        total: 0,
        message:
          '后台检测模块加载异常（DOM 代码误入 Service Worker）。请在 chrome://extensions 重新加载扩展后重试；若仍失败，请打开 Service Worker 控制台查看详细堆栈。'
      };
    }
    return { started: false, total: 0, message };
  }
}

// 获取链接检查进度
async function handleGetLinkCheckProgress(): Promise<any> {
  try {
    const progressInfo = linkCheckService.getProgressInfo();

    return {
      progress: progressInfo.progress,
      detailedProgress: progressInfo.detailedProgress,
      recentResults: progressInfo.recentResults,
      allResults: progressInfo.allResults,
      currentUrl: progressInfo.currentUrl,
      report:
        progressInfo.progress.status === 'completed'
          ? linkCheckService.generateReport()
          : null
    };
  } catch (error) {
    console.error('获取检查进度失败:', error);
    throw error;
  }
}

// 更新标签统计
async function updateTagsCount(tags: string[]): Promise<void> {
  const { tagStats = {} } = await chromeStorage.get<{ tagStats?: Record<string, number> }>(['tagStats']);
  const safeTags = Array.isArray(tags) ? tags : [];

  safeTags.forEach(tag => {
    tagStats[tag] = (tagStats[tag] || 0) + 1;
  });

  await chromeStorage.set({ tagStats });
}

// =============Chrome书签同步相关处理函数=============

// 获取Chrome书签
async function handleGetChromeBookmarks(): Promise<any> {
  console.log('handleGetChromeBookmarks 开始执行');
  
  try {
    // 检查 Chrome 书签 API 是否可用
    if (!chrome.bookmarks) {
      console.error('Chrome书签 API 不可用');
      throw new Error('Chrome书签 API不可用');
    }
    
    console.log('Chrome书签 API 可用，尝试获取服务实例');
    const chromeBookmarkService = ChromeBookmarkService;
    console.log('Chrome书签服务实例:', chromeBookmarkService);
    
    console.log('开始获取所有Chrome书签...');
    const bookmarks = await chromeBookmarkService.getAllChromeBookmarkUrls();
    console.log('获取到书签数量:', bookmarks.length);
    
    console.log('开始获取文件夹结构...');
    const folders = await chromeBookmarkService.getBookmarkFolders();
    console.log('获取到文件夹数量:', folders.length);
    
    const result = {
      bookmarks,
      folders,
      total: bookmarks.length
    };
    
    console.log('handleGetChromeBookmarks 执行成功，返回结果:', result);
    return result;
  } catch (error) {
    console.error('获取Chrome书签失败:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : '无stack信息');
    throw error;
  }
}

// 导入Chrome书签
async function handleImportChromeBookmarks(payload: {
  selectedFolders?: string[];
  options: SyncOptions;
  onProgress?: (progress: any) => void;
}): Promise<BookmarkSyncResult> {
  console.log('[background] handleImportChromeBookmarks 开始，payload:', payload);
  try {
    const { selectedFolders, options } = payload;
    const chromeBookmarkService = ChromeBookmarkService;

    let chromeBookmarks;

    if (selectedFolders && selectedFolders.length > 0) {
      // 从指定文件夹导入
      chromeBookmarks = [];
      for (const folderId of selectedFolders) {
        const folderBookmarks = await chromeBookmarkService.getBookmarksByFolder(folderId);
        chromeBookmarks.push(...folderBookmarks);
      }
    } else {
      // 导入所有书签
      chromeBookmarks = await chromeBookmarkService.getAllChromeBookmarkUrls();
    }
    
    // 执行导入
    const result = await chromeBookmarkService.importChromeBookmarks(
      chromeBookmarks,
      options,
      payload.onProgress
    );
    
    console.log('[background] handleImportChromeBookmarks 完成，结果:', result);
    return result;

  } catch (error) {
    console.error('[background] 导入Chrome书签失败:', error);
    throw error;
  }
}

// 同步Chrome书签
async function handleSyncChromeBookmarks(payload: {
  options: SyncOptions;
}): Promise<{
  importResult: BookmarkSyncResult;
  exportResult: { exported: number; errors: number };
}> {
  try {
    const { options } = payload;
    const chromeBookmarkService = ChromeBookmarkService;
    
    const result = await chromeBookmarkService.syncBookmarks(options);
    
    console.log('Chrome书签同步完成:', result);
    return result;
    
  } catch (error) {
    console.error('同步Chrome书签失败:', error);
    throw error;
  }
}

// 导出到Chrome
async function handleExportToChrome(payload: {
  bookmarkIds?: string[];
  targetFolderId?: string;
}): Promise<{ exported: number; errors: number }> {
  try {
    const { bookmarkIds, targetFolderId } = payload;
    const chromeBookmarkService = ChromeBookmarkService;
    
    // 如果没有提供bookmarkIds，则导出所有未同步的书签
    let idsToExport: string[] = bookmarkIds || [];
    
    if (idsToExport.length === 0) {
      const { bookmarks = [] } = await chromeStorage.get<{ bookmarks?: Bookmark[] }>(['bookmarks']);
      idsToExport = bookmarks
        .filter((b: Bookmark) => !b.isSyncedFromChrome && !b.chromeBookmarkId)
        .map((b: Bookmark) => b.id);
    }
    
    const result = await chromeBookmarkService.exportToChrome(idsToExport, targetFolderId || undefined);
    
    console.log('导出到Chrome完成:', result);
    return result;
    
  } catch (error) {
    console.error('导出到Chrome失败:', error);
    throw error;
  }
}

// 监听标签页更新事件（可用于自动检测页面变化）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 可以在这里添加自动分析逻辑
  }
});

// 处理暂停链接检查
async function handlePauseLinkCheck(): Promise<{ success: boolean }> {
  try {
    linkCheckService.pauseCheck();
    return { success: true };
  } catch (error) {
    console.error('暂停链接检查失败:', error);
    throw error;
  }
}

// 处理恢复链接检查
async function handleResumeLinkCheck(): Promise<{ success: boolean }> {
  try {
    await linkCheckService.resumeCheck();
    return { success: true };
  } catch (error) {
    console.error('恢复链接检查失败:', error);
    throw error;
  }
}

// 处理停止链接检查
async function handleStopLinkCheck(): Promise<{ success: boolean }> {
  try {
    linkCheckService.stopCheck();
    return { success: true };
  } catch (error) {
    console.error('停止链接检查失败:', error);
    throw error;
  }
}

/** Re-compress all existing thumbnails to current THUMBNAIL size */
async function handleRecompressThumbnails(payload?: { batchSize?: number }): Promise<{
  success: boolean; processed: number; total: number; error?: string
}> {
  await ensureOffscreen();
  const bookmarks = await bookmarkStorage.getBookmarks();
  const toProcess = bookmarks.filter((b: Bookmark) => b.imagePreviewUrl);
  let processed = 0;
  const batchSize = payload?.batchSize ?? 10;

  for (let i = 0; i < toProcess.length; i += batchSize) {
    const batch = toProcess.slice(i, i + batchSize);
    await Promise.all(batch.map(async (bookmark: Bookmark) => {
      try {
        const compressed = await compressInOffscreen(bookmark.imagePreviewUrl!);
        await bookmarkStorage.updateBookmark(bookmark.id, {
          imagePreviewUrl: compressed,
          imagePreviewUpdatedAt: Date.now(),
        });
        processed++;
      } catch (e) {
        console.warn(`[Recompress] 失败 ${bookmark.id}:`, e);
      }
    }));
    if (i + batchSize < toProcess.length) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return { success: true, processed, total: toProcess.length };
}

registerBookmarkTabRedirectWatcher();
void triggerAiEnrichQueueDrain();

console.log('TIGERMARKIII Background Service Worker loaded');
