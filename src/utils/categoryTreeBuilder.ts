import type { Category, Bookmark } from '@/types';
import { CATEGORY_TAXONOMY_RULES } from '../constants/index';

export interface CategoryTreeNode {
  id: string;
  name: string;
  color: string;
  icon: string;
  parentId: string | null;
  children: CategoryTreeNode[];
  bookmarkCount: number;
  fullPath: string;
  level: number;
}

export interface PopupCategoryNode {
  name: string;
  fullName: string;
  id: string;
  children: Record<string, PopupCategoryNode>;
  originalCategory: Category | null;
}

// ---- 派生计算函数 ----

/** 从节点往上走，返回完整路径如 "技术/前端开发/React" */
export function getCategoryPath(categoryId: string | undefined, categories: Category[]): string {
  if (!categoryId) return '';
  const parts: string[] = [];
  let current = categories.find(c => c.id === categoryId);
  let safety = 0;
  while (current && safety < 20) {
    parts.unshift(typeof current.name === 'string' ? current.name : String(current.name));
    if (!current.parentId) break;
    current = categories.find(c => c.id === current!.parentId);
    safety++;
  }
  return parts.join('/');
}

/** Pre-compute categoryId -> full path string for all categories */
export function buildCategoryPathByIdMap(categories: Category[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const cat of categories) {
    map.set(cat.id, getCategoryPath(cat.id, categories));
  }
  return map;
}

/** 从节点往上走，返回层级深度（根节点=1） */
export function getCategoryLevel(categoryId: string | undefined, categories: Category[]): number {
  if (!categoryId) return 0;
  let level = 1;
  let current = categories.find(c => c.id === categoryId);
  let safety = 0;
  while (current?.parentId && safety < 20) {
    level++;
    current = categories.find(c => c.id === current!.parentId);
    safety++;
  }
  return level;
}

/** 获取某节点的所有后代节点 */
export function getDescendants(categoryId: string, categories: Category[]): Category[] {
  const children = categories.filter(c => c.parentId === categoryId);
  const result: Category[] = [];
  for (const child of children) {
    result.push(child);
    result.push(...getDescendants(child.id, categories));
  }
  return result;
}

/** 某分类自身 + 所有子孙分类的 ID（用于筛选时包含子级书签） */
export function getCategoryScopeIds(categoryId: string, categories: Category[]): Set<string> {
  const ids = new Set<string>([categoryId]);
  for (const descendant of getDescendants(categoryId, categories)) {
    ids.add(descendant.id);
  }
  return ids;
}

/** 多个筛选分类的并集 scope（每个选中项均含其子孙） */
export function getCategoryFilterScopeIds(
  filterCategoryIds: string[],
  categories: Category[]
): Set<string> {
  const scope = new Set<string>();
  for (const id of filterCategoryIds) {
    for (const scopedId of getCategoryScopeIds(id, categories)) {
      scope.add(scopedId);
    }
  }
  return scope;
}

/** 从书签列表统计每个 categoryId 的书签数量 */
export function buildBookmarkCountMap(bookmarks: Bookmark[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const b of bookmarks) {
    if (!b.categoryId) continue;
    map.set(b.categoryId, (map.get(b.categoryId) || 0) + 1);
  }
  return map;
}

/** 将 AI 返回的路径规范化为最多 4 级 */
export function normalizeCategoryPath(path: string): string {
  const parts = path
    .split('/')
    .map(p => p.trim())
    .filter(Boolean);
  return parts.slice(0, CATEGORY_TAXONOMY_RULES.maxDepth).join('/');
}

/** 格式化现有分类树供 AI prompt 使用 */
export function formatCategoryTreeForAI(
  categories: Category[],
  bookmarkCountMap?: Map<string, number>
): string {
  const safeCategories = categories.filter(c => c && typeof c.name === 'string');
  if (safeCategories.length === 0) {
    return '（暂无已有分类，请按 taxonomy 规则创建）';
  }

  const tree = buildCategoryTree(safeCategories, bookmarkCountMap);
  const lines: string[] = [];

  function walk(nodes: CategoryTreeNode[], indent: number) {
    for (const node of nodes) {
      const prefix = '  '.repeat(indent);
      const count = node.bookmarkCount;
      const levelHint = `(L${node.level}, ${count}书签)`;
      lines.push(`${prefix}- ${node.fullPath} ${levelHint}`);
      if (node.children.length > 0) walk(node.children, indent + 1);
    }
  }

  walk(tree, 0);
  return lines.join('\n');
}

