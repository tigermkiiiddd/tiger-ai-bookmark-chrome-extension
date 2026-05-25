# MainPage 卡片渲染与更新性能优化方案

## 背景

MainPage 目前已经做了无限滚动分页，只把 `filteredBookmarks.slice(0, displayedCount)` 渲染到 DOM 中，但页面在卡片渲染、选中、排序、截图更新、AI 归档后仍可能出现明显卡顿。原因不只是 DOM 数量，而是过滤排序、全局状态订阅、单卡派生数据和存储更新路径仍然会触发整页级别的 CPU、React render 和持久化开销。

本方案基于以下代码路径分析：

- `src/components/MainPage.tsx`
- `src/components/main/BookmarkContent.tsx`
- `src/components/BookmarkCard.tsx`
- `src/components/BookmarkListItem.tsx`
- `src/store/actions/filterActions.ts`
- `src/store/slices/bookmarkSlice.ts`
- `src/store/slices/screenshotSlice.ts`
- `src/core/storage/bookmarks.ts`
- `src/services/storage.ts`
- `src/utils/categoryTreeBuilder.ts`
- `src/utils/tagPath.ts`
- `src/styles/global.css`

GitNexus 索引已重新分析，当前文档只做优化设计，不修改业务符号。

## 主要结论

性能瓶颈集中在五类问题：

1. `getFilteredBookmarks()` 在渲染期每次全量重新过滤、排序和构造新数组。
2. `BookmarkCard` 和 `BookmarkListItem` 订阅了整个 Zustand store，任意 store 变化都会让所有已渲染卡片重新渲染。
3. 每张卡片重复构建标签路径、分类路径、日期、域名、样式等派生数据。
4. 更新单个书签会读取、重写、映射整份 bookmarks 数组，并替换数组引用，导致 MainPage 重新过滤排序和卡片批量更新。
5. 无限滚动只是延迟追加 DOM，不是虚拟列表；滚动越久，DOM、图片、布局和 hover 动画成本越高。

优先级最高的是减少无关卡片重渲染和把过滤排序从 render 阶段搬走。若只继续调 pageSize 或图片样式，收益会有限。

## 现状链路

### 渲染链路

`MainPage` 在组件函数体内直接调用 `getFilteredBookmarks()`，然后把新数组传给 header 和 content：

```text
MainPage render
  -> getFilteredBookmarks()
  -> MainPageHeader(filteredBookmarks)
  -> BookmarkContent(filteredBookmarks)
  -> displayedBookmarks = filteredBookmarks.slice(0, displayedCount)
  -> map BookmarkCard / BookmarkListItem
```

关键位置：

- `src/components/MainPage.tsx:43`
- `src/components/MainPage.tsx:100`
- `src/components/MainPage.tsx:108`
- `src/components/main/BookmarkContent.tsx:54`
- `src/components/main/BookmarkContent.tsx:265`

### 过滤排序链路

`getFilteredBookmarks()` 每次执行都会从 `state.bookmarks` 开始，按搜索、标签、分类、状态过滤，再复制并排序：

- 搜索时每个 bookmark 调 `resolveTagPaths()`
- 分类排序时每次比较都可能调两次 `getCategoryPath()`
- 最终 `return sortedBookmarks` 是全新数组

关键位置：

- `src/store/actions/filterActions.ts:27`
- `src/store/actions/filterActions.ts:34`
- `src/store/actions/filterActions.ts:72`
- `src/store/actions/filterActions.ts:79`
- `src/store/actions/filterActions.ts:80`

这意味着任意导致 MainPage render 的状态变化，都可能重新跑一遍 O(n) 到 O(n log n) 的派生计算。

### 卡片订阅链路

`BookmarkCard` 内部直接 `useBookmarkStore()` 读取整个 store，再额外订阅 `categories` 和 `tags`：

- `src/components/BookmarkCard.tsx:28`
- `src/components/BookmarkCard.tsx:39`
- `src/components/BookmarkCard.tsx:40`

`BookmarkListItem` 也有同类问题：

- `src/components/BookmarkListItem.tsx:23`
- `src/components/BookmarkListItem.tsx:34`
- `src/components/BookmarkListItem.tsx:35`

直接订阅整个 store 是当前最严重的渲染放大器。选中一个卡片、截图进度变化、错误状态变化、AI 归档进度变化，都可能让每个已渲染卡片重新执行组件函数。

### 更新链路

单个 `updateBookmark` 当前包含两层全量操作：

```text
store.updateBookmark(id, updates)
  -> storageService.updateBookmark(id, updates)
    -> bookmarkStorage.getBookmarks()
    -> findIndex()
    -> chromeStorage.set({ bookmarks: fullArray })
  -> state.bookmarks.map(...)
  -> set({ bookmarks: updatedBookmarks })
```

关键位置：

- `src/store/slices/bookmarkSlice.ts:165`
- `src/store/slices/bookmarkSlice.ts:168`
- `src/store/slices/bookmarkSlice.ts:171`
- `src/store/slices/bookmarkSlice.ts:180`
- `src/core/storage/bookmarks.ts:96`
- `src/core/storage/bookmarks.ts:98`
- `src/core/storage/bookmarks.ts:99`
- `src/core/storage/bookmarks.ts:113`

截图批量更新会对每个截图结果调用 `get().updateBookmark()`，最后又 `loadBookmarks()`：

- `src/store/slices/screenshotSlice.ts:95`
- `src/store/slices/screenshotSlice.ts:108`
- `src/store/slices/screenshotSlice.ts:145`

因此批量截图或批量 AI 更新时，会出现多次全量持久化、多次全量数组替换、多次过滤排序和多次卡片渲染。

## 瓶颈细分

### P0：卡片全局 store 订阅

问题：

- `BookmarkCard` 和 `BookmarkListItem` 读取整个 store。
- Zustand 中任意状态变化都会使已渲染卡片重新渲染。
- `selectedBookmarks.includes(bookmark.id)` 在每张卡片中执行，选中状态变化时所有卡片都要重新算。

影响：

- 单选一个卡片，本应只更新 1 到 2 张卡片，实际可能更新当前已渲染的 50、100、500 张卡片。
- 批量任务进度更新会拖慢主页面，即使卡片内容没有变化。

建议：

1. 禁止卡片使用裸 `useBookmarkStore()`。
2. 卡片只订阅自己需要的 action，或由父组件传入稳定 action。
3. 将 `selectedBookmarks` 改为或派生为 `selectedBookmarkIds: Set<string>`，让单卡通过 `selectedSet.has(id)` 判断。
4. 更彻底的方案是 store 维护 `selectedBookmarkIdSet` 或 selection slice，并提供 `useIsBookmarkSelected(id)` 这类细粒度 selector。
5. `BookmarkCard` 和 `BookmarkListItem` 用 `React.memo` 包起来，并保证传入 props 引用稳定。

预期收益：

- 选中、取消选中、打开菜单时，重渲染范围从“全部已展示卡片”降到“受影响卡片 + 工具栏”。
- 批量任务进度更新不再冲击主列表卡片。

### P0：过滤排序在 render 阶段全量执行

问题：

- `MainPage` 每次 render 都调用 `getFilteredBookmarks()`。
- `getFilteredBookmarks()` 每次返回新数组。
- `MainPageHeader` 的 `linkCheckQueue` 依赖 `filteredBookmarks`，因此新数组会放大 header 内部派生计算。

影响：

- 选中、右键菜单、modal 状态、加载更多、更新一个 bookmark 都可能重新过滤排序整份列表。
- 无限滚动只减少 DOM，不减少过滤排序 CPU。

建议：

1. 把 `filteredBookmarkIds` 或 `filteredBookmarks` 变成 store 派生缓存，只在这些输入变化时重算：
   - `bookmarks`
   - `tags`
   - `categories`
   - `searchQuery`
   - `activeFilters`
   - `sortBy`
   - `sortOrder`
