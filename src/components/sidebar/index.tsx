import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, FolderOpen, Plus, X, Check } from 'lucide-react';
import { useBookmarkStore } from '../../store';
import { Bookmark as BookmarkType } from '../../types';
import { buildCategoryTree, getDescendants, getCategoryFilterScopeIds } from '../../utils/categoryTreeBuilder';
import { bookmarkMatchesStatusFilters } from '../../utils/statusFilter';
import CategoryTreeNode from './CategoryTreeNode';
import StatusFilters from './StatusFilters';
import TagList from './TagList';
import ScopeBar from './ScopeBar';

interface SidebarProps {
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const bookmarks = useBookmarkStore(s => s.bookmarks);
  const categories = useBookmarkStore(s => s.categories);
  const tags = useBookmarkStore(s => s.tags);
  const expandedCategoriesArr = useBookmarkStore(s => s.expandedCategories);
  const activeFilters = useBookmarkStore(s => s.activeFilters);
  const setActiveFilters = useBookmarkStore(s => s.setActiveFilters);
  const createCategory = useBookmarkStore(s => s.createCategory);
  const toggleCategoryExpansion = useBookmarkStore(s => s.toggleCategoryExpansion);

  const { bookmarkPreviewMap } = useMemo(() => {
    const previewMap = new Map<string, BookmarkType[]>();
    for (const b of bookmarks) {
      if (!b.categoryId) continue;
      if (!previewMap.has(b.categoryId)) previewMap.set(b.categoryId, []);
      const list = previewMap.get(b.categoryId)!;
      if (list.length < 5) list.push(b);
    }
    return { bookmarkPreviewMap: previewMap };
  }, [bookmarks]);

  const facetedCategoryCountMap = useMemo(() => {
    const statusFilter = activeFilters.status || [];
    const tagFilterIds = activeFilters.tags || [];

    const countMap = new Map<string, number>();
    for (const b of bookmarks) {
      if (tagFilterIds.length > 0) {
        const hasMatchingTag = (b.tagIds || []).some(tagId => tagFilterIds.includes(tagId));
        if (!hasMatchingTag) continue;
      }
      if (statusFilter.length > 0 && !bookmarkMatchesStatusFilters(b, statusFilter)) continue;

      if (!b.categoryId) continue;
      countMap.set(b.categoryId, (countMap.get(b.categoryId) || 0) + 1);
      for (const desc of getDescendants(b.categoryId, categories)) {
        countMap.set(desc.id, (countMap.get(desc.id) || 0) + 1);
      }
      let current = categories.find(c => c.id === b.categoryId);
      while (current?.parentId) {
        const parent = categories.find(c => c.id === current!.parentId);
        if (parent) {
          countMap.set(parent.id, (countMap.get(parent.id) || 0) + 1);
        }
        current = parent;
      }
    }
    return countMap;
  }, [bookmarks, activeFilters.status, activeFilters.tags, categories]);

  const categoryTree = useMemo(() => {
    return buildCategoryTree(categories, facetedCategoryCountMap);
  }, [categories, facetedCategoryCountMap]);

  const handleAddCategory = useCallback(async () => {
    if (!newCategoryName.trim()) return;
    try {
      await createCategory(newCategoryName.trim(), '📁');
      setNewCategoryName('');
      setShowAddCategory(false);
    } catch (error) {
      console.error('添加分类失败:', error);
    }
  }, [newCategoryName, createCategory]);

  const expandedCategories = useMemo(() => new Set(expandedCategoriesArr), [expandedCategoriesArr]);

  const toggleCategoryFilter = useCallback((categoryId: string) => {
    const currentCategories = activeFilters.categories || [];
    const newCategories = currentCategories.includes(categoryId)
      ? currentCategories.filter(c => c !== categoryId)
      : [...currentCategories, categoryId];
    setActiveFilters({ ...activeFilters, categories: newCategories });
  }, [activeFilters, setActiveFilters]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">筛选</h2>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <ScopeBar />
      </div>

      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        <StatusFilters />
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[48%] flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700/50">
            <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" />
              分类
            </h3>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">{categoryTree.length}</span>
              <button
                onClick={() => setShowAddCategory(true)}
                className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="添加新分类"
              >
                <Plus className="w-3 h-3 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-1">
            {showAddCategory && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2">
                <Folder className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCategory();
                    else if (e.key === 'Escape') { setNewCategoryName(''); setShowAddCategory(false); }
                  }}
                  placeholder="输入分类名称"
                  className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button onClick={handleAddCategory} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded" title="确认添加">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => { setNewCategoryName(''); setShowAddCategory(false); }} className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded" title="取消">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="space-y-1">
              {categoryTree.map((rootNode) => (
                <CategoryTreeNode
                  key={rootNode.id}
                  node={rootNode}
                  level={0}
                  expandedCategories={expandedCategories}
                  activeFilters={activeFilters}
                  bookmarkCountMap={facetedCategoryCountMap}
                  bookmarkPreviewMap={bookmarkPreviewMap}
                  onToggleExpansion={toggleCategoryExpansion}
                  onCategoryClick={(id) => navigate(`/category/${encodeURIComponent(id)}`)}
                  onToggleFilter={toggleCategoryFilter}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="w-[52%] flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <TagList />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
