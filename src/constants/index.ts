/**
 * 常量定义
 * 集中管理应用中的常量
 */

import { getRuntimeLocaleTag } from '../i18n';

// 应用信息
export const APP_INFO = {
  name: 'TIGERMARKIII',
  version: '1.0.0',
  description: 'AI智能收藏夹管理器',
  author: 'TIGERMARKIII Team'
} as const;

// 存储键名
export const STORAGE_KEYS = {
  BOOKMARKS: 'bookmarks',
  CATEGORIES: 'categories',
  SETTINGS: 'settings',
  TAGS: 'tags',
  AI_CACHE: 'aiCache',
  LINK_CHECK_PROGRESS: 'linkCheckProgress'
} as const;

// 默认设置
export const DEFAULT_SETTINGS = {
  theme: 'system' as const,
  aiAutoTagging: true,
  contentSafetyLevel: 'BLOCK_NONE' as const,
  syncDirection: 'bidirectional' as const
};

// 默认分类（仅一级；按普通人日常最常接触的场景划分，可自行增删改）
export const DEFAULT_CATEGORIES = [
  { name: '视频', color: '#A855F7', icon: '🎬', level: 1 as const, fullPath: '视频' },
  { name: '购物', color: '#F59E0B', icon: '🛒', level: 1 as const, fullPath: '购物' },
  { name: '社交', color: '#06B6D4', icon: '💬', level: 1 as const, fullPath: '社交' },
  { name: '资讯', color: '#DC2626', icon: '📰', level: 1 as const, fullPath: '资讯' },
  { name: '学习', color: '#84CC16', icon: '📚', level: 1 as const, fullPath: '学习' },
  { name: '生活', color: '#10B981', icon: '🏠', level: 1 as const, fullPath: '生活' },
  { name: '工作', color: '#374151', icon: '💼', level: 1 as const, fullPath: '工作' },
  { name: '游戏', color: '#8B5CF6', icon: '🎮', level: 1 as const, fullPath: '游戏' },
  { name: '音乐', color: '#EC4899', icon: '🎵', level: 1 as const, fullPath: '音乐' },
  { name: '阅读', color: '#F97316', icon: '📖', level: 1 as const, fullPath: '阅读' },
  { name: '工具', color: '#6B7280', icon: '🔧', level: 1 as const, fullPath: '工具' },
  { name: '其他', color: '#64748B', icon: '📁', level: 1 as const, fullPath: '其他' },
];

// 颜色主题
export const THEME_COLORS = {
  light: {
    primary: '#3B82F6',
    secondary: '#6B7280',
    background: '#FFFFFF',
    surface: '#F9FAFB',
    text: '#111827',
    textSecondary: '#6B7280'
  },
  dark: {
    primary: '#60A5FA',
    secondary: '#9CA3AF',
    background: '#111827',
    surface: '#1F2937',
    text: '#F9FAFB',
    textSecondary: '#D1D5DB'
  }
} as const;

// 分页配置
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
} as const;

// 分类树 taxonomy 规则 — AI 归档时使用
export const CATEGORY_TAXONOMY_RULES = {
  maxDepth: 4,
  levels: [
    {
      level: 1,
      name: '根分类',
      description: '宏观领域，如「视频」「购物」「学习」「生活」',
      recommendedNodeCount: { min: 3, max: 8 },
      recommendedBookmarksPerNode: { min: 30, max: Infinity },
      role: '领域划分，不直接存放书签',
    },
    {
      level: 2,
      name: '子分类',
      description: '领域下的主要分支，如「前端开发」「后端开发」',
      recommendedNodeCount: { min: 3, max: 12 },
      recommendedBookmarksPerNode: { min: 10, max: 40 },
      role: '方向划分，不直接存放书签',
    },
    {
      level: 3,
      name: '细分分类',
      description: '具体技术/主题，如「React」「Vue」',
      recommendedNodeCount: { min: 2, max: 8 },
      recommendedBookmarksPerNode: { min: 5, max: 20 },
      role: '主题聚合，少量书签可暂存',
    },
    {
      level: 4,
      name: '叶子分类',
      description:
        '最具体的归类：技术/主题子题（如「React Hooks」），或直接以作者/人名/角色名作 L4（如「手冢治虫」「路飞」，不加类型前缀）',
      recommendedNodeCount: { min: 1, max: 15 },
      recommendedBookmarksPerNode: { min: 1, max: 15 },
      role: '书签的最终归属层级',
    },
  ],
  decisionRules: [
    '优先复用已有分类路径，完全匹配时使用 reuse',
    '已有路径的前几级匹配、需补全末级时使用 extend',
    '确实无法归入任何已有路径时才 create 新路径',
    '书签应归入最深层级（优先第4级，至少第3级），不要挂在1-2级',
    '新建第4级（一般主题子题）前，确认同主题已有3个以上相似书签，否则归入已有 sibling',
    '第4级例外：内容以某位作者、特定人名或特定角色为核心时，L4 直接用该人名/角色名（勿加「漫画家·」「角色·」等前缀），即使仅一条书签也可 extend/create 到 L4，例如「阅读/漫画/少年漫画/手冢治虫」',
    '单一路径最多4级，用 / 分隔',
  ],
} as const;

