import React, { useState } from 'react';
import { RefreshCw, Upload, Download, Clock, AlertTriangle } from 'lucide-react';
import { useBookmarkStore } from '../store/index';
import ChromeBookmarkImport from './ChromeBookmarkImport';
import type { Settings } from '../types';
import { getRuntimeLocaleTag, t } from '../i18n';

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

      alert(t('syncDone'));
    } catch (error) {
      alert(t('syncFailed', error instanceof Error ? error.message : t('syncUnknownError')));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportSelected = async () => {
    if (selectedBookmarks.length === 0) {
      alert(t('syncSelectBookmarksFirst'));
      return;
    }

    setIsExporting(true);
    try {
      await exportToChrome(selectedBookmarks);
      alert(t('syncExportDone'));
    } catch (error) {
      alert(t('syncExportFailed', error instanceof Error ? error.message : t('syncUnknownError')));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    const unsynced = bookmarks.filter(b => !b.chromeBookmarkId);
    if (unsynced.length === 0) {
      alert(t('syncNoBookmarksToExport'));
      return;
    }

    setIsExporting(true);
    try {
      await exportToChrome(unsynced.map(b => b.id));
      alert(t('syncExportDone'));
    } catch (error) {
      alert(t('syncExportFailed', error instanceof Error ? error.message : t('syncUnknownError')));
    } finally {
      setIsExporting(false);
    }
  };

  const formatLastSync = () => {
    if (!settings.lastSyncTime) return t('syncNever');
    
    const date = new Date(settings.lastSyncTime);
    const now = new Date();
    const diffHours = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return t('syncJustNow');
    if (diffHours < 24) return t('syncHoursAgo', String(diffHours));
    return date.toLocaleDateString(getRuntimeLocaleTag());
  };

  return (
    <div className="space-y-6">
      {/* 同步开关 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('syncSectionTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('syncSectionDescription')}
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
                {t('syncDirectionLabel')}
              </label>
              <select
                value={settings.syncDirection}
                onChange={(e) => handleSyncDirectionChange(e.target.value as Settings['syncDirection'])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="bidirectional">{t('syncDirectionBidirectional')}</option>
                <option value="import">{t('syncDirectionImport')}</option>
                <option value="export">{t('syncDirectionExport')}</option>
              </select>
            </div>

            {/* 自动同步 */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('syncAutoLabel')}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('syncAutoDescription')}
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
                  {t('syncIntervalLabel')}
                </label>
                <select
                  value={settings.syncInterval || 60}
                  onChange={(e) => handleSyncIntervalChange(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={15}>{t('syncMinutes15')}</option>
                  <option value={30}>{t('syncMinutes30')}</option>
                  <option value={60}>{t('syncHour1')}</option>
                  <option value={180}>{t('syncHours3')}</option>
                  <option value={360}>{t('syncHours6')}</option>
                  <option value={720}>{t('syncHours12')}</option>
                  <option value={1440}>{t('syncHours24')}</option>
                </select>
              </div>
            )}

            {/* 最后同步时间 */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>{t('syncLastSyncLabel', formatLastSync())}</span>
            </div>
          </div>
        )}
      </div>

      {/* 手动同步操作 */}
      {settings.enableChromeSync && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('syncManualOperations')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 导入操作 */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">{t('syncImportFromChrome')}</h4>

              
              <button
                onClick={() => setShowImportModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                <Upload className="w-4 h-4" />
                {t('syncImportChromeBookmarks')}
              </button>
              
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('syncImportDescription')}
              </p>
            </div>

            {/* 导出操作 */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">{t('syncExportToChrome')}</h4>
              
              <div className="space-y-2">
                <button
                  onClick={handleExportSelected}
                  disabled={selectedBookmarks.length === 0 || isExporting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? t('syncRunning') : t('syncExportSelected', String(selectedBookmarks.length))}
                </button>
                
                <button
                  onClick={handleExportAll}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? t('syncRunning') : t('syncExportAllUnsynced')}
                </button>
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('syncExportDescription')}
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
              {isSyncing ? t('syncRunning') : t('syncRunNow')}
            </button>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
              {t('syncRunNowDescription')}
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
              {t('syncNotesTitle')}
            </h4>
            <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
              <li>• {t('syncNote1')}</li>
              <li>• {t('syncNote2')}</li>
              <li>• {t('syncNote3')}</li>
              <li>• {t('syncNote4')}</li>
              <li>• {t('syncNote5')}</li>
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
