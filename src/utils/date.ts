/**
 * 日期工具函数
 */

/**
 * 格式化日期为可读字符串
 * @param date - 日期对象、时间戳或日期字符串
 * @param format - 格式类型，默认为'relative'
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date | string | number, format: 'relative' | 'full' | 'short' = 'relative'): string {
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return '无效日期';
  }
  
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (format === 'relative') {
    if (diffMinutes < 1) {
      return '刚刚';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}周前`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months}个月前`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years}年前`;
    }
  }
  
  if (format === 'short') {
    return dateObj.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // format === 'full'
  return dateObj.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 检查日期是否为今天
 * @param date - 要检查的日期
 * @returns 是否为今天
 */
export function isToday(date: Date | string | number): boolean {
  const dateObj = new Date(date);
  const today = new Date();
  
  return dateObj.toDateString() === today.toDateString();
}

/**
 * 检查日期是否为昨天
 * @param date - 要检查的日期
 * @returns 是否为昨天
 */
export function isYesterday(date: Date | string | number): boolean {
  const dateObj = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  return dateObj.toDateString() === yesterday.toDateString();
}

/**
 * 获取日期的开始时间（00:00:00）
 * @param date - 日期
 * @returns 该日期的开始时间
 */
export function getStartOfDay(date: Date | string | number): Date {
  const dateObj = new Date(date);
  dateObj.setHours(0, 0, 0, 0);
  return dateObj;
}

/**
 * 获取日期的结束时间（23:59:59）
 * @param date - 日期
 * @returns 该日期的结束时间
 */
export function getEndOfDay(date: Date | string | number): Date {
  const dateObj = new Date(date);
  dateObj.setHours(23, 59, 59, 999);
  return dateObj;
}