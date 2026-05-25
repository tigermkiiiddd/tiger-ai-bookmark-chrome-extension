/**
 * 颜色工具函数
 */

// 预定义的标签颜色
const TAG_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300'
];

/**
 * 根据标签名称获取颜色类
 * @param tag - 标签名称
 * @returns Tailwind CSS颜色类字符串
 */
export function getTagColor(tag: string): string {
  // 使用标签名称的哈希值来确定颜色索引，确保同一标签总是使用相同颜色
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    const char = tag.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  
  const index = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[index];
}

/**
 * 根据状态获取颜色类
 * @param status - 书签状态
 * @returns Tailwind CSS颜色类字符串
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'text-green-600 dark:text-green-400';
    case 'archived':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'dead':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

/**
 * 生成随机颜色类
 * @returns 随机的Tailwind CSS颜色类字符串
 */
export function getRandomColor(): string {
  const randomIndex = Math.floor(Math.random() * TAG_COLORS.length);
  return TAG_COLORS[randomIndex];
}