import React, { useState, useMemo } from 'react';
import { AlertTriangle, Check, X, ArrowRight, Info, Eye, EyeOff } from 'lucide-react';
import type { BookmarkConflict, Bookmark, ChromeBookmarkNode } from '../types/index';
import { useBookmarkStore } from '../store/index';
import { formatDate, buildTagPathByIdMap, getFlatTagDisplayNames } from '../utils/index';

interface BookmarkConflictResolverProps {
  conflicts: BookmarkConflict[];
  onResolve: (resolutions: Array<{ conflict: BookmarkConflict; resolution: 'merge' | 'skip' | 'replace' }>) => void;
  onCancel: () => void;
}

const BookmarkConflictResolver: React.FC<BookmarkConflictResolverProps> = ({
  conflicts,
  onResolve,
  onCancel
}) => {
  const [resolutions, setResolutions] = useState<Record<string, 'merge' | 'skip' | 'replace'>>(
    conflicts.reduce((acc, conflict, index) => {
      // 默认解决方案：URL相同时合并，标题相似时跳过
      const defaultResolution = conflict.reason === 'url-exists' ? 'merge' : 'skip';
      acc[index] = defaultResolution;
      return acc;
    }, {} as Record<string, 'merge' | 'skip' | 'replace'>)
  );

  const [expandedConflicts, setExpandedConflicts] = useState<Set<number>>(new Set());

  const storeTags = useBookmarkStore(s => s.tags);
  const tagPathMap = useMemo(() => buildTagPathByIdMap(storeTags), [storeTags]);

  const handleResolutionChange = (conflictIndex: number, resolution: 'merge' | 'skip' | 'replace') => {
    setResolutions(prev => ({
      ...prev,
      [conflictIndex]: resolution
    }));
  };

  const handleExpandToggle = (conflictIndex: number) => {
    setExpandedConflicts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conflictIndex)) {
        newSet.delete(conflictIndex);
      } else {
        newSet.add(conflictIndex);
      }
      return newSet;
    });
  };

  const handleApplyAll = (resolution: 'merge' | 'skip' | 'replace') => {
    const newResolutions: Record<string, 'merge' | 'skip' | 'replace'> = {};
    conflicts.forEach((_, index) => {
      newResolutions[index] = resolution;
    });
    setResolutions(newResolutions);
  };

  const handleSubmit = () => {
    const resolvedConflicts = conflicts.map((conflict, index) => ({
      conflict,
      resolution: resolutions[index]
    }));
    onResolve(resolvedConflicts);
  };

  const getResolutionIcon = (resolution: 'merge' | 'skip' | 'replace') => {
    switch (resolution) {
      case 'merge':
        return <ArrowRight className="w-4 h-4 text-blue-500" />;
      case 'skip':
        return <X className="w-4 h-4 text-gray-500" />;
      case 'replace':
        return <Check className="w-4 h-4 text-green-500" />;
    }
  };

  const getResolutionLabel = (resolution: 'merge' | 'skip' | 'replace') => {
    switch (resolution) {
      case 'merge':
        return '合并';
      case 'skip':
        return '跳过';
      case 'replace':
        return '替换';
    }
  };

  const getResolutionDescription = (resolution: 'merge' | 'skip' | 'replace') => {
    switch (resolution) {
      case 'merge':
        return '更新现有书签信息，保留标签和分类';
      case 'skip':
        return '保持现有书签不变，不导入Chrome书签';
      case 'replace':
        return '完全替换现有书签（会丢失原有标签和分类）';
    }
  };

  const getConflictReasonText = (reason: BookmarkConflict['reason']) => {
    switch (reason) {
      case 'url-exists':
        return 'URL已存在';
      case 'title-similar':
        return '标题相似';
      case 'duplicate':
        return '完全重复';
      default:
        return '未知冲突';
    }
  };

  const resolutionCounts = Object.values(resolutions).reduce((acc, resolution) => {
    acc[resolution] = (acc[resolution] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                解决书签冲突
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                发现 {conflicts.length} 个冲突需要处理
              </p>
            </div>
          </div>
          
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Batch Actions */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">批量操作:</span>
              <button
                onClick={() => handleApplyAll('merge')}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
                全部合并
              </button>
              <button
                onClick={() => handleApplyAll('skip')}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
              >
                <X className="w-3 h-3" />
                全部跳过
              </button>
              <button
                onClick={() => handleApplyAll('replace')}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors"
              >
                <Check className="w-3 h-3" />
                全部替换
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
              <span>合并: {resolutionCounts.merge || 0}</span>
              <span>跳过: {resolutionCounts.skip || 0}</span>
              <span>替换: {resolutionCounts.replace || 0}</span>
            </div>
          </div>
        </div>

        {/* Conflicts List */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            {conflicts.map((conflict, index) => {
              const isExpanded = expandedConflicts.has(index);
              const currentResolution = resolutions[index];

              return (
                <div 
                  key={index}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  {/* Conflict Header */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                          conflict.reason === 'url-exists' 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                            : conflict.reason === 'title-similar'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
                        }`}>
                          {getConflictReasonText(conflict.reason)}
                        </div>
                        
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {conflict.chromeBookmark.title}
                        </h3>

                        <button
                          onClick={() => handleExpandToggle(index)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Resolution Selector */}
                      <div className="flex items-center gap-2">
                        {(['merge', 'skip', 'replace'] as const).map((resolution) => (
                          <label
                            key={resolution}
                            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md cursor-pointer transition-colors ${
                              currentResolution === resolution
                                ? resolution === 'merge' 
                                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                  : resolution === 'skip'
                                  ? 'border-gray-500 bg-gray-50 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300'
                                  : 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`conflict-${index}`}
                              value={resolution}
                              checked={currentResolution === resolution}
                              onChange={() => handleResolutionChange(index, resolution)}
                              className="sr-only"
                            />
                            {getResolutionIcon(resolution)}
                            {getResolutionLabel(resolution)}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Resolution Description */}
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      {getResolutionDescription(currentResolution)}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Chrome Bookmark */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-2">
                            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                            Chrome书签
                          </h4>
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-sm">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {conflict.chromeBookmark.title}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 truncate">
                              {conflict.chromeBookmark.url}
                            </p>
                            {conflict.chromeBookmark.dateAdded && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                创建于: {formatDate(conflict.chromeBookmark.dateAdded)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Existing Bookmark */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-2">
                            <div className="w-4 h-4 bg-primary rounded-full"></div>
                            现有书签
                          </h4>
                          <div className="bg-primary/10 p-3 rounded-md text-sm">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {conflict.existingBookmark.title}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 truncate">
                              {conflict.existingBookmark.url}
                            </p>
                            <div className="mt-2 space-y-1">
                              {(() => {
                                const tagNames = getFlatTagDisplayNames(conflict.existingBookmark.tagIds, tagPathMap);
                                return tagNames.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {tagNames.slice(0, 3).map((tag) => (
                                      <span
                                        key={tag}
                                        className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                    {tagNames.length > 3 && (
                                      <span className="text-xs text-gray-500">
                                        +{tagNames.length - 3}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                              {conflict.existingBookmark.categoryId && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  分类: {conflict.existingBookmark.categoryId}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                创建于: {formatDate(conflict.existingBookmark.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Info className="w-4 h-4" />
            <span>处理完冲突后将继续导入其余书签</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              取消导入
            </button>
            
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-md transition-colors"
            >
              应用解决方案
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookmarkConflictResolver;