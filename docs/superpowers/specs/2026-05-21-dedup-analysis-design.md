# 智能去重分析功能设计

## 概述

为书签管理器添加纯前端的去重分析页面，检测完全相同和近似重复的书签，提供去重建议供用户手动操作。

## 检测规则

### 完全相同

URL 规范化后完全一致的书签。规范化步骤：
1. 协议统一为 https
2. 去除尾部 `/`
3. 去除 `www.`
4. 排序查询参数
5. 去除 fragment（`#` 后部分）

### 近似页面

去除分页参数后 URL 相同的书签。分页参数列表：
`page`, `p`, `pn`, `pg`, `pageNo`, `pageNum`, `currentPage`, `start`, `offset`

不同 ID 的不同页面不算近似。只有 ID 相同但分页参数不同才算。

## 页面交互

- 入口：主页工具栏的"去重分析"按钮，点击跳转到 `/dedup`
- Tab 切换：完全相同 / 近似页面
- 每组可折叠展开，显示组内所有书签
- 书签 URL 可点击打开
- 每个书签前有复选框，用户勾选要删除的
- 可忽略整个组
- 底部固定操作栏：显示选中数量 + 删除按钮
- 纯建议模式，不自动删除

## 文件结构

| 文件 | 作用 |
|------|------|
| `src/services/deduplication.ts` | 去重分析核心逻辑 |
| `src/components/DedupPage.tsx` | 去重分析页面组件 |
| `options/OptionsApp.tsx` | 添加 `/dedup` 路由 |

## 核心类型

```typescript
interface DupGroup {
  id: string;
  type: 'exact' | 'similar';
  normalizedKey: string;
  bookmarks: Bookmark[];
}

interface DupAnalysisResult {
  exactGroups: DupGroup[];
  similarGroups: DupGroup[];
  stats: {
    totalBookmarks: number;
    duplicateCount: number;
    groupsCount: number;
  };
}
```

## 数据流

1. `DedupPage` 从 store 读取 `bookmarks`
2. 调用 `analyzeDuplicates(bookmarks)` 返回 `DupAnalysisResult`
3. 用户勾选后调用 `batchDeleteBookmarks(ids)` 删除
