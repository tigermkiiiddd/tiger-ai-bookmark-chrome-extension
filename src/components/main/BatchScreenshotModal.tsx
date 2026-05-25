import React, { useState } from 'react';
import { useBookmarkStore } from '../../store';

import type { Bookmark } from '../../types';

interface BatchScreenshotModalProps {
  onClose: () => void;
  filteredBookmarks: Bookmark[];
}

const BatchScreenshotModal: React.FC<BatchScreenshotModalProps> = ({ onClose, filteredBookmarks }) => {
  const bookmarks = useBookmarkStore(s => s.bookmarks);
  const selectedBookmarks = useBookmarkStore(s => s.selectedBookmarks);
  const batchCaptureThumbnails = useBookmarkStore(s => s.batchCaptureThumbnails);
  const [screenshotCooldownHours, setScreenshotCooldownHours] = useState(24);
  const [extractSEO, setExtractSEO] = useState(true);

  const handleBatchScreenshot = async (scope: 'all' | 'filtered' | 'selected') => {
    onClose();
    let ids: string[];
    if (scope === 'all') {
      ids = filteredBookmarks.map(b => b.id);
    } else if (scope === 'filtered') {
      ids = filteredBookmarks.map(b => b.id);
    } else {
      ids = selectedBookmarks;
    }
    if (ids.length === 0) {
      alert('没有符合条件的书签');
      return;
    }
    await batchCaptureThumbnails(ids, { force: true, cooldownHours: screenshotCooldownHours, extractSEO });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">批量更新截图</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">选择要更新预览图的书签范围</p>

        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">跳过近期已更新的书签</label>
            <div className="flex gap-2">
              {[0, 24, 168, 720].map(h => (
                <button
                  key={h}
                  onClick={() => setScreenshotCooldownHours(h)}
                  className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                    screenshotCooldownHours === h
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 font-medium'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {h === 0 ? '不跳过' : h === 24 ? '1天' : h === 168 ? '7天' : '30天'}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={extractSEO}
              onChange={(e) => setExtractSEO(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">同时提取SEO信息（description、favicon）</span>
          </label>
          <button
            onClick={() => handleBatchScreenshot('all')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
          >
            全部书签（{filteredBookmarks.length}）
          </button>
          <button
            onClick={() => handleBatchScreenshot('filtered')}
            disabled={filteredBookmarks.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium disabled:opacity-50"
          >
            当前筛选（{filteredBookmarks.length}）
          </button>
          <button
            onClick={() => handleBatchScreenshot('selected')}
            disabled={selectedBookmarks.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium disabled:opacity-50"
          >
            已选中（{selectedBookmarks.length}）
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchScreenshotModal;
