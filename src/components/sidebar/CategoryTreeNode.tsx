import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Folder, FolderOpen, Plus, ChevronRight, Edit2, Trash2, Check } from 'lucide-react';
import { useBookmarkStore } from '../../store';
import { Bookmark as BookmarkType } from '../../types';

// 模块级拖拽状态，在所有树节点间共享
interface DragState {
  draggedId: string | null;
  dropTarget: { id: string; position: 'before' | 'into' | 'after' } | null;
}
const dragState: DragState = { draggedId: null, dropTarget: null };

export interface CategoryTreeNodeProps {
  node: {
    id: string;
    name: string;
    fullPath: string;
    children: any[];
    bookmarkCount: number;
    color: string;
    icon: string;
  };
  level: number;
  expandedCategories: Set<string>;
  activeFilters: {
    categories?: string[];
    tags?: string[];
    status?: string[];
  };
  bookmarkCountMap: Map<string, number>;
  bookmarkPreviewMap: Map<string, BookmarkType[]>;
  onToggleExpansion: (categoryId: string) => void;
  onCategoryClick: (categoryId: string) => void;
  onToggleFilter: (categoryId: string) => void;
}

const CategoryTreeNode: React.FC<CategoryTreeNodeProps> = React.memo(({
  node,
  level,
  expandedCategories,
  activeFilters,
  bookmarkCountMap,
  bookmarkPreviewMap,
  onToggleExpansion,
  onCategoryClick,
  onToggleFilter,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [dropPosition, setDropPosition] = useState<'before' | 'into' | 'after' | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const updateCategory = useBookmarkStore(s => s.updateCategory);
  const deleteCategory = useBookmarkStore(s => s.deleteCategory);
  const createSubCategory = useBookmarkStore(s => s.createSubCategory);
  const moveCategory = useBookmarkStore(s => s.moveCategory);

  const isExpanded = expandedCategories.has(node.id);
  const isSelected = (activeFilters.categories || []).includes(node.id);
  const hasChildren = node.children.length > 0;
  const count = bookmarkCountMap.get(node.id) || 0;
  const INDENT = 16;

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  useEffect(() => {
    if (isEditing && editInputRef.current) editInputRef.current.focus();
  }, [isEditing]);

  useEffect(() => {
    if (showCreateSub && subInputRef.current) subInputRef.current.focus();
  }, [showCreateSub]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasChildren) onToggleExpansion(node.id);
    },
    [hasChildren, node.id, onToggleExpansion]
  );

  const handleRowClick = useCallback(() => {
    if (hasChildren) onToggleExpansion(node.id);
  }, [hasChildren, node.id, onToggleExpansion]);

  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleFilter(node.id);
  }, [node.id, onToggleFilter]);

  const handleDoubleClick = useCallback(() => {
    onCategoryClick(node.id);
  }, [node.id, onCategoryClick]);

  const handleRename = useCallback(async () => {
    if (editName.trim() && editName.trim() !== node.name) {
      try { await updateCategory(node.id, { name: editName.trim() }); } catch { setEditName(node.name); }
    }
    setIsEditing(false);
  }, [editName, node.id, node.name, updateCategory]);

  const handleDelete = useCallback(async () => {
    if (confirm(`确定要删除 "${node.fullPath}" 吗？此操作无法撤销。`)) {
      try { await deleteCategory(node.id); } catch { /* */ }
    }
    setContextMenu(null);
  }, [node.id, node.fullPath, deleteCategory]);

  const handleCreateSub = useCallback(async () => {
    if (!newSubName.trim()) return;
    try {
      await createSubCategory(node.id, newSubName.trim());
      setNewSubName('');
      setShowCreateSub(false);
      setContextMenu(null);
      if (!isExpanded) onToggleExpansion(node.id);
    } catch { /* */ }
  }, [newSubName, node.id, createSubCategory, isExpanded, onToggleExpansion]);

  // ---- 拖拽 ----

  const getDropPosition = useCallback((e: React.DragEvent): 'before' | 'into' | 'after' | null => {
    if (!rowRef.current) return null;
    if (dragState.draggedId === node.id) return null;
    const rect = rowRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    if (y < h * 0.25) return 'before';
    if (y > h * 0.75) return 'after';
    return 'into';
  }, [node.id]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    dragState.draggedId = node.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4';
    }
  }, [node.id]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '';
    }
    dragState.draggedId = null;
    dragState.dropTarget = null;
    setDropPosition(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragState.draggedId === node.id) return;
    const pos = getDropPosition(e);
    e.dataTransfer.dropEffect = 'move';
    if (pos !== dropPosition) {
      setDropPosition(pos);
      dragState.dropTarget = pos ? { id: node.id, position: pos } : null;
    }
  }, [node.id, dropPosition, getDropPosition]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (rowRef.current && !rowRef.current.contains(e.relatedTarget as Node)) {
      setDropPosition(null);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = dragState.draggedId;
    if (!draggedId || draggedId === node.id) {
      setDropPosition(null);
      return;
    }
    const pos = getDropPosition(e);
    let newParentId: string | null;
    if (pos === 'into') {
      newParentId = node.id;
    } else {
      const targetCat = useBookmarkStore.getState().categories.find(c => c.id === node.id);
      newParentId = targetCat?.parentId ?? null;
    }
    await moveCategory(draggedId, newParentId);
    dragState.draggedId = null;
    dragState.dropTarget = null;
    setDropPosition(null);
  }, [node.id, getDropPosition, moveCategory]);

  return (
    <div>
      {/* 节点行 */}
      <div
        ref={rowRef}
        draggable={!isEditing}
        className={`relative flex items-center h-7 cursor-pointer select-none group ${
          isSelected
            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
        } ${dropPosition === 'into' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
        style={{ paddingLeft: level * INDENT + 4 }}
        onClick={isEditing ? undefined : handleRowClick}
        onDoubleClick={isEditing ? undefined : handleDoubleClick}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dropPosition === 'before' && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" style={{ marginLeft: level * INDENT + 4 }} />
        )}
        {dropPosition === 'after' && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" style={{ marginLeft: level * INDENT + 4 }} />
        )}

        <span
          role="button"
          tabIndex={0}
          onClick={handleChevronClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              if (hasChildren) onToggleExpansion(node.id);
            }
          }}
          className={`flex-shrink-0 w-4 h-4 flex items-center justify-center transition-transform duration-150 ${
            isExpanded ? 'rotate-90' : ''
          } ${hasChildren ? 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300' : 'text-transparent pointer-events-none'}`}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </span>

        {isExpanded ? (
          <FolderOpen className="flex-shrink-0 w-4 h-4 mr-1.5 text-yellow-500" />
        ) : (
          <Folder className="flex-shrink-0 w-4 h-4 mr-1.5 text-yellow-600" />
        )}

        {isEditing ? (
          <input
            ref={editInputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              else if (e.key === 'Escape') { setEditName(node.name); setIsEditing(false); }
            }}
            className="flex-1 min-w-0 px-1 text-sm bg-white dark:bg-gray-800 border border-blue-400 rounded outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-sm">
            {node.name}
            {count > 0 && <span className="text-gray-400 dark:text-gray-500 ml-1">({count})</span>}
          </span>
        )}

        {!isEditing && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowCreateSub(true); }}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
            title="新建子文件夹"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}

        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer ml-1"
        />
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { setIsEditing(true); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Edit2 className="w-3.5 h-3.5" />重命名
          </button>
          <button
            onClick={() => { setShowCreateSub(true); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Plus className="w-3.5 h-3.5" />新建子文件夹
          </button>
          <hr className="my-1 border-gray-200 dark:border-gray-600" />
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-3.5 h-3.5" />删除
          </button>
        </div>
      )}

      {/* 内联新建子文件夹 */}
      {showCreateSub && (
        <div className="flex items-center h-7" style={{ paddingLeft: (level + 1) * INDENT + 4 }}>
          <span className="flex-shrink-0 w-4 h-4" />
          <Folder className="flex-shrink-0 w-4 h-4 mr-1.5 text-gray-400" />
          <input
            ref={subInputRef}
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            onBlur={() => { if (!newSubName.trim()) setShowCreateSub(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSub();
              else if (e.key === 'Escape') { setNewSubName(''); setShowCreateSub(false); }
            }}
            placeholder="文件夹名称"
            className="flex-1 min-w-0 px-1 text-sm bg-white dark:bg-gray-800 border border-blue-400 rounded outline-none"
          />
          <button
            onClick={handleCreateSub}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 rounded"
          >
            <Check className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 子节点 */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedCategories={expandedCategories}
              activeFilters={activeFilters}
              bookmarkCountMap={bookmarkCountMap}
              bookmarkPreviewMap={bookmarkPreviewMap}
              onToggleExpansion={onToggleExpansion}
              onCategoryClick={onCategoryClick}
              onToggleFilter={onToggleFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
});
CategoryTreeNode.displayName = 'CategoryTreeNode';

export default CategoryTreeNode;
