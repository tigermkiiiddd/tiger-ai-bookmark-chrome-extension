import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePageState } from '../hooks/usePageState';
import { ArrowLeft, Folder, ChevronRight } from 'lucide-react';
import { useBookmarkStore } from '../store/index';
import PaginatedBookmarkList from './common/PaginatedBookmarkList';
import { getCategoryPath, getCategoryScopeIds } from '../utils/categoryTreeBuilder';

const CategoryPage: React.FC = () => {
  usePageState();
  const { categoryName } = useParams<{ categoryName: string }>();
  const categoryId = decodeURIComponent(categoryName || '');
  const bookmarks = useBookmarkStore(s => s.bookmarks);
  const categories = useBookmarkStore(s => s.categories);

  const categoryScopeIds = useMemo(
    () => getCategoryScopeIds(categoryId, categories),
    [categoryId, categories]
  );

  const categoryBookmarks = useMemo(
    () => bookmarks.filter(b => b.categoryId && categoryScopeIds.has(b.categoryId)),
    [bookmarks, categoryScopeIds]
  );

  const category = categories.find(c => c.id === categoryId);
  const fullPath = category ? getCategoryPath(categoryId, categories) : categoryId;
  const categoryParts = fullPath.split('/');
  const isMultiLevel = categoryParts.length > 1;

  // 面包屑：从树中找到每一层的 Category
  const breadcrumbs = categoryParts.map((name, index) => {
    const path = categoryParts.slice(0, index + 1).join('/');
    // 在 categories 中找到 fullPath 匹配的节点
    const node = categories.find(c => getCategoryPath(c.id, categories) === path);
    return { name, id: node?.id || '', path };
  });

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

        {isMultiLevel && (
          <div className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.id || index}>
                {index > 0 && <ChevronRight className="w-4 h-4" />}
                <Link
                  to={`/category/${encodeURIComponent(crumb.id)}`}
                  className="hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {crumb.name}
                </Link>
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-lg ${
            categoryParts.length === 1 ? 'bg-yellow-100 dark:bg-yellow-900/50' :
            categoryParts.length === 2 ? 'bg-orange-100 dark:bg-orange-900/50' :
            'bg-green-100 dark:bg-green-900/50'
          }`}>
            <Folder className={`w-6 h-6 ${
              categoryParts.length === 1 ? 'text-yellow-600 dark:text-yellow-400' :
              categoryParts.length === 2 ? 'text-orange-600 dark:text-orange-400' :
              'text-green-600 dark:text-green-400'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {category?.name || categoryParts[categoryParts.length - 1]}
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {isMultiLevel ? `完整路径: ${fullPath} • ` : ''}
              此分类及子分类下共有 {categoryBookmarks.length} 个书签
            </p>
          </div>
        </div>
      </div>

      {categoryBookmarks.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600">
            <Folder className="w-full h-full" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            分类为空
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            "{category?.name || fullPath}" 分类下暂时没有书签
          </p>
        </div>
      ) : (
        <PaginatedBookmarkList bookmarks={categoryBookmarks} />
      )}
    </div>
  );
};

export default CategoryPage;