2. MainPage 不直接调用函数计算结果，而是订阅稳定的 `filteredBookmarkIds`。
3. `displayedBookmarkIds = filteredBookmarkIds.slice(0, displayedCount)` 后，卡片按 id 读取单个 bookmark 或由父层从 `bookmarkById` 映射。
4. 若暂时不重构 store，可至少在 MainPage 用 `useMemo` 包住过滤排序函数的输入，但长期应避免把重计算藏在 render 中。

预期收益：

- 与筛选无关的 UI 状态变化不再触发全量过滤排序。
- header、content、context menu 共享同一份稳定派生结果。

### P0：单个更新导致整页级别变更

问题：

- storage 层单个更新读取并写回整份 bookmarks 数组。
- store 层用 `map` 替换整份 bookmarks 数组。
- 所有依赖 `bookmarks` 数组引用的 selector 和派生数据都会失效。

建议：

1. store 内部增加 normalized state：
   - `bookmarkIds: string[]`
   - `bookmarkById: Record<string, Bookmark>` 或 `Map<string, Bookmark>`
2. 单个更新只替换 `bookmarkById[id]`，保持其他 bookmark 引用不变。
3. 列表渲染使用 id 数组，单卡通过 id 订阅自己的 bookmark：
   - `useBookmarkStore(s => s.bookmarkById[id])`
4. 批量截图、AI 归档、批量状态变更使用 batch action，合并多次 store set。
5. storage 层短期可以保留整数组写回，但 UI 层必须先批处理状态更新；中期考虑 IndexedDB object store 按 id 存储 bookmark。

预期收益：

- 单个书签更新只重渲染对应卡片。
- 批量更新从 N 次整页刷新降为批次级刷新。

### P1：卡片派生数据重复计算

问题：

- 每张 `BookmarkCard` 都执行 `buildTagPathByIdMap(tags)`。
- 每张卡片渲染分类时调用 `getCategoryPath(bookmark.categoryId, categories)`。
- `getCategoryPath()` 内部用 `categories.find` 沿父级逐层查找。
- `getTagColor(tag)` 每个 tag 每次 render 都重新 hash。
- `formatDate()` 每次 render 都创建 Date 并计算相对时间。

关键位置：

- `src/components/BookmarkCard.tsx:40`
- `src/components/BookmarkCard.tsx:41`
- `src/components/BookmarkCard.tsx:253`
- `src/components/BookmarkCard.tsx:288`
- `src/components/BookmarkCard.tsx:296`
- `src/utils/tagPath.ts:28`
- `src/utils/categoryTreeBuilder.ts:27`
- `src/utils/categoryTreeBuilder.ts:30`
- `src/utils/categoryTreeBuilder.ts:35`

建议：

1. 在 store 或父层统一构建：
   - `tagPathById`
   - `categoryPathById`
   - `tagColorByName`
2. 卡片只消费已经算好的 `tagNames`、`categoryPath`、`domain`、`createdAtLabel`。
3. `getCategoryPath` 改为基于 `categoryById` map，而不是循环 `find`。
4. 相对时间可以在数据进入 UI 时生成，或只在分钟级 timer tick 时刷新，不随任意 UI 状态刷新。

预期收益：

- 大量卡片渲染时减少重复 Map 构建和数组查找。
- 分类排序、卡片渲染、header filter label 可共享同一份路径缓存。

### P1：DOM 持续累积和图片加载

问题：

- 无限滚动会不断追加卡片，旧卡片不卸载。
- `img` 没有 `loading="lazy"` 和 `decoding="async"`。
- 卡片使用 `transition-all`、hover shadow、hover translate，滚动和 hover 时容易触发布局/合成成本。
- grid 缺少 `content-visibility` 之类的渲染隔离。

关键位置：

- `src/components/BookmarkCard.tsx:115`
- `src/components/BookmarkCard.tsx:205`
- `src/components/BookmarkCard.tsx:216`
- `src/styles/global.css:161`
- `src/styles/global.css:163`
- `src/styles/global.css:196`

