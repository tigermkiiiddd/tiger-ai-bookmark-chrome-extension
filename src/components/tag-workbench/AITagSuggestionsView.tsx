import React from 'react';
import { useBookmarkStore } from '../../store';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';
import type { Bookmark, Tag, TagSuggestion } from '../../types';

interface AITagSuggestionsViewProps {
  tags: Tag[];
  bookmarks: Bookmark[];
  tagPathMap: Map<string, string>;
}

export const AITagSuggestionsView: React.FC<AITagSuggestionsViewProps> = ({
  tags,
  bookmarks,
  tagPathMap,
}) => {
  const {
    tagSuggestions,
    isGeneratingSuggestions,
    suggestionError,
    generateTagSuggestions,
    applyTagSuggestion,
    rejectTagSuggestion,
  } = useBookmarkStore();

  const pendingSuggestions = tagSuggestions.filter((s: TagSuggestion) => s.status === 'pending');

  const renderSuggestionCard = (suggestion: TagSuggestion) => {
    const affectedBookmarks = bookmarks.filter(b =>
      b.tagIds?.some(tid => suggestion.tagIdsToMerge.includes(tid))
    ).length;

    return (
      <div
        key={suggestion.id}
        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            合并标签建议
          </h4>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            影响 {affectedBookmarks} 个书签
          </span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <div className="flex flex-wrap gap-1">
            {suggestion.tagIdsToMerge.map((tagId, i) => (
              <span key={i} className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                {tagPathMap.get(tagId) || tagId}
              </span>
            ))}
          </div>
          <span className="text-gray-400">→</span>
          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-medium">
            {suggestion.suggestedName}
          </span>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          <span className="font-medium">原因:</span> {suggestion.reason}
        </p>

        <div className="flex justify-end space-x-2">
          <button
            className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
            onClick={() => applyTagSuggestion(suggestion.id)}
          >
            确认合并
          </button>
          <button
            className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            onClick={() => rejectTagSuggestion(suggestion.id)}
          >
            忽略
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {suggestionError && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{suggestionError}</span>
        </div>
      )}

      {isGeneratingSuggestions && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="w-6 h-6 mr-2 animate-spin text-blue-600" />
          <span className="text-gray-600 dark:text-gray-400">正在分析标签...</span>
        </div>
      )}

      {pendingSuggestions.length === 0 && !isGeneratingSuggestions && (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            当前共有 <span className="font-medium text-gray-900 dark:text-gray-100">{tags.length}</span> 个标签
          </div>
          <div className="flex justify-center pt-2">
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2 transition-colors"
              onClick={() => generateTagSuggestions()}
            >
              <Sparkles className="w-4 h-4" />
              AI 分析标签
            </button>
          </div>
        </div>
      )}

      {pendingSuggestions.length > 0 && !isGeneratingSuggestions && (
        <>
          <div className="flex justify-end">
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2 transition-colors"
              onClick={() => generateTagSuggestions()}
            >
              <Sparkles className="w-4 h-4" />
              重新分析
            </button>
          </div>
          <div className="space-y-3">
            {pendingSuggestions.map(renderSuggestionCard)}
          </div>
        </>
      )}
    </div>
  );
};
