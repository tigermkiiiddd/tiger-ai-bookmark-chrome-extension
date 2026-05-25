/**
 * 页面深度分析服务 — 独立单元
 * 封装 content script 检测、注入、页面分析的完整流程
 */
import type { PageAnalysis } from '../types/index';
import { ContentScriptDiagnostic } from '../utils/contentScriptDiagnostic';

function toReadableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes('Could not establish connection') ||
    message.includes('Receiving end does not exist')
  ) {
    return '页面脚本未连接。已尝试自动注入，请刷新当前网页后重试。';
  }
  if (message.includes('Cannot access') || message.includes('chrome://')) {
    return '当前页面不允许扩展读取内容，请在普通网页中使用页面深度分析。';
  }
  if (message.includes('Extension context invalidated')) {
    return '扩展上下文已失效，请在 chrome://extensions 重新加载扩展后重试。';
  }
  if (message.includes('无法在系统页面')) {
    return '系统页面不支持页面分析，请在普通网页中使用。';
  }
  if (message.includes('标签页')) {
    return '无法获取当前标签页信息，请确认当前窗口有打开的网页。';
  }

  return `页面分析失败: ${message}`;
}

export interface PageAnalysisResult {
  success: boolean;
  data?: PageAnalysis;
  error?: string;
}

export async function ensureContentScript(tabId: number): Promise<void> {
  const check = await ContentScriptDiagnostic.checkContentScript(tabId);
  if (check.available) return;

  const injected = await ContentScriptDiagnostic.injectContentScript(tabId);
  if (!injected.success) {
    throw new Error(injected.error || check.error || '页面脚本注入失败');
  }

  const recheck = await ContentScriptDiagnostic.checkContentScript(tabId);
  if (!recheck.available) {
    throw new Error(recheck.error || '页面脚本已注入，但仍无法建立连接');
  }
}

export async function fetchPageAnalysis(): Promise<PageAnalysisResult> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return { success: false, error: '无法获取当前标签页' };
    }

    await ensureContentScript(tab.id);

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_PAGE' });
    if (response?.success && response.data) {
      return { success: true, data: response.data };
    }

    return { success: false, error: response?.error || '页面分析返回空结果' };
  } catch (error) {
    return { success: false, error: toReadableError(error) };
  }
}
