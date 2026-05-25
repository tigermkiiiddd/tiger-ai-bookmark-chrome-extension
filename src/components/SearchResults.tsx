import React from 'react';
import { Link } from 'react-router-dom';
import { usePageState } from '../hooks/usePageState';
import { ArrowLeft, Search } from 'lucide-react';
import { useBookmarkStore } from '../store/index';
import PaginatedBookmarkList from './common/PaginatedBookmarkList';

const SearchResults: React.FC = () => {
  usePageState();
  const searchQuery = useBookmarkStore(s => s.searchQuery);
  const filteredBookmarks = useBookmarkStore(s => s.filteredBookmarks);
  const clearFilters = useBookmarkStore(s => s.clearFilters);

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回所有书签
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
            <Search className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              搜索结果
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery
                ? `搜索 "${searchQuery}" 找到 ${filteredBookmarks.length} 个结果`
                : `筛选结果：${filteredBookmarks.length} 个书签`}
            </p>
          </div>
        </div>

        <button
          onClick={clearFilters}
          className="text-sm text-primary hover:text-primary-hover"
        >
          清除所有筛选条件
        </button>
      </div>

      {filteredBookmarks.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600">
            <Search className="w-full h-full" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            没有找到匹配的书签
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            尝试使用不同的关键词或调整筛选条件
          </p>
          <button
            onClick={clearFilters}
            className="text-primary hover:text-primary-hover"
          >
            清除筛选条件
          </button>
        </div>
      ) : (
        <PaginatedBookmarkList bookmarks={filteredBookmarks} />
      )}
    </div>
  );
};

export default SearchResults;
