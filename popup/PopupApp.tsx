import React, { useEffect, useMemo, useRef } from 'react';
import { Settings, Eye } from 'lucide-react';
import { useBookmarkStore } from '@/store';
import BookmarkEditor from '@/components/BookmarkEditor';
import PageAnalysisModal from '@/components/PageAnalysisModal';
import { fetchPageAnalysis } from '@/services/pageAnalysisService';
import { applyAICategoryFromAnalysis } from '@/utils/applyAICategoryFromAnalysis';
import type { Bookmark, PageAnalysis } from '@/types';

import { usePopupState } from './hooks/usePopupState';
import PopupStickyActionBar from './components/PopupStickyActionBar';
import PopupDuplicateHint from './components/PopupDuplicateHint';
import { findSuspectedDuplicates } from '@/services/deduplication';
import {
  buildDraftBookmark,
  DRAFT_BOOKMARK_ID,
  mapSnapshotFromContentScript,
} from './utils/buildDraftBookmark';
import { validateDraftBookmark } from './utils/validateDraftBookmark';
import { captureTabScreenshot } from './utils/captureTabScreenshot';
import { PAGE_CAPTURE_PREVIEW_PATCH } from '@/utils/bookmarkThumbnail';

const PopupApp: React.FC = () => {
  const { state, dispatch } = usePopupState();
  const {
    addBookmark,
    updateBookmark,
    analyzeWithAI,
    loadCategories,
    createCategory,
    settings,
    categories,
    bookmarks,
  } = useBookmarkStore();

  const userEditedDraftRef = useRef(false);

  const loadPageIntoDraft = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !tab.id) return;

      let snapshot = mapSnapshotFromContentScript({
        title: tab.title || '',
        url: tab.url,
        favicon: tab.favIconUrl,
      });

      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });
        const pageData = response?.success ? response.data : response;
        if (pageData?.url) {
          snapshot = mapSnapshotFromContentScript(pageData);
        }
      } catch {
        // content script 未注入时仅用 tab 元数据
      }

      const existing = bookmarks.find((b) => b.url === tab.url) ?? null;
      const draft = buildDraftBookmark(snapshot, existing);

      dispatch({ type: 'SET_DRAFT', payload: draft });
      if (existing) {
        dispatch({ type: 'SET_EXISTING_BOOKMARK', payload: existing });
        dispatch({ type: 'SET_IS_UPDATE_MODE', payload: true });
      } else {
        dispatch({ type: 'SET_EXISTING_BOOKMARK', payload: null });
        dispatch({ type: 'SET_IS_UPDATE_MODE', payload: false });
      }

      // 打开 popup 时自动截图（不阻塞 UI）
      if (tab.id) {
        (async () => {
          try {
            const shot = await captureTabScreenshot(tab.id!);
            if (shot.dataUrl && shot.isPageCapture) {
              dispatch({
                type: 'UPDATE_DRAFT',
                payload: {
                  imagePreviewUrl: shot.dataUrl,
                  imagePreviewUpdatedAt: Date.now(),
                  ...PAGE_CAPTURE_PREVIEW_PATCH,
                },
              });
            }
          } catch (err) {
            console.warn('[Popup] 自动截图失败:', err);
          }
        })();
      }
    } catch (error) {
      console.error('Failed to load page into draft:', error);
    }
  };

  useEffect(() => {
    if (!state.categoriesLoaded || !state.bookmarksLoaded) return;
    if (userEditedDraftRef.current) return;
    void loadPageIntoDraft();
  }, [state.categoriesLoaded, state.bookmarksLoaded, bookmarks]);

  const buildAnalysisContent = (draft: Bookmark) =>
    `${draft.title} ${draft.description || ''} ${draft.url}`.trim();

  const applyAnalysisToDraft = async (analysis: Awaited<ReturnType<typeof analyzeWithAI>>) => {
    const draft = state.draftBookmark;
    if (!draft) return;

    const categoryId = await applyAICategoryFromAnalysis(analysis);
    await loadCategories();

    dispatch({
      type: 'UPDATE_DRAFT',
      payload: {
        tagIds: analysis.tags || [],
        categoryId: categoryId || draft.categoryId,
        description: analysis.summary || draft.description,
        aiGenerated: analysis,
      },
    });
    dispatch({ type: 'SET_HAS_ANALYZED', payload: true });
    dispatch({ type: 'SET_ANALYSIS_ERROR', payload: null });
  };

  const handleStartAnalysis = async () => {
    const draft = state.draftBookmark;
    if (!draft?.url) return;

    if (!settings.aiApiKey?.trim()) {
      dispatch({ type: 'SET_ANALYSIS_ERROR', payload: '请先在设置中配置 AI API 密钥' });
      return;
    }

    dispatch({ type: 'SET_IS_ANALYZING', payload: true });
    dispatch({ type: 'SET_ANALYSIS_ERROR', payload: null });

    try {
      const content = buildAnalysisContent(draft);
      if (!content) {
        throw new Error('无法提取页面内容，请填写标题或描述后重试');
      }
      const analysis = await analyzeWithAI(draft.url, content);
      await applyAnalysisToDraft(analysis);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI分析失败';
      dispatch({ type: 'SET_ANALYSIS_ERROR', payload: message });
      console.error('Analysis failed:', error);
    } finally {
      dispatch({ type: 'SET_IS_ANALYZING', payload: false });
    }
  };

  const bookmarkPayloadFromDraft = (draft: Bookmark) => ({
    title: draft.title.trim(),
    url: draft.url.trim(),
    description: draft.description?.trim(),
    tagIds: draft.tagIds || [],
    categoryId: draft.categoryId || undefined,
    notes: draft.notes?.trim() || undefined,
    favicon: draft.favicon,
    imagePreviewUrl: draft.imagePreviewUrl,
    imagePreviewKind: draft.imagePreviewKind,
    aiGenerated: draft.aiGenerated,
    status:
      state.isUpdateMode && state.existingBookmark
        ? state.existingBookmark.status
        : ('active' as const),
    isArchived:
      state.isUpdateMode && state.existingBookmark
        ? state.existingBookmark.isArchived
        : undefined,
    archivedAt:
      state.isUpdateMode && state.existingBookmark
        ? state.existingBookmark.archivedAt
        : undefined,
  });

  /** 保存前：仅占位图或无图时再截整页 */
  const ensureDraftScreenshot = async (draft: Bookmark) => {
    const payload = bookmarkPayloadFromDraft(draft);
    if (payload.imagePreviewKind === 'page_capture' && payload.imagePreviewUrl) {
      return payload;
    }
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const shot = await captureTabScreenshot(tab.id);
        if (shot.dataUrl && shot.isPageCapture) {
          return {
            ...payload,
            imagePreviewUrl: shot.dataUrl,
            imagePreviewKind: 'page_capture' as const,
          };
        }
      }
    } catch {
      // 受限页面等场景允许无缩略图保存
    }
    return payload;
  };

  const handleDirectAdd = async () => {
    const draft = state.draftBookmark;
    if (!draft) return;

    const errors = validateDraftBookmark(draft);
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'SET_FORM_ERRORS', payload: errors });
      return;
    }
    dispatch({ type: 'SET_FORM_ERRORS', payload: {} });

    dispatch({ type: 'SET_IS_ADDING', payload: true });
    try {
      const payload = await ensureDraftScreenshot(draft);
      if (state.isUpdateMode && state.existingBookmark) {
        await updateBookmark(state.existingBookmark.id, payload);
      } else {
        await addBookmark(payload);
      }
      window.close();
    } catch (error) {
      console.error('Failed to save bookmark:', error);
    } finally {
      dispatch({ type: 'SET_IS_ADDING', payload: false });
    }
  };

  const handleSmartAdd = async () => {
    const draft = state.draftBookmark;
    if (!draft) return;

    const errors = validateDraftBookmark(draft);
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'SET_FORM_ERRORS', payload: errors });
      return;
    }
    dispatch({ type: 'SET_FORM_ERRORS', payload: {} });

    if (!settings.aiApiKey?.trim()) {
      return handleDirectAdd();
    }

    dispatch({ type: 'SET_IS_ADDING', payload: true });
    let savedBookmark: Bookmark | null = null;

    try {
      let pageAnalysis: PageAnalysis | undefined;
      try {
        const pageResult = await fetchPageAnalysis();
        if (pageResult.success && pageResult.data) {
          pageAnalysis = pageResult.data;
        }
      } catch {}

      const payload = await ensureDraftScreenshot(draft);

      const sendEnrich = async (bookmarkId: string) => {
        const response = await chrome.runtime.sendMessage({
          type: 'AI_BOOKMARK_ENRICH',
          payload: {
            bookmarkId,
            ...(pageAnalysis ? { pageAnalysis } : {}),
          },
        });
        if (!response?.success) {
          throw new Error(response?.error || '后台 AI 任务入队失败');
        }
      };

      if (state.isUpdateMode && state.existingBookmark) {
        await updateBookmark(state.existingBookmark.id, payload);
        savedBookmark = { ...state.existingBookmark, ...payload };
        await sendEnrich(state.existingBookmark.id);
      } else {
        const saved = await addBookmark(payload);
        savedBookmark = saved;
        await sendEnrich(saved.id);
      }

      window.close();
    } catch (error) {
      if (savedBookmark) {
        console.error('[Popup] 书签已保存，但后台 AI 任务入队失败:', error);
        dispatch({ type: 'SET_EXISTING_BOOKMARK', payload: savedBookmark });
        dispatch({ type: 'SET_IS_UPDATE_MODE', payload: true });
        dispatch({
          type: 'SET_ANALYSIS_ERROR',
          payload: '书签已保存，但后台 AI 任务创建失败，请稍后重试 AI 智能分析',
        });
        return;
      }

      console.error('[Popup] 智能添加失败，降级为直接保存:', error);
      try {
        const payload = await ensureDraftScreenshot(draft);
        if (state.isUpdateMode && state.existingBookmark) {
          await updateBookmark(state.existingBookmark.id, payload);
        } else {
          await addBookmark(payload);
        }
        window.close();
      } catch (fallbackError) {
        console.error('[Popup] 降级保存也失败:', fallbackError);
      }
    } finally {
      dispatch({ type: 'SET_IS_ADDING', payload: false });
    }
  };

  const suspectedDuplicates = useMemo(() => {
    const url = state.draftBookmark?.url;
    if (!url?.trim()) return [];

    const excludeIds: string[] = [];
    if (state.isUpdateMode && state.existingBookmark) {
      excludeIds.push(state.existingBookmark.id);
    }
    if (
      state.draftBookmark?.id &&
      state.draftBookmark.id !== DRAFT_BOOKMARK_ID &&
      !excludeIds.includes(state.draftBookmark.id)
    ) {
      excludeIds.push(state.draftBookmark.id);
    }

    return findSuspectedDuplicates(url, bookmarks, excludeIds);
  }, [
    state.draftBookmark?.url,
    state.draftBookmark?.id,
    state.isUpdateMode,
    state.existingBookmark,
    bookmarks,
  ]);

  const handleRefreshScreenshot = async () => {
    dispatch({ type: 'SET_SCREENSHOT_ERROR', payload: null });
    dispatch({ type: 'SET_IS_CAPTURING_SCREENSHOT', payload: true });

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        dispatch({
          type: 'SET_SCREENSHOT_ERROR',
          payload: '无法获取当前标签页，请在本页打开要收藏的网站后再试',
        });
        return;
      }

      const shot = await captureTabScreenshot(tab.id);
      if (!shot.dataUrl || !shot.isPageCapture) {
        dispatch({
          type: 'SET_SCREENSHOT_ERROR',
          payload:
            '截图失败：请等页面加载完成后再试，且不要使用 chrome:// 等浏览器内置页',
        });
        return;
      }

      const previewPatch = {
        imagePreviewUrl: shot.dataUrl,
        imagePreviewUpdatedAt: Date.now(),
        ...PAGE_CAPTURE_PREVIEW_PATCH,
      };

      dispatch({ type: 'UPDATE_DRAFT', payload: previewPatch });

      if (state.isUpdateMode && state.existingBookmark) {
        await updateBookmark(state.existingBookmark.id, {
          ...previewPatch,
          isArchived: state.existingBookmark.isArchived,
          archivedAt: state.existingBookmark.archivedAt,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '截图失败，请稍后重试';
      dispatch({ type: 'SET_SCREENSHOT_ERROR', payload: message });
      console.error('[Popup] 手动截图失败:', error);
    } finally {
      dispatch({ type: 'SET_IS_CAPTURING_SCREENSHOT', payload: false });
    }
  };

  const handleFetchPageAnalysis = async () => {
    const result = await fetchPageAnalysis();
    if (result.success && result.data) {
      dispatch({ type: 'SET_PAGE_ANALYSIS', payload: result.data });

      // SEO description 自动回填到 draft
      const draft = state.draftBookmark;
      const seoDesc = result.data.seoMetadata?.description?.trim();
      if (draft && seoDesc && !draft.description?.trim()) {
        dispatch({ type: 'UPDATE_DRAFT', payload: { description: seoDesc } });
      }
    }
    dispatch({ type: 'SET_SHOW_PAGE_ANALYSIS_MODAL', payload: true });
  };

  return (
    <div className="popup-shell text-gray-900">
      <header className="shrink-0 px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-primary to-primary-hover text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐅</span>
            <h1 className="text-lg font-semibold">TIGERMARKIII</h1>
          </div>
          <button
            type="button"
            onClick={() => chrome.runtime.openOptionsPage()}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            title="设置"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-1 text-sm opacity-90">
          {state.isUpdateMode ? '更新书签' : '添加书签'}
        </div>
      </header>

      <PopupStickyActionBar
        isUpdateMode={state.isUpdateMode}
        isAnalyzing={state.isAnalyzing}
        isAdding={state.isAdding}
        canUseAI={!!settings.aiApiKey?.trim()}
        hasAnalyzed={state.hasAnalyzed}
        onStartAnalysis={handleStartAnalysis}
        onDirectAdd={handleDirectAdd}
        onSmartAdd={handleSmartAdd}
      />

      <main className="popup-scroll">
        <div className="popup-scroll-inner">
          {state.analysisError && (
            <div className="mb-3 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
              {state.analysisError}
            </div>
          )}

          {state.draftBookmark ? (
            <>
              {state.screenshotError && (
                <div className="mb-2 p-2.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
                  {state.screenshotError}
                </div>
              )}

              <section className="popup-preview-slot mb-3" aria-label="页面预览">
                <BookmarkEditor
                  layout="popup"
                  popupSection="preview"
                  value={state.draftBookmark}
                  onChange={() => {}}
                  categories={categories}
                  disabled={state.isAnalyzing || state.isAdding || state.isCapturingScreenshot}
                  showScreenshotRefresh
                  onRefreshScreenshot={() => void handleRefreshScreenshot()}
                  isRefreshingScreenshot={state.isCapturingScreenshot}
                />
              </section>

              <PopupDuplicateHint matches={suspectedDuplicates} />

              <BookmarkEditor
                layout="popup"
                popupSection="form"
                value={state.draftBookmark}
                onChange={(patch) => {
                  userEditedDraftRef.current = true;
                  dispatch({ type: 'UPDATE_DRAFT', payload: patch });
                }}
                categories={categories}
                categoriesLoaded={state.categoriesLoaded}
                onCreateCategory={async (name) => {
                  const id = await createCategory(name);
                  await loadCategories();
                  return id;
                }}
                errors={state.formErrors}
                disabled={state.isAnalyzing || state.isAdding}
                showNotes
                urlReadOnly
              />

              <button
                type="button"
                onClick={handleFetchPageAnalysis}
                className="mt-4 flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover transition-colors"
              >
                <Eye className="w-4 h-4" />
                详细分析（页面结构）
              </button>
            </>
          ) : (
            <div className="py-8 text-center text-sm text-gray-500">正在加载页面信息...</div>
          )}
        </div>
      </main>

      {state.showPageAnalysisModal && (
        <PageAnalysisModal
          isOpen={state.showPageAnalysisModal}
          onClose={() => dispatch({ type: 'SET_SHOW_PAGE_ANALYSIS_MODAL', payload: false })}
          url={state.draftBookmark?.url}
          initialPageAnalysis={state.pageAnalysis ?? undefined}
        />
      )}
    </div>
  );
};

export default PopupApp;
