/**
 * 类型定义
 * 保留原有的数据结构，优化类型定义
 */

/** 链接失效类型（仅两类） */
export type LinkFailureType = 'site_dead' | 'page_dead';

/** AI 归档前的链接检测策略 */
export type AiArchiveLinkCheckMode = 'strict' | 'lenient' | 'off';

/** 状态筛选项（含两类失效） */
export type StatusFilterValue =
  | 'unarchived'
  | 'active'
  | 'archived'
  | 'dead'
  | 'site_dead'
  | 'page_dead';

/** 书签预览图来源：整页截图 vs favicon/og 等占位 */
export type ImagePreviewKind = 'page_capture' | 'placeholder';

// 书签相关类型
export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description?: string;
  /** 引用 Tag.id 数组 */
  tagIds: string[];
  /** @deprecated 使用 categoryId 替代 */
  category?: string;
  categoryId?: string; // 引用 Category.id，书签的目录归属
  /** 链接健康：正常 / 失效（与 AI 归档独立） */
  status: 'active' | 'dead';
  /** AI 智能归档已完成 */
  isArchived?: boolean;
  /** AI 归档完成时间 */
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
  imagePreviewUrl?: string;
  /** 有值时优先于 URL 猜测；整页截图成功后应为 page_capture */
  imagePreviewKind?: ImagePreviewKind;
  /** 最近一次预览截图更新时间 */
  imagePreviewUpdatedAt?: number;
  aiGenerated?: AIAnalysisResult;
  chromeBookmarkId?: string;
  isSyncedFromChrome?: boolean;
  lastSyncAt?: number;
  notes?: string;
  favicon?: string;
  /** 失效细分：站点整体不可达 / 单页失效 */
  linkFailureType?: LinkFailureType | null;
  /** 最近一次链接检测完成时间 */
  lastLinkCheckedAt?: number;
  /** 是否已有链接检测记录（含迁移补标） */
  linkCheckRecorded?: boolean;
  /** 1-5 星评分，0 表示未评分 */
  rating?: number;
}

export interface AddBookmarkData {
  url: string;
  title: string;
  description?: string;
  tagIds?: string[];
  /** @deprecated */
  category?: string;
  categoryId?: string;
  status?: 'active' | 'dead';
  isArchived?: boolean;
  archivedAt?: number;
  imagePreviewUrl?: string;
  imagePreviewKind?: ImagePreviewKind;
  useAI?: boolean;
  content?: string;
}

export interface UpdateBookmarkData {
  url?: string;
  title?: string;
  description?: string;
  tagIds?: string[];
  /** @deprecated */
  category?: string;
  categoryId?: string;
  status?: 'active' | 'dead';
  isArchived?: boolean;
  archivedAt?: number;
  linkFailureType?: LinkFailureType | null;
  lastLinkCheckedAt?: number;
  linkCheckRecorded?: boolean;
  imagePreviewUrl?: string;
  imagePreviewKind?: ImagePreviewKind;
  imagePreviewUpdatedAt?: number;
  aiGenerated?: AIAnalysisResult;
  chromeBookmarkId?: string;
  isSyncedFromChrome?: boolean;
  lastSyncAt?: number;
  rating?: number;
}

// 分类相关类型 — 目录树节点
export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  parentId: string | null; // 父节点ID，根节点为 null
  createdAt: number;
  updatedAt?: number;
}

export interface CreateCategoryData {
  name: string;
  color?: string;
  icon?: string;
  parentId?: string | null;
}

// 设置相关类型
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  aiAutoTagging: boolean;
  syncDirection: 'import' | 'export' | 'bidirectional';
  aiApiKey?: string;
  aiApiBaseUrl?: string; // OpenAI兼容API基础URL
  aiModel?: string; // 模型名称
  aiProcessingDelay?: number;
  aiMaxConcurrent?: number;
  aiRateLimitMode?: 'conservative' | 'balanced' | 'aggressive';
  autoAnalysis?: boolean;
  enableChromeSync?: boolean;
  autoSync?: boolean;
  syncInterval?: number;
  lastSyncTime?: number;
  /** 最近一次批量链接检测完成时间 */
  lastLinkCheckAt?: number;
  /** 跳过近期已检测的书签 */
  linkCheckSkipRecently?: boolean;
  /** 跳过检测的时间窗口：1 个月 / 6 个月 / 1 年 */
  linkCheckSkipPeriod?: '1m' | '6m' | '1y';
  /** @deprecated 使用 linkCheckSkipPeriod */
  linkCheckSkipWithinHours?: number;
  /**
   * AI 归档前链接检测：strict=仅 active/redirect 可归档；lenient=超时/未知等不阻断；
   * off=不检测直接归档
   */
  aiArchiveLinkCheckMode?: AiArchiveLinkCheckMode;
  /** 内容安全级别 */
  contentSafetyLevel?: string;
}

// AI相关类型
export type CategoryDecision = 'reuse' | 'extend' | 'create';

export interface CategoryArchiveContext {
  categories: Category[];
  bookmarkCountByCategoryId: Map<string, number>;
}

