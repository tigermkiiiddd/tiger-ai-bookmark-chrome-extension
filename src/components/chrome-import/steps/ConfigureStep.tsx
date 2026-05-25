import React from 'react';
import { AlertCircle, Sparkles } from 'lucide-react';
import type { SyncOptions } from '../../../types/index';

interface ConfigureStepProps {
  selectedFolders: string[];
  importOptions: SyncOptions;
  aiApiKey?: string;
  onUpdateOption: <K extends keyof SyncOptions>(key: K, value: SyncOptions[K]) => void;
}

export const ConfigureStep: React.FC<ConfigureStepProps> = ({
  selectedFolders,
  importOptions,
  aiApiKey,
  onUpdateOption,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          配置导入选项
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          将导入 {selectedFolders.length === 0 ? '所有' : selectedFolders.length + '个文件夹的'} 书签
        </p>
      </div>

      <div className="space-y-4">
        {/* 冲突处理 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            重复书签处理
          </label>
          <select
            value={importOptions.conflictResolution}
            onChange={(e) =>
              onUpdateOption(
                'conflictResolution',
                e.target.value as SyncOptions['conflictResolution']
              )
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="auto-merge">自动合并（推荐）</option>
            <option value="skip-conflicts">跳过重复项</option>
            <option value="manual">手动处理（精确控制）</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            自动合并会更新现有书签信息，手动处理可精确控制每个冲突
          </p>
        </div>

        {/* AI分析 */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              启用AI智能分析
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              为导入的书签自动生成标签和分类（需要配置Gemini API）
            </p>
          </div>
          <input
            type="checkbox"
            checked={importOptions.enableAIAnalysis}
            onChange={(e) => onUpdateOption('enableAIAnalysis', e.target.checked)}
            disabled={!aiApiKey}
            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary disabled:opacity-50"
          />
        </div>

        {!aiApiKey && importOptions.enableAIAnalysis && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm text-amber-800 dark:text-amber-200">
                需要先配置Gemini API密钥才能使用AI分析功能
              </span>
            </div>
          </div>
        )}

        {/* 批处理大小 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            批处理大小
          </label>
          <input
            type="number"
            min="10"
            max="200"
            value={importOptions.batchSize}
            onChange={(e) =>
              onUpdateOption('batchSize', parseInt(e.target.value) || 50)
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            每批处理的书签数量，数值越大导入越快，但可能导致浏览器卡顿
          </p>
        </div>

        {/* 包含子文件夹 */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              包含子文件夹
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              递归导入选中文件夹内的所有子文件夹书签
            </p>
          </div>
          <input
            type="checkbox"
            checked={importOptions.includeSubfolders}
            onChange={(e) => onUpdateOption('includeSubfolders', e.target.checked)}
            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
          />
        </div>
      </div>
    </div>
  );
};