建议：

1. 图片加：
   - `loading="lazy"`
   - `decoding="async"`
   - 固定 `width` / `height` 或稳定 aspect ratio
2. CSS 限定 transition 属性，避免 `transition-all`：
   - card：`transition: border-color, box-shadow, transform`
   - 按钮：`transition: background-color, color, opacity`
3. 在卡片容器上评估：
   - `content-visibility: auto`
   - `contain-intrinsic-size`
4. 列表超过 300 到 500 项时引入虚拟列表，而不是继续累积 DOM。

预期收益：

- 首屏和滚动过程更稳定。
- 图片解码和 offscreen DOM 对主线程影响下降。

### P1：inline callback 阻碍 memo

问题：

列表 map 内每次 render 都创建新的右键回调：

- `src/components/main/BookmarkContent.tsx:270`
- `src/components/main/BookmarkContent.tsx:276`

即使给 `BookmarkCard` 加 `React.memo`，新函数 props 也会让 memo 命中率下降。

建议：

1. 卡片接收 `onContextMenu(id, event)`，在卡片内部用稳定 callback 包装。
2. 或父层预先缓存 handler map，但更简单的是把 bookmark id 作为参数传给统一 handler。
3. 卡片 props 尽量收敛为 primitive 或稳定对象。

## 推荐实施路线

### 阶段 1：止血，减少无关重渲染

目标：不大改数据结构，先让交互不卡。

改动：

1. `BookmarkCard` / `BookmarkListItem` 改为 `React.memo`。
2. 去掉卡片中的裸 `useBookmarkStore()`，改成细粒度 selector。
3. `BookmarkContent` 统一构建 `selectedSet`，把 `isSelected` 传给卡片。
4. 卡片 action 通过 selector 分开订阅，或由父层传稳定函数。
5. 图片加 lazy/async decoding。
6. 移除或收窄 `transition-all`。

验收：

- 勾选单个卡片时，React Profiler 中不应重渲染所有已展示卡片。
- AI 归档进度或截图进度变化时，MainPage 卡片不应全量 render。

风险：

- 中低。主要是 props 变化和 action 传递方式变化，需要补 BookmarkCard 交互测试。

### 阶段 2：缓存过滤排序和路径派生

目标：让筛选排序只在相关输入变化时发生。

改动：

1. 新增 selector/派生层：
   - `selectFilteredBookmarkIds`
   - `selectDisplayedBookmarkIds`
   - `selectTagPathById`
   - `selectCategoryPathById`
2. 将 `getFilteredBookmarks()` 的结果缓存起来，避免 render 中无条件重算。
3. 分类排序时用 `categoryPathById`，避免 sort comparator 内重复 `getCategoryPath()`。
4. search 中提前构建 tag path cache，避免每个 bookmark 都重复 resolve tag path。

验收：

- 切换选中状态不会触发 `getFilteredBookmarks()`。
- 只有搜索、筛选、排序、bookmarks/tags/categories 更新才触发 filtered ids 重算。

风险：

- 中。要注意过滤结果和 category/tag 变更后的缓存失效。

### 阶段 3：更新路径批处理与 normalized store

目标：单个书签更新只影响单卡，批量更新只触发批次级 UI 刷新。

改动：

1. store 引入 normalized 结构：
   - `bookmarkIds`
   - `bookmarkById`
2. 新增批量更新 action：
   - `updateBookmarksBatch(updates)`
   - `applyBookmarkPatch(id, updates)`
3. `screenshotSlice` 批量截图回调先收集更新，按批次 flush 到 store 和 storage。
4. storage 层继续兼容整数组存储，但 UI 层不要对每个 bookmark 调一次 `set({ bookmarks })`。

验收：

- 批量截图 50 个书签时，不应出现 50 次全列表过滤排序和 50 次整页卡片刷新。
- 单个截图刷新只重渲染目标卡片和必要的统计区域。

