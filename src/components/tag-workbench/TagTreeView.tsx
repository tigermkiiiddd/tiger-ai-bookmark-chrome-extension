import React, { useCallback, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Tag, TagTreeNode } from '../../types';

interface TagTreeViewProps {
  tags: Tag[];
  tagTree: TagTreeNode[];
  tagCounts: Map<string, number>;
  tagPathMap: Map<string, string>;
  searchQuery: string;
  selectedTagId: string | null;
  onTagSelect: (tagId: string) => void;
}

interface FilterResult {
  filteredTree: TagTreeNode[];
  forcedExpandedIds: Set<string>;
  matchingIds: Set<string>;
}

function filterTreePreservingAncestors(
  tree: TagTreeNode[],
  query: string,
  tags: Tag[]
): FilterResult {
  const q = query.toLowerCase().trim();
  if (!q) {
    return { filteredTree: tree, forcedExpandedIds: new Set(), matchingIds: new Set() };
  }

  const tagById = new Map(tags.map(t => [t.id, t]));

  const matchingIds = new Set<string>();
  for (const tag of tags) {
    if (tag.name.toLowerCase().includes(q)) {
      matchingIds.add(tag.id);
    }
  }

  const ancestorIds = new Set<string>();
  for (const id of matchingIds) {
    let current = tagById.get(id);
    while (current?.parentId) {
      ancestorIds.add(current.parentId);
      current = tagById.get(current.parentId);
    }
  }

  const keepIds = new Set([...matchingIds, ...ancestorIds]);

  function filterNode(node: TagTreeNode): TagTreeNode | null {
    if (!keepIds.has(node.id)) return null;
    return {
      ...node,
      children: node.children.map(filterNode).filter(Boolean) as TagTreeNode[],
    };
  }

  return {
    filteredTree: tree.map(filterNode).filter(Boolean) as TagTreeNode[],
    forcedExpandedIds: ancestorIds,
    matchingIds,
  };
}

const TreeNodeRow: React.FC<{
  node: TagTreeNode;
  level: number;
  tagCounts: Map<string, number>;
  expanded: boolean;
  selectedTagId: string | null;
  isMatching: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}> = React.memo(({ node, level, tagCounts, expanded, selectedTagId, isMatching, onToggle, onSelect }) => {
  const count = tagCounts.get(node.id) || 0;
  const hasChildren = node.children.length > 0;
  const isSelected = selectedTagId === node.id;

  // 节点状态颜色
  const dotColor = count > 10
    ? 'bg-blue-500'
    : count > 0
    ? 'bg-emerald-400'
    : 'bg-gray-300 dark:bg-gray-600';

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-2 px-2 rounded-lg cursor-pointer group transition-all duration-150 ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
            : isMatching
            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
        }`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* 展开/收起按钮 */}
        {hasChildren ? (
          <button
            onClick={e => { e.stopPropagation(); onToggle(node.id); }}
            className="p-1 shrink-0 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ease-in-out ${expanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}

        {/* 状态圆点 */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />

        {/* 标签名 */}
        <span className="flex-1 truncate text-sm font-medium">{node.name}</span>

        {/* 使用数 */}
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">{count}</span>

        {/* 子节点数 */}
        {hasChildren && (
          <span className="text-xs text-gray-300 dark:text-gray-600 shrink-0 tabular-nums ml-1">
            ({node.children.length})
          </span>
        )}
      </div>

      {/* 子节点容器 — 带连接线和展开动画 */}
      {hasChildren && (
        <div
          className="overflow-hidden transition-all duration-200 ease-in-out"
          style={{
            maxHeight: expanded ? `${node.children.length * 44 + 100}px` : '0px',
            opacity: expanded ? 1 : 0,
          }}
        >
          <div className="ml-5 border-l-2 border-gray-200 dark:border-gray-700">
            {node.children.map(child => (
              <TreeNodeRow
                key={child.id}
                node={child}
                level={level + 1}
                tagCounts={tagCounts}
                expanded={expanded}
                selectedTagId={selectedTagId}
                isMatching={false} // 子节点的高亮由父级处理
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

TreeNodeRow.displayName = 'TreeNodeRow';

export const TagTreeView: React.FC<TagTreeViewProps> = ({
  tags,
  tagTree,
  tagCounts,
  tagPathMap,
  searchQuery,
  selectedTagId,
  onTagSelect,
}) => {
  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setManualExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { filteredTree, forcedExpandedIds, matchingIds } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { filteredTree: tagTree, forcedExpandedIds: new Set<string>(), matchingIds: new Set<string>() };
    }
    return filterTreePreservingAncestors(tagTree, searchQuery, tags);
  }, [tagTree, searchQuery, tags]);

  const expandedSet = useMemo(() => {
    if (!searchQuery.trim()) return manualExpanded;
    return new Set([...manualExpanded, ...forcedExpandedIds]);
  }, [manualExpanded, forcedExpandedIds, searchQuery]);

  if (filteredTree.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        {searchQuery ? '没有匹配的标签' : '暂无标签'}
      </div>
    );
  }

  return (
    <div className="space-y-0.5 select-none pb-8">
      {filteredTree.map(node => (
        <TreeNodeRow
          key={node.id}
          node={node}
          level={0}
          tagCounts={tagCounts}
          expanded={expandedSet.has(node.id)}
          selectedTagId={selectedTagId}
          isMatching={matchingIds.has(node.id)}
          onToggle={toggleExpand}
          onSelect={onTagSelect}
        />
      ))}
    </div>
  );
};
