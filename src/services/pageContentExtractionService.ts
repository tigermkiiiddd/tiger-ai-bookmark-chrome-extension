import type { PageAnalysis } from '../types/index';

export interface PageContentExtractionResult {
  pageAnalysis?: PageAnalysis;
  finalUrl?: string;
  screenshotDataUrl?: string;
}

export async function extractPageContentForAI(
  url: string,
  options: { captureScreenshot?: boolean } = {}
): Promise<PageContentExtractionResult> {
  const response = await chrome.runtime.sendMessage({
    type: 'EXTRACT_PAGE_CONTENT_FOR_AI',
    payload: { url, captureScreenshot: !!options.captureScreenshot },
  });

  if (!response?.success) {
    throw new Error(response?.error || '页面内容提取失败');
  }

  return {
    pageAnalysis: response.data,
    finalUrl: response.finalUrl,
    screenshotDataUrl: response.screenshotDataUrl,
  };
}
