/**
 * Unified Screenshot Service
 *
 * Client-side service that sends all screenshot requests to the background
 * service worker via messages. The background handles popup window creation,
 * page stability detection, captureVisibleTab, and offscreen compression.
 *
 * This avoids the broken pattern of calling chrome.offscreen from page context.
 */

import type { Bookmark, BatchScreenshotProgress, BatchScreenshotControl, CaptureSEOData } from '../types/index';

const BATCH_INTERVAL_MS = 600;

type ProgressCallback = (progress: BatchScreenshotProgress) => void;
type SaveCallback = (bookmarkId: string, dataUrl: string, seoData?: CaptureSEOData) => Promise<void> | void;

class ScreenshotService {
  private cancelled = false;

  /**
   * Capture screenshot for a URL (creates popup window in background).
   * Returns compressed WebP dataUrl or null on failure.
   */
  async captureUrl(url: string, options?: { force?: boolean; extractSEO?: boolean }): Promise<{ dataUrl: string | null; seoData?: CaptureSEOData; finalUrl?: string }> {
    if (this.isRestrictedUrl(url)) return { dataUrl: null };

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_URL',
        payload: { url, extractSEO: options?.extractSEO },
      });
      if (response?.success && response.data) {
        return { dataUrl: response.data as string, seoData: response.seoData, finalUrl: response.finalUrl };
      }
      console.warn('[ScreenshotService] captureUrl failed:', response?.error);
      return { dataUrl: null };
    } catch (error) {
      console.error('[ScreenshotService] captureUrl error:', error);
      return { dataUrl: null };
    }
  }

  /**
   * Capture the currently active tab.
   * Returns compressed WebP dataUrl or null on failure.
   */
  async captureActiveTab(tabId?: number): Promise<string | null> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_ACTIVE_TAB',
        payload: { tabId: tabId ?? null },
      });
      if (response?.success && response.data) {
        return response.data as string;
      }
      console.warn('[ScreenshotService] captureActiveTab failed:', response?.error);
      return null;
    } catch (error) {
      console.error('[ScreenshotService] captureActiveTab error:', error);
      return null;
    }
  }

  /**
   * Batch capture screenshots for multiple bookmarks.
   */
  async captureBatch(
    bookmarks: Bookmark[],
    onProgress: ProgressCallback,
    onSave: SaveCallback,
    control: BatchScreenshotControl = {},
    options: { force?: boolean; extractSEO?: boolean } = {}
  ): Promise<void> {
    this.cancelled = false;

    const progress: BatchScreenshotProgress = {
      current: 0,
      total: bookmarks.length,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      currentUrl: '',
      currentTitle: '',
      isActive: true,
      isCancelled: false,
    };

    for (let i = 0; i < bookmarks.length; i++) {
      await this.waitWhilePaused(control);

      if (this.cancelled || control.shouldStop?.()) {
        progress.isCancelled = true;
        progress.isActive = false;
        onProgress(progress);
        break;
      }

      const bookmark = bookmarks[i];
      progress.current = i + 1;
      progress.currentUrl = bookmark.url;
      progress.currentTitle = bookmark.title;
      onProgress(progress);

      // Skip bookmarks that already have real screenshots unless forced
      if (!options.force && bookmark.imagePreviewKind === 'page_capture' && bookmark.imagePreviewUrl) {
        progress.skippedCount++;
        continue;
      }

      const result = await this.captureUrl(bookmark.url, options);
      if (result.dataUrl) {
        await onSave(bookmark.id, result.dataUrl, result.seoData);
        progress.successCount++;
      } else {
        progress.failureCount++;
      }

      if (i < bookmarks.length - 1) {
        await this.sleepWithControl(BATCH_INTERVAL_MS, control);
      }
    }

    progress.isActive = false;
    onProgress(progress);
  }

  /**
   * Capture a single bookmark (convenience method).
   */
  async captureOne(
    bookmark: Bookmark,
    options: { force?: boolean; extractSEO?: boolean } = {}
  ): Promise<{ dataUrl: string | null; seoData?: CaptureSEOData; finalUrl?: string }> {
    if (!options.force && bookmark.imagePreviewKind === 'page_capture' && bookmark.imagePreviewUrl) {
      return { dataUrl: bookmark.imagePreviewUrl };
    }
    return this.captureUrl(bookmark.url, options);
  }

  /**
   * Cancel an ongoing batch operation.
   */
  cancel(): void {
    this.cancelled = true;
  }

  private isRestrictedUrl(url: string): boolean {
    const restricted = ['chrome:', 'chrome-extension:', 'moz-extension:', 'edge:', 'about:', 'data:', 'file:'];
    return restricted.some((p) => url.startsWith(p));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitWhilePaused(control: BatchScreenshotControl): Promise<void> {
    while (!this.cancelled && !control.shouldStop?.() && control.shouldPause?.()) {
      await this.sleep(300);
    }
  }

  private async sleepWithControl(ms: number, control: BatchScreenshotControl): Promise<void> {
    const endAt = Date.now() + ms;
    while (Date.now() < endAt) {
      await this.waitWhilePaused(control);
      if (this.cancelled || control.shouldStop?.()) return;
      await this.sleep(Math.min(300, endAt - Date.now()));
    }
  }
}

export const screenshotService = new ScreenshotService();
