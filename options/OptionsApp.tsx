import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useBookmarkStore } from '../src/store/index';
import { beginBatch, endBatch } from '../src/store/actions/filterActions';
import { chromeStorage } from '../src/core/storage/chrome';
import { useLibraryScopeSync } from '../src/hooks/useLibraryScopeSync';
import Layout from '../src/components/Layout';
import MainPage from '../src/components/MainPage';
import SettingsPage from '../src/components/SettingsPage';
import SearchResults from '../src/components/SearchResults';
import CategoryPage from '../src/components/CategoryPage';
import TagPage from '../src/components/TagPage';
import BrokenLinksPage from '../src/components/BrokenLinksPage';
import LinkCheckPage from '../src/components/LinkCheckPage';
import AiArchivePage from '../src/components/AiArchivePage';
import DedupPage from '../src/components/DedupPage';
import RecoveryModal from '../src/components/RecoveryModal';
import GraveyardPage from '../src/components/GraveyardPage';
import TagWorkbenchPage from '../src/components/tag-workbench/TagWorkbenchPage';

const OptionsApp: React.FC = () => {
  const { 
    error, 
    loadBookmarks, 
    loadSettings, 
    loadTags, 
    loadCategories,
    checkForRecovery,
    showRecoveryModal,
    clearCheckpoint,
  } = useBookmarkStore();

  useLibraryScopeSync();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        beginBatch();
        await Promise.all([
          loadSettings(),
          loadBookmarks({ silent: true }),
          loadTags(),
          loadCategories()
        ]);
        endBatch();
        await checkForRecovery();
      } catch (err) {
        endBatch();
        console.error('OptionsApp 初始化失败:', err);
      }
    };

    void initializeApp();
  }, [loadBookmarks, loadSettings, loadTags, loadCategories, checkForRecovery]);

  // 监听存储变化（仅本上下文内有效；跨上下文靠 visibilitychange 兜底）
  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.bookmarks) {
        console.log('📦 OptionsApp - 检测到书签数据变化，自动刷新');
        void loadBookmarks({ silent: true });
      }
      if (changes.tags) {
        console.log('🏷️ OptionsApp - 检测到标签数据变化，自动刷新');
        void loadTags();
      }
    };
    chromeStorage.onChanged(handleStorageChange);
    return () => chromeStorage.removeListener(handleStorageChange);
  }, [loadBookmarks, loadTags]);

  // popup/background 写入后 options 页不会收到 onChanged，切回页面时自动刷新
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadBookmarks({ silent: true });
        void loadTags();
        void loadCategories();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadBookmarks, loadTags, loadCategories]);

  return (
    <>
      {error ? (
        <div
          role="alert"
          className="flex-shrink-0 px-4 py-2 text-sm bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-b border-red-200 dark:border-red-800"
        >
          {String(error)}
        </div>
      ) : null}
      <Layout>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/category/:categoryName" element={<CategoryPage />} />
          <Route path="/tag/:tagName" element={<TagPage />} />
          <Route path="/link-check" element={<LinkCheckPage />} />
          <Route path="/ai-archive" element={<AiArchivePage />} />
          <Route path="/broken-links" element={<BrokenLinksPage />} />
          <Route path="/dedup" element={<DedupPage />} />
          <Route path="/tag-workbench" element={<TagWorkbenchPage />} />
          <Route path="/graveyard" element={<GraveyardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      
      {/* 断点续传恢复对话框 */}
      {showRecoveryModal && (
        <RecoveryModal 
          isOpen={showRecoveryModal}
          onClose={() => clearCheckpoint()}
        />
      )}
    </>
  );
};

export default OptionsApp;