export interface AIAnalysisResult {
  tags: string[];
  category: string;
  keywords: string[];
  summary: string;
  simulated_persona?: string;
  /** AI 对分类路径的决策：复用 / 扩展 / 新建 */
  categoryDecision?: CategoryDecision;
  /** 决策理由 */
  categoryReason?: string;
}

/** @deprecated 使用 AIAnalysisResult */
export type GeminiAnalysisResult = AIAnalysisResult;

// 页面分析类型
export interface PageInfo {
  url: string;
  title: string;
  favicon: string;
  screenshot?: string;
}

export interface PageAnalysis {
  title?: string;
  url?: string;
  content?: string;
  images?: string[];
  mainImage?: string;
  contentFeatures?: {
    contentType?: string;
    wordCount: number;
    paragraphCount: number;
    headingCount: number;
    estimatedReadingTime: number;
    techStack?: string[];
    hasCode?: boolean;
    hasVideo?: boolean;
    imageCount?: number;
    linkCount?: number;
  };
  contentStructure?: {
    hasHeader: boolean;
    hasFooter: boolean;
    hasSidebar: boolean;
    hasNav: boolean;
    sectionCount: number;
    estimatedReadingTime?: number;
    headings?: Record<string, number | string[]>;
    tables?: number;
    forms?: number;
    videos?: number;
    hasComments?: boolean;
    hasShareButtons?: boolean;
    hasNavigation?: boolean;
  };
  siteInfo?: {
    siteType: string;
    siteName: string;
    domain?: string;
    isSecure?: boolean;
  };
  seoMetadata?: {
    description?: string;
    keywords?: string[];
    author?: string;
  };
  timeInfo?: {
    publishedTime?: string;
    modifiedTime?: string;
    extractedAt?: string;
  };
  technicalInfo?: {
    frameworks?: string[];
    cms?: string;
    server?: string;
    encoding?: string;
    doctype?: string;
    isResponsive?: boolean;
    scripts?: number;
    stylesheets?: number;
  };
  languageInfo?: {
    primaryLanguage?: string;
    languages?: string[];
    isRTL?: boolean;
    detectedLanguage?: string;
    htmlLang?: string;
    isMultilingual?: boolean;
  };
}

// 搜索相关类型
export interface SearchQuery {
  query?: string;
  filters?: {
    tags?: string[];
    categories?: string[];
    status?: string[];
  };
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'category';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// 链接检测相关类型
export interface LinkCheckResult {
  bookmarkId?: string;
  url: string;
  status: 'active' | 'dead' | 'timeout' | 'unknown';
  failureType?: LinkFailureType;
  responseTime?: number;
  statusCode?: number;
  error?: string;
  checkedAt?: number;
  method?: string;
}

export interface LinkCheckProgress {
  total: number;
  completed: number;
  active: number;
  dead: number;
  errors: number;
  startTime: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
}

// Chrome同步相关类型
export interface ChromeBookmark {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  children?: ChromeBookmark[];
  dateAdded?: number;
  dateGroupModified?: number;
}

export interface ChromeSyncResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  conflicts: ConflictInfo[];
}

export interface ConflictInfo {
  chromeBookmark: ChromeBookmark;
  existingBookmark: Bookmark;
  reason: 'url-exists' | 'title-similar' | 'duplicate';
}

// 应用状态类型
export interface AppState {
  bookmarks: Bookmark[];
  categories: Category[];
  tags: string[];
  settings: Settings;
  isLoading: boolean;
  error: string | null;
  searchQuery: SearchQuery;
  selectedBookmarks: string[];
}

// 事件类型
export interface BookmarkEvent {
  type: 'added' | 'updated' | 'deleted' | 'archived';
  bookmark: Bookmark;
  timestamp: number;
}

export interface CategoryEvent {
  type: 'created' | 'updated' | 'deleted';
  category: Category;
  timestamp: number;
}

// 错误类型
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

// 统计类型
export interface BookmarkStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  recentCount: number;
  tagCounts: Record<string, number>;
}

// 导出相关类型
export interface ExportOptions {
  format: 'json' | 'csv' | 'html';
  includeArchived: boolean;
  includeAI: boolean;
}

export interface ImportOptions {
  mergeStrategy: 'skip' | 'replace' | 'merge';
  enableAIAnalysis: boolean;
  batchSize: number;
}

// 同步相关类型
export interface SyncOptions {
  mergeStrategy: 'skip' | 'replace' | 'merge';
  enableAIAnalysis: boolean;
  batchSize: number;
  selectedFolders?: string[];
  includeSubfolders?: boolean;
  conflictResolution?: 'skip' | 'replace' | 'merge' | 'manual' | 'auto-merge';
  resolvedConflicts?: Array<{
    conflict: ConflictInfo;
    resolution?: 'merge' | 'skip' | 'replace';
  }>;
}

export interface ConflictResolution {
  conflict: ConflictInfo;
  action: 'skip' | 'replace' | 'merge' | 'rename';
  result: Bookmark | null;
  timestamp: number;
}

