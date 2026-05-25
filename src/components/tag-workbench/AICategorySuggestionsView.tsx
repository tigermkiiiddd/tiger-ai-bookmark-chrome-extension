import React from 'react';
import { useBookmarkStore } from '../../store';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';
import type { Bookmark, Category, CategorySuggestion } from '../../types';

interface AICategorySuggestionsViewProps {
  categories: Category[];
  bookmarks: Bookmark[];
}

export const AICategorySuggestionsView: React.FC<AICategorySuggestionsViewProps> = ({
  categories,
  bookmarks,
}) => {
  const {
    categorySuggestions,
    isGeneratingCategorySuggestions,
    categorySuggestionError,
    generateCategorySuggestions,
    applyCategorySuggestion,
    rejectCategorySuggestion,
  } = useBookmarkStore();

  const pendingSuggestions = categorySuggestions.filter((s: CategorySuggestion) => s.status === 'pending');

  const renderCard = (suggestion: CategorySuggestion) => (
    <div
      key={suggestion.id}
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
    >
      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
        建议分类: '{suggestion.suggestedCategory}'
      </h4>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        原因: {suggestion.reason}
      </p>
      <div className="flex justify-end space-x-2">
        <button
          className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
          onClick={() => applyCategorySuggestion(suggestion.id)}
        >
          应用
        </button>
        <button
          className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          onClick={() => rejectCategorySuggestion(suggestion.id)}
        >
          忽略
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {categorySuggestionError && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{categorySuggestionError}</span>
        </div>
      )}

      {isGeneratingCategorySuggestions && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="w-6 h-6 mr-2 animate-spin text-blue-600" />
          <span className="text-gray-600 dark:text-gray-400">正在分析分类...</span>
        </div>
      )}

      {pendingSuggestions.length === 0 && !isGeneratingCategorySuggestions && (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            当前共有 <span className="font-medium text-gray-900 dark:text-gray-100">{categories.length}</span> 个分类
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {categories.map(cat => {
              const count = bookmarks.filter(b => b.categoryId === cat.id).length;
              return (
                <div key={cat.id} className="flex justify-between items-center text-sm px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <span className="text-gray-800 dark:text-gray-200">{cat.name}</span>
                  <span className="text-gray-500">{count} 个书签</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center pt-2">
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2 transition-colors"
              onClick={() => generateCategorySuggestions()}
            >
              <Sparkles className="w-4 h-4" />
              AI 分析分类
            </button>
          </div>
        </div>
      )}

      {pendingSuggestions.length > 0 && !isGeneratingCategorySuggestions && (
        <>
          <div className="flex justify-end">
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2 transition-colors"
              onClick={() => generateCategorySuggestions()}
            >
              <Sparkles className="w-4 h-4" />
              重新分析
            </button>
          </div>
          <div className="space-y-3">
            {pendingSuggestions.map(renderCard)}
          </div>
        </>
      )}
    </div>
  );
};
