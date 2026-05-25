import { useState, useCallback, useEffect } from 'react';
import type {
  ChromeBookmarkNode,
  SyncOptions,
  BookmarkSyncResult,
  BookmarkConflict,
} from '../../types/index';

interface UseChromeBookmarkImportProps {
  getChromeBookmarks: () => Promise<{
    bookmarks: ChromeBookmarkNode[];
    folders: ChromeBookmarkNode[];
  }>;
  importChromeBookmarks: (
    options: SyncOptions,
    selectedFolders?: string[],
    onProgress?: (progress: { current: number; total: number }) => void
  ) => Promise<BookmarkSyncResult>;
  aiApiKey?: string;
}

export type ImportStep = 'select' | 'configure' | 'conflicts' | 'importing' | 'complete';

export function useChromeBookmarkImport({
  getChromeBookmarks,
  importChromeBookmarks,
  aiApiKey,
}: UseChromeBookmarkImportProps) {
  const [step, setStep] = useState<ImportStep>('select');
  const [chromeBookmarks, setChromeBookmarks] = useState<ChromeBookmarkNode[]>([]);
  const [chromeFolders, setChromeFolders] = useState<ChromeBookmarkNode[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [importOptions, setImportOptions] = useState<SyncOptions>({
    mergeStrategy: 'skip',
    includeSubfolders: true,
    selectedFolders: [],
    conflictResolution: 'auto-merge',
    enableAIAnalysis: false,
    batchSize: 50,
  });
  const [importResult, setImportResult] = useState<BookmarkSyncResult | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [conflicts, setConflicts] = useState<BookmarkConflict[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChromeBookmarks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getChromeBookmarks();
      setChromeBookmarks(data.bookmarks);
      setChromeFolders(data.folders);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取Chrome书签失败');
    } finally {
      setIsLoading(false);
    }
  }, [getChromeBookmarks]);

  const handleFolderToggle = useCallback((folderId: string) => {
    setSelectedFolders((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedFolders((prev) =>
      prev.length === chromeFolders.length ? [] : chromeFolders.map((f) => f.id)
    );
  }, [chromeFolders]);

  const handleNext = useCallback(() => {
    if (step === 'select') {
      setImportOptions((prev) => ({ ...prev, selectedFolders }));
      setStep('configure');
    } else if (step === 'configure') {
      setStep('importing');
      setError(null);
      startImportFlow();
    }
  }, [step, selectedFolders]);

  const startImportFlow = useCallback(async () => {
    try {
      const result = await importChromeBookmarks(
        importOptions,
        selectedFolders.length > 0 ? selectedFolders : undefined,
        (progress) => setImportProgress(progress)
      );
      if (result?.conflicts && result.conflicts.length > 0) {
        setConflicts(result.conflicts);
        setImportResult(result);
        setStep('conflicts');
      } else {
        setStep('complete');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
      setStep('configure');
    }
  }, [importOptions, selectedFolders, importChromeBookmarks]);

  const handleConflictResolution = useCallback(
    async (
      resolutions: Array<{
        conflict: BookmarkConflict;
        resolution: 'merge' | 'skip' | 'replace';
      }>
    ) => {
      setStep('importing');
      setError(null);

      try {
        const updatedConflicts = conflicts.map((conflict) => {
          const resolution = resolutions.find((r) => r.conflict === conflict);
          return {
            conflict,
            resolution: resolution?.resolution || 'skip',
          };
        });

        const updatedOptions = {
          ...importOptions,
          conflictResolution: 'manual' as const,
          resolvedConflicts: updatedConflicts,
        };

        await importChromeBookmarks(
          updatedOptions,
          selectedFolders.length > 0 ? selectedFolders : undefined,
          (progress) => setImportProgress(progress)
        );

        setStep('complete');
      } catch (err) {
        setError(err instanceof Error ? err.message : '导入失败');
        setStep('conflicts');
      }
    },
    [conflicts, importOptions, selectedFolders, importChromeBookmarks]
  );

  const reset = useCallback(() => {
    setStep('select');
    setSelectedFolders([]);
    setImportResult(null);
    setImportProgress({ current: 0, total: 0 });
    setConflicts([]);
    setError(null);
  }, []);

  const updateImportOption = useCallback(<K extends keyof SyncOptions>(
    key: K,
    value: SyncOptions[K]
  ) => {
    setImportOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
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
  };
}
