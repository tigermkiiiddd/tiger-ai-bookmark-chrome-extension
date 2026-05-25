export interface TabScreenshotResult {
  dataUrl?: string;
  /** 是否为真实页面截图（非 favicon 占位卡） */
  isPageCapture: boolean;
  strategy?: string;
}

const PAGE_CAPTURE_STRATEGIES = new Set([
  'ChromeOfficialAPI',
  'ContentScriptFallback',
  'captureTab',
]);

/**
 * 从 Background 按 tabId 截取页面（Popup 打开时优先 captureTab）
 */
export async function captureTabScreenshot(tabId: number): Promise<TabScreenshotResult> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CAPTURE_SCREENSHOT',
      payload: { tabId },
    });
    if (response?.success && response.data) {
      const strategy = response.metadata?.strategy as string | undefined;
      const isPageCapture = strategy ? PAGE_CAPTURE_STRATEGIES.has(strategy) : true;
      return {
        dataUrl: response.data as string,
        isPageCapture,
        strategy,
      };
    }
  } catch (error) {
    console.warn('[Popup] 自动截图失败:', error);
  }
  return { isPageCapture: false };
}
