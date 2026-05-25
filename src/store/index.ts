import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Bookmark, Tag, Category, Settings, FilterOptions, AIAnalysisResult, BatchResult, TagSuggestion, CategorySuggestion, BookmarkSyncResult, ChromeBookmarkNode, SyncOptions } from '../types/index';
import { StorageService } from '../services/storage';
import { createCategoryActions } from './actions/categoryActions';
import { createTagActions } from './actions/tagActions';
import { createFilterActions } from './actions/filterActions';
import { bookmarkInitialState, createBookmarkSlice } from './slices/bookmarkSlice';
import { aiArchiveInitialState, createAIArchiveSlice } from './slices/aiArchiveSlice';
import { createScreenshotSlice } from './slices/screenshotSlice';
import { aiSuggestionsInitialState, createAISuggestionsSlice } from './slices/aiSuggestionsSlice';
import { settingsInitialState, createSettingsSlice } from './slices/settingsSlice';
import { tagAgentInitialState, createTagAgentSlice } from './slices/tagAgentSlice';
import type { AgentAction, AgentMessage } from './slices/tagAgentSlice';
import { createSyncSlice } from './slices/syncSlice';
import { uiInitialState, createUISlice } from './slices/uiSlice';

export interface PageStateSnapshot {
  scrollTop: number;
}

export interface PreviousPageInfo {
  path: string;
  state: PageStateSnapshot;
}

interface BookmarkStore {
  bookmarks: Bookmark[];
  filteredBookmarks: Bookmark[];
  tags: Tag[];
  categories: Category[];
  settings: Settings;

  searchQuery: string;
  activeFilters: FilterOptions;
  selectedBookmarks: string[];
  currentView: 'grid' | 'list' | 'domain';
  sortBy: 'createdAt' | 'category' | 'title' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
  expandedCategories: string[];

  editingBookmark: Bookmark | null;
  isEditModalOpen: boolean;

  isLoading: boolean;
  error: string | null;

  aiArchiveProgress?: {
    isActive: boolean;
    isPaused: boolean;
    current: number;
    total: number;
    currentBookmark: string;
    successCount: number;
    failureCount: number;
    skippedCount: number;
    completedCount: number;
    errors: Array<{ bookmarkId: string; message: string; retryCount: number; timestamp: number }>;
    startTime: number;
    estimatedTimeRemaining: number;
    processedIds: string[];
    succeededIds: string[];
    skippedIds: string[];
    processingBookmarkId: string[];
    currentIndex: number;
  };

  batchScreenshotProgress?: {
    isActive: boolean;
    isPaused: boolean;
    current: number;
    total: number;
    currentBookmark: string;
    successCount: number;
    failureCount: number;
    skippedCount: number;
  };

  aiArchiveGroomingProgress?: {
    isActive: boolean;
    processed: number;
    total: number;
    currentBookmark: string;
    errors: Array<{ bookmarkId: string; message: string }>;
  };

  lastBatchResult: BatchResult | null;

  tagStats: Record<string, number>;
  categoryStats: Record<string, number>;

  tagSuggestions: TagSuggestion[];
  isGeneratingSuggestions: boolean;
  suggestionError: string | null;

  categorySuggestions: CategorySuggestion[];
  isGeneratingCategorySuggestions: boolean;
  categorySuggestionError: string | null;

  agentMessages: AgentMessage[];
  isAgentProcessing: boolean;
  agentError: string | null;
  agentActionLog: AgentAction[];

  showRecoveryModal: boolean;
  recoveryInfo: {
    canRecover: boolean;
    totalBookmarks: number;
    processedCount: number;
    remainingCount: number;
    lastSaveTime: number;
  } | null;

  // Page state persistence
  pageStates: Record<string, PageStateSnapshot>;
  previousPage: PreviousPageInfo | null;
  sidebarOpen: boolean;
  sidebarSearchQuery: string;

