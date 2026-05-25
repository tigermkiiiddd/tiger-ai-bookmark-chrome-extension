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
      alert('保存设置失败，请重试');
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
      alert('导出失败，请重试');
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    try {
      const text = await importFile.text();
      await importData(text);
      alert('导入成功！');
      setImportFile(null);
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败，请检查文件格式');
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
      alert('创建检查点失败，请重试');
    } finally {
      setIsCreatingCheckpoint(false);
    }
  };

  const handleRestoreCheckpoint = async () => {
    if (!checkpointFile) return;
    if (!confirm('恢复检查点将覆盖所有当前数据（书签、标签、分类、设置、回收站等），确定继续吗？')) return;

    setIsRestoringCheckpoint(true);
    try {
      const text = await checkpointFile.text();
      await restoreCheckpoint(text);
      alert('检查点恢复成功！');
      setCheckpointFile(null);
    } catch (error) {
      console.error('恢复检查点失败:', error);
      alert('恢复检查点失败，请检查文件格式');
    } finally {
      setIsRestoringCheckpoint(false);
    }
  };

  const archivedCount = bookmarks.filter(
    (b) => b.isArchived || (b.status as string) === 'archived'
  ).length;

  const handleResetAllArchive = async () => {
    if (archivedCount === 0) {
      alert('当前没有需要重置的已归档书签。');
      return;
    }

    const confirmed = confirm(
      `将把 ${archivedCount} 个已归档书签恢复为「正常」状态。\n\n` +
        '不会删除标签、分类和 AI 分析内容。\n\n确定继续吗？'
    );
    if (!confirmed) return;

    const doubleConfirmed = confirm(
      `再次确认：重置 ${archivedCount} 个书签的归档状态？`
    );
    if (!doubleConfirmed) return;

    setIsResettingArchive(true);
    try {
      const count = await resetAllArchiveStatus();
      alert(`已重置 ${count} 个书签的归档状态。`);
    } catch (error) {
      console.error('重置归档失败:', error);
      alert('重置失败，请重试。');
    } finally {
      setIsResettingArchive(false);
    }
  };

  const handleClearAll = async () => {
    const confirmed = confirm(
      '警告：此操作将删除所有书签、标签、分类和设置数据，且无法恢复。\n\n确定要继续吗？'
    );
    
    if (confirmed) {
      const doubleConfirmed = confirm('再次确认：真的要删除所有数据吗？');
      if (doubleConfirmed) {
        try {
          await clearAllData();
          alert('所有数据已清空');
        } catch (error) {
          console.error('清空数据失败:', error);
          alert('清空数据失败，请重试');
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
          返回所有书签
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">设置</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          配置 TIGERMARKIII 的各项功能和偏好设置
        </p>
      </div>

      <div className="space-y-8">
        {/* AI Features Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">AI 功能</h2>
          </div>

          <div className="space-y-6">
            {/* AI API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Key className="w-4 h-4 inline mr-2" />
                AI API 密钥
              </label>
              <input
                type="password"
                value={formData.aiApiKey || ''}
                onChange={(e) => handleInputChange('aiApiKey', e.target.value)}
                placeholder="输入你的 API 密钥..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* API Base URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Base URL
              </label>
              <input
                type="text"
                value={formData.aiApiBaseUrl || ''}
                onChange={(e) => handleInputChange('aiApiBaseUrl', e.target.value)}
                placeholder="https://api.openai.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                支持 OpenAI、Ollama、LM Studio 等兼容端点
              </p>
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                模型名称
              </label>
              <input
                type="text"
                value={formData.aiModel || ''}
                onChange={(e) => handleInputChange('aiModel', e.target.value)}
                placeholder="gpt-4o-mini"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Auto Tagging */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">AI 自动标签</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  为新添加的书签自动生成智能标签
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
              链接检测
            </h2>
          </div>

          <div className="space-y-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              上次全量检测：{formatLastLinkCheckTime(formData.lastLinkCheckAt)}
            </p>

            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                以下为可选项。默认每次检测全部待检书签；仅在开启跳过时，才按时间窗口过滤。
              </p>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    跳过近期已检测（可选）
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    关闭 = 不跳过，每次都检测全部书签
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
                    跳过时间窗口
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
                    <option value="1m">1 个月内已检测的不重复检测</option>
                    <option value="6m">6 个月内已检测的不重复检测</option>
                    <option value="1y">1 年内已检测的不重复检测</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {formatLinkCheckSkipPeriod(formData)}内检测过的书签将跳过
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  当前未启用跳过，检测时会包含所有未归档书签。
                </p>
              )}
            </div>

            <div className="rounded-lg border border-dashed border-amber-300/60 dark:border-amber-700/60 p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                AI 归档前链接检测
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                扩展内 fetch 无法像浏览器一样打开页面，带防爬的网站常被误判失效。批量归档默认不依赖此检测。
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
                <option value="off">关闭（推荐）— 不检测，直接 AI 归档</option>
                <option value="lenient">仅记录 — 检测但不阻断、不把结果标为失效</option>
                <option value="strict">严格 — 仅 404/410 等明确页面不存在才跳过</option>
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">外观</h2>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">主题模式</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'light', label: '浅色', icon: '☀️' },
                  { value: 'dark', label: '深色', icon: '🌙' },
                  { value: 'system', label: '跟随系统', icon: '💻' }
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">数据管理</h2>
          </div>

          <div className="space-y-6">
            {/* Export Data */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">导出数据</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                导出所有书签、标签、分类和设置到 JSON 文件
              </p>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
              >
                <Download className="w-4 h-4" />
                导出数据
              </button>
            </div>

            {/* Import Data */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">导入数据</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                从备份文件恢复数据（将覆盖现有数据）
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
                    导入
                  </button>
                )}
              </div>
            </div>

            {/* Checkpoint Backup */}
            <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                <Database className="w-4 h-4" />
                数据库检查点
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                完整数据库快照，包含书签、标签、分类、设置、回收站、AI 检查点等所有数据
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleCreateCheckpoint}
                  disabled={isCreatingCheckpoint}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {isCreatingCheckpoint ? '创建中...' : '创建并下载检查点'}
                </button>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    从检查点文件恢复所有数据
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
                        {isRestoringCheckpoint ? '恢复中...' : '恢复检查点'}
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
                临时工具：重置归档状态
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                将所有已归档书签批量恢复为「正常」状态，保留标签、分类和 AI 分析结果。
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                当前待重置：{archivedCount} 个书签
              </p>
              <button
                type="button"
                onClick={handleResetAllArchive}
                disabled={archivedCount === 0 || isResettingArchive || isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                <ArchiveRestore className="w-4 h-4" />
                {isResettingArchive ? '重置中...' : '重置全部归档为未归档'}
              </button>
            </div>

            {/* Clear All Data */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">危险操作</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                永久删除所有数据，包括书签、标签、分类和设置
              </p>
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                清空所有数据
              </button>
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
              <span className="font-medium truncate">设置已保存</span>
            </div>
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
              修改后请点击保存
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
            {isSaving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;