/** 格式化 taxonomy 规则供 AI prompt 使用 */
export function formatTaxonomyRulesForAI(): string {
  const { maxDepth, levels, decisionRules } = CATEGORY_TAXONOMY_RULES;
  const levelLines = levels.map(l =>
    `  L${l.level} ${l.name}：${l.description}；建议 ${l.recommendedNodeCount.min}-${l.recommendedNodeCount.max} 个节点/父级，每节点 ${l.recommendedBookmarksPerNode.min}${l.recommendedBookmarksPerNode.max === Infinity ? '+' : `-${l.recommendedBookmarksPerNode.max}`} 书签；${l.role}`
  );
  const ruleLines = decisionRules.map((r, i) => `  ${i + 1}. ${r}`);

  return [
    `最大深度：${maxDepth} 级（用 / 分隔）`,
    '各级规则：',
    ...levelLines,
    '决策规则：',
    ...ruleLines,
  ].join('\n');
}

/** 根据 AI 返回的分类名，在目录树中找到最匹配的 Category 节点 */
export function resolveCategoryByName(name: string, categories: Category[]): Category | undefined {
  const safeCategories = categories.filter(c => c && typeof c.name === 'string');
  // 精确匹配 name
  const exact = safeCategories.find(c => c.name === name);
  if (exact) return exact;
  // 尝试匹配 fullPath（兼容 AI 返回路径的情况）
  const byPath = safeCategories.find(c => getCategoryPath(c.id, safeCategories) === name);
  if (byPath) return byPath;
  // 忽略大小写匹配
  const lower = name.toLowerCase();
  return safeCategories.find(c => c.name.toLowerCase() === lower);
}

// ---- 树构建 ----

/** 构建目录树，bookmarkCount 按传入的统计填充 */
export function buildCategoryTree(
  categories: Category[],
  bookmarkCountMap?: Map<string, number>
): CategoryTreeNode[] {
  // 过滤掉无效数据（name 不是字符串的对象）
  const safeCategories = categories.filter(c => c && typeof c.name === 'string' && typeof c.id === 'string');
  const nodeMap = new Map<string, CategoryTreeNode>();

  // 创建所有节点
  for (const cat of safeCategories) {
    nodeMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      parentId: cat.parentId,
      children: [],
      bookmarkCount: bookmarkCountMap?.get(cat.id) || 0,
      fullPath: '',
      level: 0,
    });
  }

  // 计算 fullPath 和 level，构建父子关系
  const roots: CategoryTreeNode[] = [];
  for (const cat of safeCategories) {
    const node = nodeMap.get(cat.id)!;
    node.fullPath = getCategoryPath(cat.id, safeCategories);
    node.level = getCategoryLevel(cat.id, safeCategories);

    if (cat.parentId && nodeMap.has(cat.parentId)) {
      nodeMap.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** 将树节点转换为 Popup 组件需要的格式 */
export function convertToPopupCategoryNodes(
  tree: CategoryTreeNode[]
): PopupCategoryNode[] {
  return tree.map(node => ({
    name: node.name,
    fullName: node.fullPath,
    id: node.id,
    children: convertChildrenToPopupNodes(node.children),
    originalCategory: {
      id: node.id,
      name: node.name,
      color: node.color,
      icon: node.icon,
      parentId: node.parentId,
      createdAt: 0,
    },
  }));
}

function convertChildrenToPopupNodes(
  children: CategoryTreeNode[]
): Record<string, PopupCategoryNode> {
  const result: Record<string, PopupCategoryNode> = {};
  for (const child of children) {
    result[child.name] = {
      name: child.name,
      fullName: child.fullPath,
      id: child.id,
      children: convertChildrenToPopupNodes(child.children),
      originalCategory: {
        id: child.id,
        name: child.name,
        color: child.color,
        icon: child.icon,
        parentId: child.parentId,
        createdAt: 0,
      },
    };
  }
  return result;
}