  savePageState: (path: string, state: Partial<PageStateSnapshot>) => void;
  restorePageState: (path: string) => PageStateSnapshot | undefined;
  setSidebarOpen: (open: boolean) => void;
  setSidebarSearchQuery: (query: string) => void;
  recordPageNavigation: (fromPath: string, toPath: string) => void;

  loadBookmarks: (options?: { silent?: boolean }) => Promise<void>;
  migrateCategoryData: () => Promise<void>;
  addBookmark: (bookmark: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Bookmark>;
  updateBookmark: (id: string, updates: Partial<Bookmark>) => Promise<void>;
  updateBookmarksBatch: (updates: Array<{ id: string; patch: Partial<Bookmark> }>) => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  batchDeleteBookmarks: (ids: string[]) => Promise<void>;

  batchAIArchiveBookmarks: (bookmarkIds: string[]) => Promise<void>;
  startAutoArchive: () => Promise<void>;
  pauseArchive: () => void;
  resumeArchive: () => Promise<void>;
  cancelArchive: () => Promise<void>;

  checkForRecovery: () => Promise<boolean>;
  showRecoveryDialog: () => void;
  recoverFromCheckpoint: () => Promise<void>;
  clearCheckpoint: () => Promise<void>;

  processArchiveQueue: (bookmarksToProcess: Bookmark[]) => Promise<void>;
  calculateEstimatedTime: (currentIndex: number, total: number) => number;

  aiArchiveBookmark: (id: string, cachedContext?: unknown) => Promise<Partial<Bookmark>>;

  batchCaptureThumbnails: (bookmarkIds: string[], options?: { force?: boolean; cooldownHours?: number; extractSEO?: boolean }) => Promise<void>;
  cancelBatchCapture: () => void;
  refreshBookmarkThumbnail: (id: string) => Promise<void>;

  analyzeWithAI: (url: string, content?: string) => Promise<AIAnalysisResult>;
  autoTagBookmark: (id: string, content: string, url: string) => Promise<void>;
  generateTagSuggestions: () => Promise<void>;
  applyTagSuggestion: (suggestionId: string) => Promise<void>;
  rejectTagSuggestion: (suggestionId: string) => Promise<void>;

  generateCategorySuggestions: () => Promise<void>;
  applyCategorySuggestion: (suggestionId: string) => Promise<void>;
  rejectCategorySuggestion: (suggestionId: string) => void;

  sendAgentMessage: (text: string) => Promise<void>;
  clearAgentConversation: () => void;
  confirmAgentAction: (actionId: string) => void;
  rejectAgentAction: (actionId: string) => Promise<void>;
  undoAgentAction: (actionId: string) => Promise<void>;
  clearAgentActionLog: () => void;

  clearLastBatchResult: () => void;

  updateSettings: (updates: Partial<Settings>) => Promise<void>;

  exportToChrome: (bookmarkIds: string[], targetFolderId?: string) => Promise<void>;
  importChromeBookmarks: (
    options: SyncOptions,
    selectedFolders?: string[],
    onProgress?: (progress: { current: number; total: number }) => void
  ) => Promise<BookmarkSyncResult>;
  syncWithChrome: (options: SyncOptions) => Promise<void>;
  getChromeBookmarks: () => Promise<{ bookmarks: ChromeBookmarkNode[]; folders: ChromeBookmarkNode[] }>;
  clearAllData: () => Promise<void>;
  resetAllArchiveStatus: () => Promise<number>;
  exportData: () => Promise<string>;
  importData: (jsonData: string) => Promise<void>;
  createCheckpoint: () => Promise<string>;
  restoreCheckpoint: (jsonData: string) => Promise<void>;

  loadTags: () => Promise<void>;
  loadCategories: () => Promise<void>;

  loadSettings: () => Promise<void>;

  setSearchQuery: (query: string) => void;
  setActiveFilters: (filters: FilterOptions) => void;
  clearFilters: () => void;
  getFilteredBookmarks: () => Bookmark[];
  pageSize: number;
  displayedCount: number;
  loadMore: () => void;
  resetPagination: () => void;
  toggleCategoryExpansion: (categoryId: string) => void;

  setSelectedBookmarks: (bookmarkIds: string[]) => void;
  toggleBookmarkSelection: (bookmarkId: string) => void;
  clearSelection: () => void;

  setCurrentView: (view: 'grid' | 'list' | 'domain') => void;
  setSortBy: (sortBy: 'createdAt' | 'category' | 'title' | 'updatedAt') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;

  openEditModal: (bookmark: Bookmark) => void;
  closeEditModal: () => void;

  createCategory: (name: string, icon?: string) => Promise<string>;
  createSubCategory: (parentId: string, name: string, icon?: string) => Promise<void>;
  updateCategory: (categoryId: string, updates: Partial<Category>) => Promise<void>;
  moveCategory: (categoryId: string, newParentId: string | null) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  createTag: (name: string, color?: string) => Promise<void>;
  updateTag: (tagId: string, updates: Partial<Tag>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  renameTag: (id: string, newName: string) => Promise<void>;
  moveTag: (id: string, parentId?: string) => Promise<void>;
  mergeTags: (sourceTagIds: string[], targetTagId: string) => Promise<void>;
  deleteTags: (tagIds: string[]) => Promise<void>;
  cleanupOrphanedTagRefs: () => Promise<number>;

  setError: (error: string | null) => void;
  clearError: () => void;
}

const storageService = StorageService.getInstance();

export const useBookmarkStore = create<BookmarkStore>()(
  devtools(
    persist(
      (set, get) => ({
      ...bookmarkInitialState,
      ...aiArchiveInitialState,
      ...aiSuggestionsInitialState,
      ...settingsInitialState,
      ...uiInitialState,
      ...tagAgentInitialState,

      tags: [],
      categories: [],

      searchQuery: '',
      activeFilters: {
        tags: [],
        categories: [],
        status: []
      },
      selectedBookmarks: [],
      currentView: 'grid',
      sortBy: 'createdAt',
      sortOrder: 'desc',

      editingBookmark: null,
      isEditModalOpen: false,

      isLoading: false,
      error: null,

      // Page state persistence
      pageStates: {},
      previousPage: null,
      sidebarOpen: true,
      sidebarSearchQuery: '',

      savePageState: (path: string, state: Partial<PageStateSnapshot>) => {
        const { pageStates } = get();
        set({
          pageStates: {
            ...pageStates,
            [path]: { ...(pageStates[path] ?? { scrollTop: 0 }), ...state }
          }
        });
      },

      restorePageState: (path: string) => {
        const { pageStates } = get();
        return pageStates[path];
      },

      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      setSidebarSearchQuery: (query: string) => set({ sidebarSearchQuery: query }),

      recordPageNavigation: (fromPath: string) => {
        const { pageStates } = get();
        set({
          previousPage: {
            path: fromPath,
            state: pageStates[fromPath] ?? { scrollTop: 0 }
          }
        });
      },

      ...createBookmarkSlice(set, get),
      ...createAIArchiveSlice(set, get),
      ...createScreenshotSlice(set, get),
      ...createAISuggestionsSlice(set, get),
      ...createSettingsSlice(set, get),
      ...createSyncSlice(set, get),
      ...createUISlice(set, get),
      ...createTagAgentSlice(set, get),

      ...createCategoryActions(set, get, storageService),
      ...createTagActions(set, get, storageService),
      ...createFilterActions(set, get),
    }),
    {
      name: 'tigermark-store',
      partialize: (state: BookmarkStore) => ({
        currentView: state.currentView,
        searchQuery: state.searchQuery,
        activeFilters: state.activeFilters,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        expandedCategories: state.expandedCategories,
        pageStates: state.pageStates,
        sidebarOpen: state.sidebarOpen,
        sidebarSearchQuery: state.sidebarSearchQuery,
      })
    }
  ),
  { name: 'tigermark-store' }
)
);
