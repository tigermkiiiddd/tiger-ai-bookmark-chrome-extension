import type { Bookmark } from '../types/index.js';

let bookmarkWindowId: number | null = null;

/**
 * 从扩展 UI 打开书签：在独立的浏览器窗口中打开，复用同一窗口避免疯狂创建。
 */
export async function openBookmarkUrl(bookmark: Bookmark): Promise<void> {
  const url = bookmark.url?.trim();
  if (!url) return;

  if (typeof chrome === 'undefined' || !chrome.windows?.create) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    // 尝试复用之前创建的窗口
    if (bookmarkWindowId !== null) {
      try {
        await chrome.windows.get(bookmarkWindowId);

        // 窗口还在：先聚焦窗口，再在其中创建新标签页
        await chrome.windows.update(bookmarkWindowId, { focused: true });
        const tab = await chrome.tabs.create({
          url,
          windowId: bookmarkWindowId,
          active: true,
        });

        if (!tab.id) return;

        await chrome.runtime.sendMessage({
          type: 'WATCH_BOOKMARK_TAB_REDIRECT',
          payload: {
            tabId: tab.id,
            bookmarkId: bookmark.id,
            initialUrl: url,
          },
        });
        return;
      } catch {
        // 窗口已被关闭，重置 ID
        bookmarkWindowId = null;
      }
    }

    // 创建新的浏览器窗口
    const win = await chrome.windows.create({
      url,
      type: 'normal',
      focused: true,
    });

    if (win.id) {
      bookmarkWindowId = win.id;
    }

    const tab = win.tabs?.[0];
    if (tab?.id) {
      await chrome.runtime.sendMessage({
        type: 'WATCH_BOOKMARK_TAB_REDIRECT',
        payload: {
          tabId: tab.id,
          bookmarkId: bookmark.id,
          initialUrl: url,
        },
      });
    }
  } catch (error) {
    console.warn('[openBookmark] windows API 失败，回退 window.open:', error);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
