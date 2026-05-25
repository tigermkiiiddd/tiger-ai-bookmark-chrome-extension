import React from 'react';
import { FolderOpen, Loader } from 'lucide-react';
import type { ChromeBookmarkNode } from '../../../types/index';

interface FolderSelectStepProps {
  chromeBookmarks: ChromeBookmarkNode[];
  chromeFolders: ChromeBookmarkNode[];
  selectedFolders: string[];
  isLoading: boolean;
  onToggle: (folderId: string) => void;
  onSelectAll: () => void;
}

export const FolderSelectStep: React.FC<FolderSelectStepProps> = ({
  chromeBookmarks,
  chromeFolders,
  selectedFolders,
  isLoading,
  onToggle,
  onSelectAll,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          选择要导入的Chrome书签文件夹
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          找到 {chromeBookmarks.length} 个书签，分布在 {chromeFolders.length} 个文件夹中
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2">正在加载Chrome书签...</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedFolders.length === chromeFolders.length && chromeFolders.length > 0}
                onChange={onSelectAll}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                全选 ({chromeFolders.length} 个文件夹)
              </span>
            </label>

            {selectedFolders.length === 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                未选择文件夹将导入所有书签
              </span>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
            {chromeFolders.map((folder) => (
              <label
                key={folder.id}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedFolders.includes(folder.id)}
                  onChange={() => onToggle(folder.id)}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <FolderOpen className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-900 dark:text-white flex-1">
                  {folder.title}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
