import React, { useState } from 'react';
import { RefreshCw, Upload, Download, Clock, AlertTriangle } from 'lucide-react';
import { useBookmarkStore } from '../store/index';
import ChromeBookmarkImport from './ChromeBookmarkImport';
import type { Settings } from '../types';

const ChromeSyncSettings: React.FC = () => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const { 
    settings, 
    updateSettings, 
    selectedBookmarks, 
    syncWithChrome, 
    exportToChrome,
    bookmarks
  } = useBookmarkStore();

  const handleToggleSync = async (enabled: boolean) => {
    await updateSettings({ enableChromeSync: enabled });
  };

  const handleSyncDirectionChange = async (direction: 'import' | 'export' | 'bidirectional') => {
    await updateSettings({ syncDirection: direction });
  };

  const handleAutoSyncToggle = async (enabled: boolean) => {
    await updateSettings({ autoSync: enabled });
  };

  const handleSyncIntervalChange = async (interval: number) => {
    await updateSettings({ syncInterval: interval });
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncWithChrome({
        mergeStrategy: 'skip',
        includeSubfolders: true,
        selectedFolders: [],
        conflictResolution: 'skip',
        enableAIAnalysis: false,
        batchSize: 50
      });

      alert('同步完成！');
    } catch (error) {
      alert(`同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportSelected = async () => {
    if (selectedBookmarks.length === 0) {
      alert('请先选择要导出的书签');
      return;
    }

    setIsExporting(true);
    try {
      await exportToChrome(selectedBookmarks);
      alert('导出完成！');
    } catch (error) {
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    const unsynced = bookmarks.filter(b => !b.chromeBookmarkId);
    if (unsynced.length === 0) {
      alert('没有需要导出的书签');
      return;
    }

    setIsExporting(true);
    try {
      await exportToChrome(unsynced.map(b => b.id));
      alert('导出完成！');
    } catch (error) {
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const formatLastSync = () => {
    if (!settings.lastSyncTime) return '从未同步';
    
    const date = new Date(settings.lastSyncTime);
    const now = new Date();
    const diffHours = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return '刚刚';
    if (diffHours < 24) return `${diffHours} 小时前`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* 同步开关 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Chrome书签同步
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              与Chrome浏览器书签进行双向同步
            </p>
          </div>
          
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableChromeSync || false}
              onChange={(e) => handleToggleSync(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
          </label>
        </div>

        {settings.enableChromeSync && (
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {/* 同步方向 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                同步方向
              </label>
              <select
                value={settings.syncDirection}
                onChange={(e) => handleSyncDirectionChange(e.target.value as Settings['syncDirection'])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="bidirectional">双向同步（推荐）</option>
                <option value="import">仅从Chrome导入</option>
                <option value="export">仅导出到Chrome</option>
              </select>
            </div>

            {/* 自动同步 */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  自动同步
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  定期自动同步书签，减少手动操作
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSync || false}
                onChange={(e) => handleAutoSyncToggle(e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
              />
            </div>

            {/* 同步间隔 */}
            {settings.autoSync && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  同步间隔
                </label>
                <select
                  value={settings.syncInterval || 60}
                  onChange={(e) => handleSyncIntervalChange(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={15}>15 分钟</option>
                  <option value={30}>30 分钟</option>
                  <option value={60}>1 小时</option>
                  <option value={180}>3 小时</option>
                  <option value={360}>6 小时</option>
                  <option value={720}>12 小时</option>
                  <option value={1440}>24 小时</option>
                </select>
              </div>
            )}

            {/* 最后同步时间 */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>最后同步: {formatLastSync()}</span>
            </div>
          </div>
        )}
      </div>

      {/* 手动同步操作 */}
      {settings.enableChromeSync && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            手动同步操作
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 导入操作 */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">从Chrome导入</h4>
              
              <button
                onClick={() => setShowImportModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                <Upload className="w-4 h-4" />
                导入Chrome书签
              </button>
              
              <p className="text-xs text-gray-500 dark:text-gray-400">
                选择性导入Chrome书签文件夹，支持冲突处理和AI分析
              </p>
            </div>

            {/* 导出操作 */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">导出到Chrome</h4>
              
              <div className="space-y-2">
                <button
                  onClick={handleExportSelected}
                  disabled={selectedBookmarks.length === 0 || isExporting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? '导出中...' : `导出选中 (${selectedBookmarks.length})`}
                </button>
                
                <button
                  onClick={handleExportAll}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? '导出中...' : '导出所有未同步'}
                </button>
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400">
                将TIGERMARK书签导出到Chrome书签栏
              </p>
            </div>
          </div>

          {/* 完整同步 */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? '同步中...' : '立即完整同步'}
            </button>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
              执行完整的双向同步，根据设置的同步方向进行操作
            </p>
          </div>
        </div>
      )}

      {/* 注意事项 */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-2">
            <h4 className="font-medium text-amber-800 dark:text-amber-200">
              同步注意事项
            </h4>
            <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
              <li>• 首次同步可能需要较长时间，请耐心等待</li>
              <li>• 大量书签同步时建议关闭其他标签页以提升性能</li>
              <li>• 同步过程中请勿关闭浏览器或扩展</li>
              <li>• 重复书签会根据冲突处理设置自动处理</li>
              <li>• Chrome文件夹结构会自动转换为TIGERMARK分类</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 导入模态框 */}
      <ChromeBookmarkImport
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
};

export default ChromeSyncSettings;
