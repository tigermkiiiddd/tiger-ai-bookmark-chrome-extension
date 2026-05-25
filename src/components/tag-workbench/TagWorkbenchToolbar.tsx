import React from 'react';
import { ArrowLeft, Search, TreePine, FolderOpen, Hash, CheckCircle2, Bot } from 'lucide-react';

type ViewTab = 'agent' | 'tree' | 'ai-categories';

interface TagWorkbenchToolbarProps {
  stats: { total: number; used: number; unused: number };
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeView: ViewTab;
  onViewChange: (view: ViewTab) => void;
  onClose: () => void;
}

const tabs: { key: ViewTab; label: string; icon: React.ReactNode }[] = [
  { key: 'agent', label: '智能整理', icon: <Bot className="w-4 h-4" /> },
  { key: 'tree', label: '标签树', icon: <TreePine className="w-4 h-4" /> },
  { key: 'ai-categories', label: 'AI分类', icon: <FolderOpen className="w-4 h-4" /> },
];

export const TagWorkbenchToolbar: React.FC<TagWorkbenchToolbarProps> = ({
  stats,
  searchQuery,
  onSearchChange,
  activeView,
  onViewChange,
  onClose,
}) => {
  return (
    <div className="h-16 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 flex items-center gap-3 px-5 shrink-0"
    >
      {/* 标题 + 图标 */}
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
          <Hash className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
          标签工作台
        </h2>
      </div>

      {/* 统计胶囊 */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full font-medium text-gray-700 dark:text-gray-300 shadow-sm">
          {stats.total}
          <span className="text-gray-400 font-normal">标签</span>
        </span>
        <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-full font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-3 h-3" />
          {stats.used}
        </span>
        <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-gray-500 dark:text-gray-400">
          {stats.unused} 未用
        </span>
      </div>

      <div className="flex-1" />

      {/* 搜索框 */}
      <div className="relative w-52 lg:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="搜索标签..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 text-gray-900 dark:text-gray-100 shadow-sm transition-all"
        />
      </div>

      {/* Tab 切换 */}
      <div className="flex items-center bg-gray-100/80 dark:bg-gray-700/80 rounded-xl p-1 border border-gray-200 dark:border-gray-600">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onViewChange(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
              activeView === tab.key
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 返回按钮 */}
      <button
        onClick={onClose}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
        aria-label="返回书签"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden lg:inline text-xs font-medium">返回</span>
      </button>
    </div>
  );
};
