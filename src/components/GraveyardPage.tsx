import React, { useState, useEffect, useMemo } from 'react';
import { GraveyardEntry } from '../types';
import { graveyardStorage } from '../core/storage/graveyard';
import { Skull, Search, Trash2, ExternalLink, Tag, Folder, Clock, X } from 'lucide-react';

const GraveyardPage: React.FC = () => {
  const [entries, setEntries] = useState<GraveyardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    setLoading(true);
    const all = await graveyardStorage.getAll();
    setEntries(all.sort((a, b) => b.deletedAt - a.deletedAt));
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.url.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.summary?.toLowerCase().includes(q) ||
      e.tagPaths.some(t => t.toLowerCase().includes(q)) ||
      e.categoryPath?.toLowerCase().includes(q) ||
      e.keywords?.some(k => k.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(e => e.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    await graveyardStorage.permanentDeleteMany([...selectedIds]);
    setSelectedIds(new Set());
    await loadEntries();
  };

  const handleDeleteOne = async (id: string) => {
    await graveyardStorage.permanentDelete(id);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    await loadEntries();
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skull className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">URL 坟场</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">{entries.length} 条归档</span>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            永久删除 ({selectedIds.size})
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">
        已删除书签的归档记录，仅保存元数据快照，不参与活跃标签和分类体系。
      </p>

      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="搜索标题、URL、标签、关键词..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Skull className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{entries.length === 0 ? '坟场为空' : '没有匹配的记录'}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onChange={toggleAll}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              全选
            </label>
            <span>共 {filtered.length} 条</span>
          </div>

          <div className="space-y-2">
            {filtered.map(entry => (
              <div
                key={entry.id}
                className={`p-4 rounded-lg border transition-colors ${
                  selectedIds.has(entry.id)
                    ? 'border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(entry.id)}
                    onChange={() => toggleSelect(entry.id)}
                    className="mt-1 rounded border-gray-300 dark:border-gray-600"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">{entry.title}</h3>
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex-shrink-0 text-gray-400 hover:text-blue-500"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{entry.url}</p>

                    {entry.summary && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2">{entry.summary}</p>
                    )}

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {entry.categoryPath && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                          <Folder className="w-3 h-3" />{entry.categoryPath}
                        </span>
                      )}
                      {entry.tagPaths.map(t => (
                        <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          <Tag className="w-3 h-3" />{t}
                        </span>
                      ))}
                    </div>

                    {entry.keywords && entry.keywords.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {entry.keywords.map(k => (
                          <span key={k} className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">{k}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(entry.deletedAt)}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                      {entry.deletedReason === 'manual' ? '手动删除' : entry.deletedReason === 'dead' ? '链接失效' : '批量删除'}
                    </span>
                    <button
                      onClick={() => handleDeleteOne(entry.id)}
                      className="mt-1 p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="永久删除"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default GraveyardPage;
