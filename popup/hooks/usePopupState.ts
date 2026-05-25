import { useEffect, useReducer } from 'react';
import { useBookmarkStore } from '@/store';
import type { Bookmark, PageAnalysis } from '@/types';

interface PopupState {
  draftBookmark: Bookmark | null;
  pageAnalysis: PageAnalysis | null;
  isAnalyzing: boolean;
  isAdding: boolean;
  hasAnalyzed: boolean;
  showPageAnalysisModal: boolean;
  existingBookmark: Bookmark | null;
  isUpdateMode: boolean;
  categoriesLoaded: boolean;
  bookmarksLoaded: boolean;
  formErrors: Record<string, string>;
  analysisError: string | null;
  isCapturingScreenshot: boolean;
  screenshotError: string | null;
}

type PopupAction =
  | { type: 'SET_DRAFT'; payload: Bookmark | null }
  | { type: 'UPDATE_DRAFT'; payload: Partial<Bookmark> }
  | { type: 'SET_PAGE_ANALYSIS'; payload: PageAnalysis | null }
  | { type: 'SET_IS_ANALYZING'; payload: boolean }
  | { type: 'SET_IS_ADDING'; payload: boolean }
  | { type: 'SET_HAS_ANALYZED'; payload: boolean }
  | { type: 'SET_SHOW_PAGE_ANALYSIS_MODAL'; payload: boolean }
  | { type: 'SET_EXISTING_BOOKMARK'; payload: Bookmark | null }
  | { type: 'SET_IS_UPDATE_MODE'; payload: boolean }
  | { type: 'SET_CATEGORIES_LOADED'; payload: boolean }
  | { type: 'SET_BOOKMARKS_LOADED'; payload: boolean }
  | { type: 'SET_FORM_ERRORS'; payload: Record<string, string> }
  | { type: 'SET_ANALYSIS_ERROR'; payload: string | null }
  | { type: 'SET_IS_CAPTURING_SCREENSHOT'; payload: boolean }
  | { type: 'SET_SCREENSHOT_ERROR'; payload: string | null };

const initialState: PopupState = {
  draftBookmark: null,
  pageAnalysis: null,
  isAnalyzing: false,
  isAdding: false,
  hasAnalyzed: false,
  showPageAnalysisModal: false,
  existingBookmark: null,
  isUpdateMode: false,
  categoriesLoaded: false,
  bookmarksLoaded: false,
  formErrors: {},
  analysisError: null,
  isCapturingScreenshot: false,
  screenshotError: null,
};

function popupReducer(state: PopupState, action: PopupAction): PopupState {
  switch (action.type) {
    case 'SET_DRAFT':
      return { ...state, draftBookmark: action.payload };
    case 'UPDATE_DRAFT':
      return state.draftBookmark
        ? { ...state, draftBookmark: { ...state.draftBookmark, ...action.payload } }
        : state;
    case 'SET_PAGE_ANALYSIS':
      return { ...state, pageAnalysis: action.payload };
    case 'SET_IS_ANALYZING':
      return { ...state, isAnalyzing: action.payload };
    case 'SET_IS_ADDING':
      return { ...state, isAdding: action.payload };
    case 'SET_HAS_ANALYZED':
      return { ...state, hasAnalyzed: action.payload };
    case 'SET_SHOW_PAGE_ANALYSIS_MODAL':
      return { ...state, showPageAnalysisModal: action.payload };
    case 'SET_EXISTING_BOOKMARK':
      return { ...state, existingBookmark: action.payload };
    case 'SET_IS_UPDATE_MODE':
      return { ...state, isUpdateMode: action.payload };
    case 'SET_CATEGORIES_LOADED':
      return { ...state, categoriesLoaded: action.payload };
    case 'SET_BOOKMARKS_LOADED':
      return { ...state, bookmarksLoaded: action.payload };
    case 'SET_FORM_ERRORS':
      return { ...state, formErrors: action.payload };
    case 'SET_ANALYSIS_ERROR':
      return { ...state, analysisError: action.payload };
    case 'SET_IS_CAPTURING_SCREENSHOT':
      return { ...state, isCapturingScreenshot: action.payload };
    case 'SET_SCREENSHOT_ERROR':
      return { ...state, screenshotError: action.payload };
    default:
      return state;
  }
}

export function usePopupState() {
  const [state, dispatch] = useReducer(popupReducer, initialState);
  const { loadSettings, loadCategories, loadBookmarks } = useBookmarkStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await loadSettings();
        await loadCategories();
        await loadBookmarks();
        dispatch({ type: 'SET_CATEGORIES_LOADED', payload: true });
        dispatch({ type: 'SET_BOOKMARKS_LOADED', payload: true });
      } catch (error) {
        console.error('[usePopupState] 初始化失败:', error);
      }
    };
    initializeApp();
  }, [loadBookmarks, loadCategories, loadSettings]);

  return { state, dispatch };
}

export type { PopupState, PopupAction };
