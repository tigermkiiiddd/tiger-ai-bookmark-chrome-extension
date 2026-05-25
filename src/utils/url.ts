/**
 * URL工具函数
 */

/**
 * 从URL中提取域名
 * @param url - 完整的URL
 * @returns 域名字符串
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    // 如果URL格式不正确，尝试简单的字符串处理
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/?#]+)/i);
    return match ? match[1] : url;
  }
}

/**
 * 检查URL是否有效
 * @param url - 要检查的URL
 * @returns 是否为有效URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 标准化URL（添加协议等）
 * @param url - 原始URL
 * @returns 标准化后的URL
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';
  
  // 如果没有协议，添加https://
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  
  return url;
}

/**
 * 获取网站图标URL
 * @param domain - 域名
 * @param size - 图标大小，默认32
 * @returns 图标URL
 */
export function getFaviconUrl(domain: string, size: number = 32): string {
  return `https://www.google.com/s2/favicons?sz=${size}&domain=${domain}`;
}