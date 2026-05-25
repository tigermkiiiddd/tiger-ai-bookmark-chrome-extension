import React from 'react';
import { CheckCircle } from 'lucide-react';
import type { BookmarkSyncResult } from '../../../types/index';

interface CompleteStepProps {
  importResult: BookmarkSyncResult | null;
}

export const CompleteStep: React.FC<CompleteStepProps> = ({ importResult }) => {
  return (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 mx-auto">
        <CheckCircle className="w-full h-full text-green-500" />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          导入完成！
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Chrome书签已成功导入到TIGERMARKIII
        </p>
      </div>

      {importResult && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-600 dark:text-green-400">
                成功导入: {importResult.imported}
              </span>
            </div>
            <div>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                已更新: {importResult.updated}
              </span>
            </div>
            <div>
              <span className="font-medium text-yellow-600 dark:text-yellow-400">
                已跳过: {importResult.skipped}
              </span>
            </div>
            <div>
              <span className="font-medium text-red-600 dark:text-red-400">
                失败: {importResult.errors}
              </span>
            </div>
          </div>

          {importResult.conflicts.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                发现 {importResult.conflicts.length} 个冲突项，已按设置处理
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
