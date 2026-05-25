import React, { useMemo, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Folder, ChevronDown, CheckCircle, Plus } from 'lucide-react';
import type { Category } from '../types/index';
import {
  buildCategoryTree,
  convertToPopupCategoryNodes,
  getCategoryPath,
  type PopupCategoryNode,
} from '../utils/categoryTreeBuilder';

interface CategoryTreeSelectProps {
  categories: Category[];
  value?: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
  categoriesLoaded?: boolean;
  onCreateCategory?: (name: string) => Promise<string | void>;
  error?: string;
  className?: string;
}

const DROPDOWN_MAX_HEIGHT = 240;

const CategoryOption: React.FC<{
  node: PopupCategoryNode;
  level: number;
  selectedId: string;
  onSelect: (id: string) => void;
}> = ({ node, level, selectedId, onSelect }) => {
  const children = Object.values(node.children);

  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center gap-2"
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <span>{typeof node.originalCategory?.icon === 'string' ? node.originalCategory.icon : '📁'}</span>
        <span className="truncate">{node.name}</span>
        {selectedId === node.id && <CheckCircle className="w-4 h-4 text-primary ml-auto shrink-0" />}
      </button>
      {children.map((child) => (
        <CategoryOption
          key={child.id}
          node={child}
          level={level + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
};

const CategoryTreeSelect: React.FC<CategoryTreeSelectProps> = ({
  categories,
  value = '',
  onChange,
  disabled = false,
  categoriesLoaded = true,
  onCreateCategory,
  error,
  className = '',
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creating, setCreating] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const categoryTree = useMemo(() => {
    const tree = buildCategoryTree(categories);
    return convertToPopupCategoryNodes(tree);
  }, [categories]);

  const selectedLabel = value
    ? getCategoryPath(value, categories)
    : '选择分类文件夹...';

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUpward = spaceBelow < 120 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(
      DROPDOWN_MAX_HEIGHT,
      Math.max(120, openUpward ? spaceAbove : spaceBelow)
    );
    const top = openUpward ? Math.max(gap, rect.top - maxHeight - gap) : rect.bottom + gap;

    setMenuRect({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, []);

  useLayoutEffect(() => {
    if (!showDropdown) {
      setMenuRect(null);
      return;
    }
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [showDropdown, updateMenuPosition, categoryTree.length, isCreating]);

  const handleSelect = (id: string) => {
    onChange(id);
    setShowDropdown(false);
  };

  const handleCreate = async () => {
    const name = newCategoryName.trim();
    if (!name || !onCreateCategory) return;
    setCreating(true);
    try {
      const id = await onCreateCategory(name);
      if (typeof id === 'string') {
        onChange(id);
        setShowDropdown(false);
      }
      setNewCategoryName('');
      setIsCreating(false);
    } finally {
      setCreating(false);
    }
  };

  const dropdownPanel =
    showDropdown && !disabled && menuRect
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              aria-hidden
              onClick={() => setShowDropdown(false)}
            />
            <div
              className="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-xl overflow-y-auto overscroll-contain"
              style={{
                top: menuRect.top,
                left: menuRect.left,
                width: menuRect.width,
                maxHeight: menuRect.maxHeight,
              }}
              role="listbox"
            >
              {!categoriesLoaded ? (
                <div className="px-3 py-2 text-sm text-gray-500">正在加载分类...</div>
              ) : categoryTree.length > 0 ? (
                categoryTree.map((node) => (
                  <CategoryOption
                    key={node.id}
                    node={node}
                    level={0}
                    selectedId={value}
                    onSelect={handleSelect}
                  />
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">暂无分类，可新建</div>
              )}

              {onCreateCategory && (
                <div className="sticky bottom-0 border-t border-gray-200 bg-white p-2">
                  {!isCreating ? (
                    <button
                      type="button"
                      onClick={() => setIsCreating(true)}
                      className="w-full text-left px-2 py-1 text-sm text-primary hover:bg-gray-100 rounded flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      新建分类
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="输入分类名称..."
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={handleCreate}
                          disabled={!newCategoryName.trim() || creating}
                          className="flex-1 px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50"
                        >
                          {creating ? '创建中...' : '创建'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreating(false);
                            setNewCategoryName('');
                          }}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        <Folder className="w-4 h-4 inline mr-1" />
        分类
      </label>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setShowDropdown((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md transition-shadow bg-white text-left ${
          error
            ? 'border-red-300'
            : 'border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'}`}
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
      >
        <span
          className={`truncate ${value ? 'text-gray-900' : 'text-gray-500'}`}
          title={selectedLabel}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
        />
      </button>
      {dropdownPanel}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default CategoryTreeSelect;