风险：

- 中高。会触及 store 主数据结构，实施前必须对 `updateBookmark`、`batchCaptureThumbnails`、`aiArchiveBookmark`、筛选页、分类页、标签页做 GitNexus impact analysis。

### 阶段 4：虚拟列表

目标：解决展示数量继续增长后的 DOM 和图片成本。

改动：

1. 网格视图引入虚拟化方案，例如 `@tanstack/react-virtual`。
2. 列表视图虚拟化相对简单，可先落地 list view。
3. grid view 需要处理响应式列数、估算高度和动态高度。建议先让卡片高度更稳定，再做虚拟 grid。
4. 保留现有 `displayedCount` 作为低风险 fallback。

验收：

- 5000 条书签滚动时 DOM 节点数量保持在可控范围。
- 滚动过程中无明显长任务，图片不会集中解码。

风险：

- 中。grid 虚拟化和动态内容高度容易产生滚动跳动，需要浏览器端截图与交互验证。

## 建议的目标指标

本优化应以真实数据量压测为准，建议准备 1000、3000、5000 条书签三档数据。

关键指标：

- 首次进入 MainPage 到可交互：1000 条低于 500ms，5000 条低于 1500ms。
- 单选/取消单选：提交耗时低于 16ms 到 32ms。
- 单个书签更新：只重渲染目标卡片，提交耗时低于 50ms。
- 批量截图每个结果回写：不触发整页卡片重渲染。
- 滚动加载后 DOM 节点数量：虚拟化前有上限策略，虚拟化后保持近似常量。

## 验证方式

1. React DevTools Profiler：
   - 记录单选卡片。
   - 记录右键菜单打开。
   - 记录更新单张截图。
   - 记录搜索输入。
2. Chrome Performance：
   - 检查 long task。
   - 检查 image decode。
   - 检查 layout / style recalculation。
3. 临时 instrumentation：
   - 在 `getFilteredBookmarks()` 加计数和耗时日志。
   - 在 `BookmarkCard` render 中用开发环境计数确认 memo 命中。
4. 自动化 smoke：
   - 加载 1000+ mock bookmarks。
   - 勾选第一张卡片。
   - 切换排序。
   - 执行一次单卡截图更新。
   - 断言页面仍可响应。

## 需要优先避免的误区

1. 只调小 `pageSize`。
   - 这只能减少 DOM 首屏数量，不能解决全量过滤排序和全量订阅。
2. 只加 `React.memo`。
   - 如果卡片仍订阅整个 store，memo 效果会很差。
3. 只做虚拟列表。
   - 虚拟列表能减少 DOM，但过滤排序和更新路径仍会卡。
4. 在 comparator 里继续算路径。
   - 分类排序会放大 `getCategoryPath()` 的成本。
5. 批量任务逐条 `updateBookmark`。
   - 这是更新路径最容易造成整页抖动的来源。

## 推荐优先级

| 优先级 | 项目 | 预期收益 | 风险 |
| --- | --- | --- | --- |
| P0 | 卡片去全局 store 订阅 + `React.memo` | 高 | 中低 |
| P0 | 缓存过滤排序结果，避免 render 期重算 | 高 | 中 |
| P0 | 批量更新合并 store set | 高 | 中 |
| P1 | 标签/分类路径缓存 | 中高 | 低 |
| P1 | 图片 lazy/async + 收窄 transition | 中 | 低 |
| P2 | 虚拟列表/虚拟网格 | 高，但依赖前置清理 | 中 |

## 建议下一步

建议先实施阶段 1 和阶段 2。它们不要求立刻迁移存储模型，但能直接降低主页面交互卡顿。阶段 3 涉及 store 数据结构和更新语义，实施前需要按项目规则对 `updateBookmark`、`BookmarkCard`、`BookmarkContent`、`getFilteredBookmarks`、`batchCaptureThumbnails` 分别做 GitNexus impact analysis，再分小步提交。
