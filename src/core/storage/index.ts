/**
 * 存储服务统一导出
 * 提供所有存储服务的统一访问入口
 */

export { ChromeStorageService, chromeStorage } from './chrome';
export { BookmarkStorageService, bookmarkStorage } from './bookmarks';
export { CategoryStorage, categoryStorage } from './categories';
export { SettingsStorageService, settingsStorage } from './settings';

// 重新导出类型
export type { StorageOptions } from './chrome';
export type { CreateCategoryData } from './categories';

