import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';

interface ReplaceDomainModalProps {
  oldDomain: string;
  bookmarkCount: number;
  onConfirm: (newDomain: string) => Promise<void>;
  onCancel: () => void;
}

export const ReplaceDomainModal: React.FC<ReplaceDomainModalProps> = ({
  oldDomain,
  bookmarkCount,
  onConfirm,
  onCancel,
}) => {
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidDomain = (() => {
    const d = newDomain.trim();
    if (!d) return false;
    try {
      new URL(`https://${d}`);
      return true;
    } catch {
      return false;
    }
  })();

  const handleConfirm = async () => {
    if (!isValidDomain) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(newDomain.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : '替换失败');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">替换域名</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">当前域名</label>
            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 text-sm font-mono">
              {oldDomain}
            </div>
          </div>

          <div className="flex items-center justify-center text-gray-400">
            <ArrowRight className="w-5 h-5" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">新域名</label>
            <input
              type="text"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && isValidDomain) handleConfirm(); }}
            />
          </div>

          <div className="flex items-start space-x-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              将替换该域名下 <strong>{bookmarkCount}</strong> 个书签的 URL，仅替换域名部分，路径和参数保持不变。
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValidDomain || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center space-x-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{loading ? '替换中...' : '确认替换'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