// AI配置
export const AI_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  TIMEOUT: 30000,
  MAX_CONTENT_LENGTH: 8000,
  CACHE_DURATION: 24 * 60 * 60 * 1000 // 24小时
} as const;

// 链接检测配置
export const LINK_CHECK_CONFIG = {
  DEFAULT_TIMEOUT: 10000,
  MAX_CONCURRENT: 5,
  RETRY_ATTEMPTS: 2,
  BATCH_SIZE: 50
} as const;

// 文件大小限制
export const FILE_LIMITS = {
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_SCREENSHOT_SIZE: 2 * 1024 * 1024, // 2MB
  MAX_EXPORT_SIZE: 50 * 1024 * 1024 // 50MB
} as const;

// Checkpoint 版本号
export const CHECKPOINT_VERSION = 1;

// 正则表达式
export const REGEX = {
  URL: /^https?:\/\/.+/,
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  PHONE: /\+?[1-9]\d{1,14}/,
  CHINESE: /[\u4e00-\u9fff]/
} as const;

// 错误代码
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

// 事件类型
export const EVENT_TYPES = {
  BOOKMARK_ADDED: 'bookmark_added',
  BOOKMARK_UPDATED: 'bookmark_updated',
  BOOKMARK_DELETED: 'bookmark_deleted',
  CATEGORY_CREATED: 'category_created',
  CATEGORY_UPDATED: 'category_updated',
  CATEGORY_DELETED: 'category_deleted',
  SETTINGS_UPDATED: 'settings_updated',
  AI_ANALYSIS_COMPLETED: 'ai_analysis_completed',
  LINK_CHECK_COMPLETED: 'link_check_completed'
} as const;

// 消息类型
export const MESSAGE_TYPES = {
  PING: 'PING',
  ADD_BOOKMARK: 'ADD_BOOKMARK',
  ANALYZE_PAGE: 'ANALYZE_PAGE',
  GET_BOOKMARKS: 'GET_BOOKMARKS',
  GET_CHROME_BOOKMARKS: 'GET_CHROME_BOOKMARKS',
  IMPORT_CHROME_BOOKMARKS: 'IMPORT_CHROME_BOOKMARKS',
  SYNC_CHROME_BOOKMARKS: 'SYNC_CHROME_BOOKMARKS',
  EXPORT_TO_CHROME: 'EXPORT_TO_CHROME',
  CAPTURE_SCREENSHOT: 'CAPTURE_SCREENSHOT',
  GET_SCREENSHOT: 'GET_SCREENSHOT',
  BATCH_CHECK_LINKS: 'BATCH_CHECK_LINKS',
  GET_LINK_CHECK_PROGRESS: 'GET_LINK_CHECK_PROGRESS',
  PAUSE_LINK_CHECK: 'PAUSE_LINK_CHECK',
  RESUME_LINK_CHECK: 'RESUME_LINK_CHECK',
  STOP_LINK_CHECK: 'STOP_LINK_CHECK',
  AI_BOOKMARK_ENRICH: 'AI_BOOKMARK_ENRICH'
} as const;

// 状态枚举
export const BOOKMARK_STATUS = {
  ACTIVE: 'active',
  DEAD: 'dead',
  ARCHIVED: 'archived'
} as const;

export const LINK_STATUS = {
  PENDING: 'pending',
  CHECKING: 'checking',
  ACTIVE: 'active',
  DEAD: 'dead',
  TIMEOUT: 'timeout',
  BLOCKED: 'blocked',
  REDIRECT: 'redirect',
  UNKNOWN: 'unknown'
} as const;

export const PRIORITY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
} as const;

export const DIFFICULTY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced'
} as const;

// 工具函数
export const generateId = (): string => {
  return `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString(getRuntimeLocaleTag());
};

export const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString(getRuntimeLocaleTag());
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};
