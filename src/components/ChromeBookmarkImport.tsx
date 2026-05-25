import React, { useEffect } from 'react';
import { X, Upload, AlertCircle, Sparkles } from 'lucide-react';
import { useBookmarkStore } from '../store/index';
import BookmarkConflictResolver from './BookmarkConflictResolver';
import { useChromeBookmarkImport } from './chrome-import/useChromeBookmarkImport';
import { FolderSelectStep } from './chrome-import/steps/FolderSelectStep';
import { ConfigureStep } from './chrome-import/steps/ConfigureStep';
import { ImportingStep } from './chrome-import/steps/ImportingStep';
import { CompleteStep } from './chrome-import/steps/CompleteStep';

interface ChromeBookmarkImportProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChromeBookmarkImport: React.FC<ChromeBookmarkImportProps> = ({
  isOpen,
  onClose
}) => {
  const { getChromeBookmarks, importChromeBookmarks, settings } = useBookmarkStore();

  const {
    step,
    setStep,
    chromeBookmarks,
    chromeFolders,
    selectedFolders,
    importOptions,
    importResult,
    importProgress,
    conflicts,
    isLoading,
    error,
    aiApiKey,
    loadChromeBookmarks,
    handleFolderToggle,
    handleSelectAll,
    handleNext,
    handleConflictResolution,
    reset,
    updateImportOption,
  } = useChromeBookmarkImport({
    getChromeBookmarks,
    importChromeBookmarks,
    aiApiKey: settings.aiApiKey,
  });

  useEffect(() => {
    if (isOpen && step === 'select') {
      loadChromeBookmarks();
    }
  }, [isOpen, step, loadChromeBookmarks]);

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              导入Chrome书签
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
              </div>
            </div>
          )}

          {step === 'select' && (
            <FolderSelectStep
              chromeBookmarks={chromeBookmarks}
              chromeFolders={chromeFolders}
              selectedFolders={selectedFolders}
              isLoading={isLoading}
              onToggle={handleFolderToggle}
              onSelectAll={handleSelectAll}
            />
          )}
          {step === 'configure' && (
            <ConfigureStep
              selectedFolders={selectedFolders}
              importOptions={importOptions}
              aiApiKey={aiApiKey}
              onUpdateOption={updateImportOption}
            />
          )}
          {step === 'conflicts' && (
            <BookmarkConflictResolver
              conflicts={conflicts}
              onResolve={handleConflictResolution}
              onCancel={() => setStep('configure')}
            />
          )}
          {step === 'importing' && (
            <ImportingStep
              current={importProgress.current}
              total={importProgress.total}
            />
          )}
          {step === 'complete' && <CompleteStep importResult={importResult} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            {step === 'select' && (
              <>
                <span>步骤 1/2</span>
                <span>•</span>
                <span>选择文件夹</span>
              </>
            )}
            {step === 'configure' && (
              <>
                <span>步骤 2/2</span>
                <span>•</span>
                <span>配置选项</span>
              </>
            )}
            {step === 'conflicts' && (
              <>
                <span>解决冲突</span>
                <span>•</span>
                <span>手动处理 {conflicts.length} 个冲突</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step !== 'importing' && step !== 'complete' && step !== 'conflicts' && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleNext}
                  disabled={step === 'select' && chromeFolders.length === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {step === 'configure' && importOptions.enableAIAnalysis && (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {step === 'select' ? '下一步' : '开始导入'}
                </button>
              </>
            )}
            {step === 'complete' && (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-md transition-colors"
              >
                完成
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChromeBookmarkImport;
