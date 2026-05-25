import React, { useState, useEffect } from 'react';
import { X, Save, Loader } from 'lucide-react';
import { Bookmark } from '../types/index';
import { useBookmarkStore } from '../store/index';
import BookmarkEditor from './BookmarkEditor';
import { extractDomain } from '../utils/index';

interface BookmarkEditModalProps {
  bookmark: Bookmark;
  isOpen: boolean;
  onClose: () => void;
}

const BookmarkEditModal: React.FC<BookmarkEditModalProps> = ({
  bookmark,
  isOpen,
  onClose
}) => {
  const [draft, setDraft] = useState<Bookmark>(bookmark);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { updateBookmark, categories, loadCategories } = useBookmarkStore();

  useEffect(() => {
    if (isOpen && bookmark) {
      if (!categories || categories.length === 0) {
        loadCategories();
      }
      setDraft(bookmark);
      setErrors({});
    }
  }, [isOpen, bookmark, categories, loadCategories]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!draft.title.trim()) {
      newErrors.title = '标题不能为空';
    }

    if (!draft.url.trim()) {
      newErrors.url = 'URL不能为空';
    } else {
      try {
        new URL(draft.url);
      } catch {
        newErrors.url = 'URL格式不正确';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await updateBookmark(bookmark.id, {
        title: draft.title.trim(),
        url: draft.url.trim(),
        description: draft.description?.trim(),
        tagIds: draft.tagIds,
        categoryId: draft.categoryId || undefined,
        updatedAt: Date.now()
      });

      onClose();
    } catch (error) {
      console.error('更新书签失败:', error);
      setErrors({ submit: '更新书签失败，请重试' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const domain = extractDomain(bookmark.url);
  const faviconUrl = bookmark.imagePreviewUrl || `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{ zIndex: 9999 }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[90vh] overflow-hidden relative z-[10000] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={faviconUrl}
              alt={domain}
              className="w-6 h-6 rounded"
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23ccc"/></svg>';
              }}
            />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              编辑书签
            </h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 overflow-y-auto flex-1">
            {errors.submit && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            <BookmarkEditor
              value={draft}
              onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
              categories={categories}
              errors={errors}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              取消
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isLoading ? '保存中...' : '保存更改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookmarkEditModal;
