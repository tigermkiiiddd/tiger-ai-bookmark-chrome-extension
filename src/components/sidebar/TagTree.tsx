import React, { useCallback, useMemo, useState } from 'react';
import { ChevronRight, Tag as TagIcon } from 'lucide-react';
import type { Tag, TagTreeNode } from '../../types';

function buildTagTree(tags: Tag[]): TagTreeNode[] {
  const tagMap = new Map<string, TagTreeNode>();
  const roots: TagTreeNode[] = [];
  for (const tag of tags) {
    tagMap.set(tag.id, { ...tag, children: [], level: 1 });
  }
  for (const node of tagMap.values()) {
    if (node.parentId && tagMap.has(node.parentId)) {
      const parent = tagMap.get(node.parentId)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

interface TagTreeProps {
  tags: Tag[];
  tagCounts: Map<string, number>;
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
}

const TreeNodeRow: React.FC<{
  node: TagTreeNode;
  level: number;
  tagCounts: Map<string, number>;
  expandedSet: Set<string>;
  selectedTagIds: string[];
  onToggleExpand: (id: string) => void;
  onToggleTag: (id: string) => void;
}> = React.memo(({
  node,
  level,
  tagCounts,
  expandedSet,
  selectedTagIds,
  onToggleExpand,
  onToggleTag,
}) => {
  const hasChildren = node.children.length > 0;
  const isSelected = selectedTagIds.includes(node.id);
  const count = tagCounts.get(node.id) || 0;
  const isExpanded = expandedSet.has(node.id);
  const INDENT = 14;

  return (
    <div>
      <div
        className={`flex items-center h-7 cursor-pointer select-none group ${
          isSelected
            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }`}
        style={{ paddingLeft: level * INDENT + 4 }}
      >
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggleExpand(node.id); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              if (hasChildren) onToggleExpand(node.id);
            }
          }}
          className={`flex-shrink-0 w-4 h-4 flex items-center justify-center transition-transform duration-150 ${
            isExpanded ? 'rotate-90' : ''
          } ${hasChildren ? 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300' : 'text-transparent pointer-events-none'}`}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </span>

        <TagIcon className="flex-shrink-0 w-3.5 h-3.5 mr-1 text-gray-400" />

        <span
          className="flex-1 min-w-0 truncate text-sm"
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggleExpand(node.id); }}
        >
          {node.name}
        </span>

        {count > 0 && (
          <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 mr-1">
            {count}
          </span>
        )}

        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleTag(node.id)}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer mr-1"
        />
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeNodeRow
              key={child.id}
              node={child}
              level={level + 1}
              tagCounts={tagCounts}
              expandedSet={expandedSet}
              selectedTagIds={selectedTagIds}
              onToggleExpand={onToggleExpand}
              onToggleTag={onToggleTag}
            />
          ))}
        </div>
      )}
    </div>
  );
});
TreeNodeRow.displayName = 'TreeNodeRow';

const TagTree: React.FC<TagTreeProps> = ({
  tags,
  tagCounts,
  selectedTagIds,
  onToggleTag,
}) => {
  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set());

  const tagTree = useMemo(() => buildTagTree(tags), [tags]);

  const toggleExpand = useCallback((id: string) => {
    setManualExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (tagTree.length === 0) {
    return (
      <div className="px-2 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
        暂无标签
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tagTree.map(node => (
        <TreeNodeRow
          key={node.id}
          node={node}
          level={0}
          tagCounts={tagCounts}
          expandedSet={manualExpanded}
          selectedTagIds={selectedTagIds}
          onToggleExpand={toggleExpand}
          onToggleTag={onToggleTag}
        />
      ))}
    </div>
  );
};

export default TagTree;
