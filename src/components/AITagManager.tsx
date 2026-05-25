import React, { useEffect, useMemo, useState } from "react";
import { useBookmarkStore } from "../store";
import { Loader2, AlertCircle, X, Sparkles } from "lucide-react";
import {
  Bookmark,
  Category,
  CategorySuggestion,
  Tag,
  TagSuggestion,
} from "../types";
import { buildTagPathByIdMap } from "../utils/tagPath";

interface AITagManagerProps {
  onClose: () => void;
  tags: Tag[];
  bookmarks: Bookmark[];
  categories: Category[];
}

export const AITagManager: React.FC<AITagManagerProps> = ({
  onClose,
  tags,
  bookmarks,
  categories,
}) => {
  const {
    tagSuggestions,
    isGeneratingSuggestions,
    suggestionError,
    generateTagSuggestions,
    applyTagSuggestion,
    rejectTagSuggestion,
    categorySuggestions,
    isGeneratingCategorySuggestions,
    categorySuggestionError,
    generateCategorySuggestions,
    applyCategorySuggestion,
    rejectCategorySuggestion: rejectCategorySuggestionAction,
  } = useBookmarkStore();


  const tagPathMap = useMemo(() => buildTagPathByIdMap(tags), [tags]);

  const renderTagSuggestionCard = (suggestion: TagSuggestion) => {
    // 计算影响的书签数量
    const affectedBookmarks = bookmarks.filter(bookmark =>
      bookmark.tagIds?.some(tagId => suggestion.tagIdsToMerge.includes(tagId))
    ).length;
    
    return (
      <div key={suggestion.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
        <div className="mb-3">
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
              {suggestion.tagIdsToMerge.map((tagId, index) => (
                <span key={index} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                  {tagPathMap.get(tagId) || tagId}
                </span>
              ))}
            </div>
            <span className="text-gray-400">→</span>
            <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
              {suggestion.suggestedName}
            </span>
          </div>
        </div>
        
        <div className="mb-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">建议原因:</span> {suggestion.reason}
          </p>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
            onClick={() => applyTagSuggestion(suggestion.id)}
          >
            确认合并
          </button>
          <button
            className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            onClick={() => rejectTagSuggestion(suggestion.id)}
          >
            忽略
          </button>
        </div>
      </div>
    );
  };

  const renderCategorySuggestionCard = (suggestion: CategorySuggestion) => (
    <div key={suggestion.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
      <div className="mb-2">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          建议分类: '{suggestion.suggestedCategory}'
        </h4>
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          建议原因: {suggestion.reason}
        </p>
        <div className="flex justify-end space-x-2">
          <button
            className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            onClick={() => applyCategorySuggestion(suggestion.id)}
          >
            应用
          </button>
          <button
            className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
            onClick={() => rejectCategorySuggestionAction(suggestion.id)}
          >
            忽略
          </button>
        </div>
      </div>
    </div>
  );

  const [activeTab, setActiveTab] = useState<'tags' | 'categories'>('tags');

  const pendingTagSuggestions = tagSuggestions.filter(s => s.status === 'pending');
  const pendingCategorySuggestions = categorySuggestions.filter(s => s.status === 'pending');

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            优化标签和分类
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            分析全库标签与分类，给出合并冗余标签、补充缺失分类的建议
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          aria-label="关闭"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {suggestionError && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>标签建议：{suggestionError}</span>
        </div>
      )}
      {categorySuggestionError && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>分类建议：{categorySuggestionError}</span>
        </div>
      )}

      {/* Custom Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('tags')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tags'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            标签建议
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            分类建议
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'tags' && (
        <div className="space-y-4">
          {isGeneratingSuggestions && (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-6 h-6 mr-2 animate-spin text-blue-600" />
              <span className="text-gray-600 dark:text-gray-400">正在分析标签...</span>
            </div>
          )}

          {pendingTagSuggestions.length === 0 && !isGeneratingSuggestions && !suggestionError && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                当前共有 <span className="font-medium text-gray-900 dark:text-gray-100">{tags.length}</span> 个标签
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag.name}
                    className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
              <div className="flex justify-center pt-2">
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
                  onClick={() => generateTagSuggestions()}
                >
                  <Sparkles className="w-4 h-4" />
                  AI 分析标签
                </button>
              </div>
            </div>
          )}

          {pendingTagSuggestions.length > 0 && !isGeneratingSuggestions && (
            <>
              <div className="flex justify-end">
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
                  onClick={() => generateTagSuggestions()}
                >
                  <Sparkles className="w-4 h-4" />
                  重新分析
                </button>
              </div>
              <div className="space-y-3">
                {pendingTagSuggestions.map(renderTagSuggestionCard)}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-4">
          {isGeneratingCategorySuggestions && (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-6 h-6 mr-2 animate-spin text-blue-600" />
              <span className="text-gray-600 dark:text-gray-400">正在分析分类...</span>
            </div>
          )}

          {pendingCategorySuggestions.length === 0 && !isGeneratingCategorySuggestions && !categorySuggestionError && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                当前共有 <span className="font-medium text-gray-900 dark:text-gray-100">{categories.length}</span> 个分类
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {categories.map((cat) => {
                  const count = bookmarks.filter((b) => b.categoryId === cat.id).length;
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
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
                  onClick={() => generateCategorySuggestions()}
                >
                  <Sparkles className="w-4 h-4" />
                  AI 分析分类
                </button>
              </div>
            </div>
          )}

          {pendingCategorySuggestions.length > 0 && !isGeneratingCategorySuggestions && (
            <>
              <div className="flex justify-end">
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
                  onClick={() => generateCategorySuggestions()}
                >
                  <Sparkles className="w-4 h-4" />
                  重新分析
                </button>
              </div>
              <div className="space-y-3">
                {pendingCategorySuggestions.map(renderCategorySuggestionCard)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};