// 标签相关类型
export interface Tag {
  id: string;
  name: string;
  color: string;
  parentId?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface TagTreeNode extends Tag {
  children: TagTreeNode[];
  level: number;
}

// 标签建议相关类型
export interface TagSuggestion {
  id: string;
  tagIdsToMerge: string[];
  suggestedName: string;
  reason: string;
  status: 'pending' | 'applied' | 'rejected';
}

// 分类建议相关类型
export interface CategorySuggestion {
  id: string;
  bookmarkIds: string[];
  suggestedCategory: string;
  reason: string;
  status: 'pending' | 'applied' | 'rejected';
}

// 批量处理结果类型
export interface BatchResult {
  total: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  errors: Array<{
    bookmarkId: string;
    message: string;
  }>;
  duration?: number;
}

// 归档错误类型
export interface ArchiveError {
  bookmarkId: string;
  bookmarkTitle: string;
  message: string;
  timestamp: number;
  retryCount: number;
}

// 过滤器选项类型
export interface FilterOptions {
  tags?: string[];
  categories?: string[];
  /** active | archived | site_dead | page_dead；dead 表示全部失效（兼容） */
  status?: StatusFilterValue[];
}

// 链接状态枚举
export enum LinkStatus {
  PENDING = 'pending',
  CHECKING = 'checking',
  ACTIVE = 'active',
  DEAD = 'dead',
  REDIRECT = 'redirect',
  BLOCKED = 'blocked',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

// 增强的链接检查结果
export interface EnhancedLinkCheckResult {
  bookmarkId?: string;
  url: string;
  status: LinkStatus;
  failureType?: LinkFailureType;
  statusCode?: number;
  responseTime?: number;
  error?: string;
  timestamp?: number;
  checkedAt?: number;
  method?: string;
  redirects?: string[];
  finalUrl?: string;
  redirectChain?: string[];
  strategy?: string;
  contentType?: string;
  lastModified?: string;
  serverInfo?: string;
  sslInfo?: {
    valid: boolean;
    issuer: string;
    expiresAt: number;
  };
  metadata?: {
    userAgent?: string;
    referer?: string;
    cookies?: string;
    headers?: Record<string, string>;
  };
}

// Chrome扩展消息类型
export interface ChromeMessage {
  type: string;
  payload?: any;
}

// Chrome书签节点（树形结构）
export interface ChromeBookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: ChromeBookmarkNode[];
  dateAdded?: number;
  dateGroupModified?: number;
  parentId?: string;
}

// 书签同步结果
export interface BookmarkSyncResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  conflicts: BookmarkConflict[];
}

// 书签冲突
export interface BookmarkConflict {
  chromeBookmark: ChromeBookmarkNode;
  existingBookmark: Bookmark;
  reason: 'url-exists' | 'title-similar' | 'duplicate';
}

// 截图选项
export interface ScreenshotOptions {
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

// 截图结果
export interface ScreenshotResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
  method: string;
  metadata?: {
    width: number;
    height: number;
    size: number;
    timestamp: number;
    strategy: string;
  };
}

// 批量截图进度
export interface BatchScreenshotProgress {
  current: number;
  total: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  currentUrl: string;
  currentTitle: string;
  isActive: boolean;
  isCancelled: boolean;
}

// 批量截图控制
export interface BatchScreenshotControl {
  shouldPause?: () => boolean;
  shouldStop?: () => boolean;
}

// 截图时提取的 SEO 数据
export interface CaptureSEOData {
  description?: string;
  favicon?: string;
}

// 域名分组统计
export interface DomainGroupStats {
  totalGroups: number;
  totalBookmarks: number;
  averageBookmarksPerGroup: number;
  topDomains: Array<{
    domain: string;
    count: number;
    favicon?: string;
  }>;
}

// 域名分组
export interface DomainGroup {
  id: string;
  domain: string;
  displayName: string;
  favicon?: string;
  bookmarkCount: number;
  bookmarkIds?: string[];
  createdAt?: number;
  updatedAt?: number;
}

// 域名分组完整结果
export interface DomainGroupResult {
  groups: DomainGroup[];
  stats: DomainGroupStats;
  ungroupedBookmarks: Bookmark[];
}

// 域名分组视图选项
export interface DomainGroupViewOptions {
  sortBy: 'bookmarkCount' | 'domain' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
  minBookmarkCount?: number;
  searchQuery?: string;
}

// URL 坟场：已删除书签的归档快照，不进入活跃 tag/category 树
export interface GraveyardEntry {
  id: string;
  /** 原书签 URL */
  url: string;
  title: string;
  description?: string;
  /** 标签路径快照（文本，如 "编程/TypeScript"），非 tagId 引用 */
  tagPaths: string[];
  /** 分类路径快照（文本，如 "技术/前端/React"），非 categoryId 引用 */
  categoryPath?: string;
  keywords?: string[];
  summary?: string;
  favicon?: string;
  /** 原书签评分 */
  rating?: number;
  /** 删除原因：手动 / 失效 / 批量 */
  deletedReason: 'manual' | 'dead' | 'batch';
  originalCreatedAt: number;
  deletedAt: number;
}

// 链接检查进度（别名）
export type CheckProgress = LinkCheckProgress;

