import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePageState } from '../hooks/usePageState';
import { Save, Key, Palette, Brain, Download, Upload, Trash2, CheckCircle, ArchiveRestore, Link2, ArrowLeft, Database } from 'lucide-react';
import { useBookmarkStore } from '../store/index';
import {
  formatLastLinkCheckTime,
  DEFAULT_LINK_CHECK_SKIP_PERIOD,
  formatLinkCheckSkipPeriod
} from '../utils/linkCheck';
import ChromeSyncSettings from './ChromeSyncSettings';
import { t } from '../i18n';
import { APP_INFO } from '../constants';

const SettingsPage: React.FC = () => {
  usePageState();
  const { settings, updateSettings, exportData, importData, clearAllData, resetAllArchiveStatus, bookmarks, isLoading, createCheckpoint, restoreCheckpoint } = useBookmarkStore();

  const [formData, setFormData] = useState(settings);
  const [isSaving, setSaving] = useState(false);
  const [isResettingArchive, setIsResettingArchive] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [checkpointFile, setCheckpointFile] = useState<File | null>(null);
  const [isCreatingCheckpoint, setIsCreatingCheckpoint] = useState(false);
  const [isRestoringCheckpoint, setIsRestoringCheckpoint] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleInputChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(formData);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('保存设置失败:', error);
      alert(t('settingsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const jsonData = await exportData();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tigermarkiii-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
      alert(t('settingsExportFailed'));
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    try {
      const text = await importFile.text();
      await importData(text);
      alert(t('settingsImportSuccess'));
      setImportFile(null);
    } catch (error) {
      console.error('导入失败:', error);
      alert(t('settingsImportFailed'));
    }
  };

  const handleCreateCheckpoint = async () => {
    setIsCreatingCheckpoint(true);
    try {
      const jsonData = await createCheckpoint();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tigermark-checkpoint-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('创建检查点失败:', error);
      alert(t('settingsCreateCheckpointFailed'));
    } finally {
      setIsCreatingCheckpoint(false);
    }
  };

  const handleRestoreCheckpoint = async () => {
    if (!checkpointFile) return;
    if (!confirm(t('settingsRestoreCheckpointConfirm'))) return;

    setIsRestoringCheckpoint(true);
    try {
      const text = await checkpointFile.text();
      await restoreCheckpoint(text);
      alert(t('settingsRestoreCheckpointSuccess'));
      setCheckpointFile(null);
    } catch (error) {
      console.error('恢复检查点失败:', error);
      alert(t('settingsRestoreCheckpointFailed'));
    } finally {
      setIsRestoringCheckpoint(false);
    }
  };

  const archivedCount = bookmarks.filter(
    (b) => b.isArchived || (b.status as string) === 'archived'
  ).length;

  const handleResetAllArchive = async () => {
    if (archivedCount === 0) {
      alert(t('settingsNoArchivedBookmarks'));
      return;
    }

    const confirmed = confirm(
      t('settingsResetArchiveConfirm1', String(archivedCount))
    );
    if (!confirmed) return;

    const doubleConfirmed = confirm(t('settingsResetArchiveConfirm2', String(archivedCount)));
    if (!doubleConfirmed) return;

    setIsResettingArchive(true);
    try {
      const count = await resetAllArchiveStatus();
      alert(t('settingsResetArchiveDone', String(count)));
    } catch (error) {
      console.error('重置归档失败:', error);
      alert(t('settingsResetArchiveFailed'));
    } finally {
      setIsResettingArchive(false);
    }
  };

  const handleClearAll = async () => {
    const confirmed = confirm(t('settingsClearAllConfirm1'));
    
    if (confirmed) {
      const doubleConfirmed = confirm(t('settingsClearAllConfirm2'));
      if (doubleConfirmed) {
        try {
          await clearAllData();
          alert(t('settingsClearAllDone'));
        } catch (error) {
          console.error('清空数据失败:', error);
          alert(t('settingsClearAllFailed'));
        }
      }
    }
  };

  const setContentSafetyToNone = () => {
    handleInputChange('contentSafetyLevel', 'BLOCK_NONE');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="px-6 pt-6 pb-24">
      <div className="mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('settingsBackToAllBookmarks')}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('settingsTitle')}</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {t('settingsDescription')}
        </p>
      </div>

      <div className="space-y-8">
        {/* AI Features Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('settingsAiFeatures')}</h2>
          </div>

          <div className="space-y-6">
            {/* AI API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Key className="w-4 h-4 inline mr-2" />
                {t('settingsAiApiKey')}
              </label>
              <input
                type="password"
                value={formData.aiApiKey || ''}
                onChange={(e) => handleInputChange('aiApiKey', e.target.value)}
                placeholder={t('settingsAiApiKeyPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* API Base URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settingsApiBaseUrl')}
              </label>
              <input
                type="text"
                value={formData.aiApiBaseUrl || ''}
                onChange={(e) => handleInputChange('aiApiBaseUrl', e.target.value)}
                placeholder="https://api.openai.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {t('settingsApiBaseUrlHint')}
              </p>
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settingsModelName')}
              </label>
              <input
                type="text"
                value={formData.aiModel || ''}
                onChange={(e) => handleInputChange('aiModel', e.target.value)}
                placeholder={t('settingsModelNamePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Auto Tagging */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">{t('settingsAiAutoTagging')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('settingsAiAutoTaggingDescription')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.aiAutoTagging}
                  onChange={(e) => handleInputChange('aiAutoTagging', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 dark:peer-focus:ring-primary/50 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Link Check Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Link2 className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('settingsLinkCheck')}
            </h2>
          </div>

          <div className="space-y-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('settingsLastFullCheck', formatLastLinkCheckTime(formData.lastLinkCheckAt))}
            </p>

            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('settingsLinkCheckOptionalHint')}
              </p>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('settingsSkipRecentChecks')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('settingsSkipRecentChecksDescription')}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.linkCheckSkipRecently === true}
                    onChange={(e) =>
                      handleInputChange('linkCheckSkipRecently', e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 dark:peer-focus:ring-primary/50 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary" />
                </label>
              </div>

              {formData.linkCheckSkipRecently ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settingsLinkCheckWindow')}
                  </label>
                  <select
                    value={
                      formData.linkCheckSkipPeriod ?? DEFAULT_LINK_CHECK_SKIP_PERIOD
                    }
                    onChange={(e) =>
                      handleInputChange(
                        'linkCheckSkipPeriod',
                        e.target.value as '1m' | '6m' | '1y'
                      )
                    }
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="1m">{t('settingsLinkCheckSkip1m')}</option>
                    <option value="6m">{t('settingsLinkCheckSkip6m')}</option>
                    <option value="1y">{t('settingsLinkCheckSkip1y')}</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {t('settingsLinkCheckCheckedWithin', formatLinkCheckSkipPeriod(formData))}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('settingsLinkCheckNoSkip')}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-dashed border-amber-300/60 dark:border-amber-700/60 p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                {t('settingsAiArchiveLinkCheck')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('settingsAiArchiveLinkCheckHint')}
              </p>
              <select
                value={formData.aiArchiveLinkCheckMode ?? 'off'}
                onChange={(e) =>
                  handleInputChange(
                    'aiArchiveLinkCheckMode',
                    e.target.value as 'strict' | 'lenient' | 'off'
                  )
                }
                className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="off">{t('settingsAiArchiveModeOff')}</option>
                <option value="lenient">{t('settingsAiArchiveModeLenient')}</option>
                <option value="strict">{t('settingsAiArchiveModeStrict')}</option>
              </select>
            </div>
          </div>
        </section>

        {/* Chrome Sync Section */}
        <ChromeSyncSettings />

        {/* Appearance Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('settingsAppearance')}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">{t('settingsThemeMode')}</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'light', label: t('settingsThemeLight'), icon: '☀️' },
                  { value: 'dark', label: t('settingsThemeDark'), icon: '🌙' },
                  { value: 'system', label: t('settingsThemeSystem'), icon: '💻' }
                ].map(theme => (
                  <label
                    key={theme.value}
                    className={`cursor-pointer border-2 rounded-lg p-4 text-center transition-colors ${
                      formData.theme === theme.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={theme.value}
                      checked={formData.theme === theme.value}
                      onChange={(e) => handleInputChange('theme', e.target.value)}
                      className="sr-only"
                    />
                    <div className="text-2xl mb-2">{theme.icon}</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {theme.label}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Data Management Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Download className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('settingsDataManagement')}</h2>
          </div>

          <div className="space-y-6">
            {/* Export Data */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">{t('settingsExportDataTitle')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('settingsExportDataDescription')}
              </p>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
              >
                <Download className="w-4 h-4" />
                {t('settingsExportDataButton')}
              </button>
            </div>

            {/* Import Data */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">{t('settingsImportDataTitle')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('settingsImportDataDescription')}
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="text-sm text-gray-600 dark:text-gray-400"
                />
                {importFile && (
                  <button
                    onClick={handleImport}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    {t('settingsImportDataButton')}
                  </button>
                )}
              </div>
            </div>

            {/* Checkpoint Backup */}
            <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                <Database className="w-4 h-4" />
                {t('settingsCheckpointTitle')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('settingsCheckpointDescription')}
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleCreateCheckpoint}
                  disabled={isCreatingCheckpoint}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {isCreatingCheckpoint ? t('settingsCreatingCheckpoint') : t('settingsCreateCheckpoint')}
                </button>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {t('settingsRestoreCheckpointHint')}
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => setCheckpointFile(e.target.files?.[0] || null)}
                      className="text-sm text-gray-600 dark:text-gray-400"
                    />
                    {checkpointFile && (
                      <button
                        onClick={handleRestoreCheckpoint}
                        disabled={isRestoringCheckpoint}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-md transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        {isRestoringCheckpoint ? t('settingsRestoringCheckpoint') : t('settingsRestoreCheckpoint')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Temporary: reset archive status */}
            <div className="pt-4 border-t border-amber-200 dark:border-amber-800">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                <ArchiveRestore className="w-4 h-4" />
                {t('settingsResetArchiveTitle')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {t('settingsResetArchiveDescription')}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                {t('settingsResetArchivePending', String(archivedCount))}
              </p>
              <button
                type="button"
                onClick={handleResetAllArchive}
                disabled={archivedCount === 0 || isResettingArchive || isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                <ArchiveRestore className="w-4 h-4" />
                {isResettingArchive ? t('settingsResetArchiveRunning') : t('settingsResetArchiveButton')}
              </button>
            </div>

            {/* Clear All Data */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">{t('settingsDangerZone')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('settingsClearAllDescription')}
              </p>
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {t('settingsClearAllButton')}
              </button>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">{t('settingsAboutTitle')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {t('settingsAboutDescription')}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('settingsVersionLabel', APP_INFO.version)}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                {t('settingsLicenseLabel')}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('settingsLicenseDescription')}
              </p>
            </div>
          </div>
        </section>
      </div>
      </div>

      {/* 底部固定保存栏 */}
      <div className="sticky bottom-0 z-20 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-[0_-4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.3)]">
        <div className="px-6 py-3 flex items-center justify-between gap-4 max-w-4xl mx-auto">
          {showSuccess ? (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300 min-w-0">
              <CheckCircle className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
              <span className="font-medium truncate">{t('settingsSaveSuccess')}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {t('settingsClickSaveHint')}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="shrink-0 flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? t('settingsSavingButton') : t('settingsSaveButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;