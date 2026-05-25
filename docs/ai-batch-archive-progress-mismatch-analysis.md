# AI 批量自动归档显示错位问题分析

## 结论

当前问题不是单纯的卡片排序问题，而是批量归档进度状态和实际处理指针没有严格同步。

最核心的 bug 在 `src/store/slices/aiArchiveSlice.ts` 的 `processArchiveQueue()`：

1. 进度刷新函数 `flushProgress()` 被 1 秒节流。
2. 每轮循环开始时把 `processingBookmarkId` 设置为当前书签。
3. 遇到“已有 AI 信息、可直接跳过”的书签时，会 `continue`，没有强制刷新这条书签的完成/跳过状态。
4. 下一条书签开始时，如果距离上次刷新不足 1 秒，`flushProgress()` 会直接返回。
5. 结果是 UI 仍然显示上一条书签正在处理，但实际 `aiArchiveBookmark()` 已经开始处理下一条书签，并可能正在给下一条书签截图。

这可以解释用户看到的现象：页面上“正在标记”的卡片和浏览器里正在截图的网站不是同一个。

## 关键证据

### 1. 队列处理在循环开始就声明当前处理项

位置：`src/store/slices/aiArchiveSlice.ts`

```ts
currentIndex = i + 1;
...
flushProgress(bookmark);
...
const updates = await get().aiArchiveBookmark(bookmark.id, cachedContext);
```

`flushProgress(bookmark)` 会写入：

```ts
currentBookmark: bookmark.title,
processingBookmarkId: bookmark.id,
current: currentIndex,
```

也就是说 UI 的“正在处理卡片”完全依赖这次进度刷新。

### 2. 进度刷新被全局节流

位置：`src/store/slices/aiArchiveSlice.ts`

```ts
const PROGRESS_THROTTLE_MS = 1000;

const flushProgress = (bookmark: any, force = false) => {
  const now = Date.now();
  if (!force && now - lastProgressFlush < PROGRESS_THROTTLE_MS) return;
  ...
};
```

这个节流把两类状态混在一起限制了：

- ETA、速度、计数这类可以节流的展示数据。
- `processingBookmarkId`、`currentBookmark` 这类必须和实际调用严格一致的指针数据。

第二类数据不应该被节流。

### 3. 跳过分支没有完成态刷新

位置：`src/store/slices/aiArchiveSlice.ts`

```ts
if (bookmark.aiGenerated && bookmark.categoryId && bookmark.tagIds?.length > 0) {
  pendingUpdates.set(bookmark.id, markBookmarkArchivedPatch());
  skippedCount++;
  skippedIds.push(bookmark.id);
  processedIds.push(bookmark.id);
  await flushPendingUpdates();
  continue;
}
```

这里直接 `continue`，跳过了循环末尾的：

```ts
flushProgress(bookmark);
```

如果上一条或当前这条刚刷新过，下一条开始时也可能被 1 秒节流挡住。于是 `processingBookmarkId` 停留在被跳过的书签上，但实际流程已经进入下一条。

### 4. 截图调用确实使用下一条书签

位置：`src/utils/bookmarkAiEnrich.ts`

```ts
const [bookmarkWithThumbnail, analysis] = await Promise.all([
  ensureBookmarkThumbnail(bookmarkForAnalysis).catch(...),
  ...
]);
```

`ensureBookmarkThumbnail()` 会调用：

```ts
const { dataUrl, seoData } = await screenshotService.captureOne(bookmark);
```

位置：`src/services/screenshotService.ts`

```ts
return this.captureUrl(bookmark.url, options);
```

所以实际截图 URL 来自当前 `aiArchiveBookmark(bookmark.id)` 加载到的书签。错位更像是 UI 指针滞后，而不是截图服务主动拿错了 URL。

## 最小复现场景

假设队列是：

1. A：已有 `aiGenerated`、`categoryId`、`tagIds`，会被跳过。
2. B：没有截图，需要打开网页截图。

执行过程：

1. 循环进入 A，`flushProgress(A)` 成功，UI 显示 A 正在处理。
2. A 命中“已有 AI 信息”分支，写入 skipped，直接 `continue`。
3. 循环进入 B，调用 `flushProgress(B)`，但因为距离上次刷新小于 1 秒，被节流返回。
4. 代码继续执行 `aiArchiveBookmark(B)`。
5. `ensureBookmarkThumbnail(B)` 打开 B 的网站截图。
6. UI 仍显示 A 正在处理，实际截图窗口是 B。

这就是“正在标记的卡片”和“正在截图的网站”不一致的直接原因。

## 其他放大问题

### `current` 的含义不清

`currentIndex = i + 1` 在每轮开始设置，UI 用它显示 `current / total`。这表示“当前处理到第几条”，不是“已完成几条”。

因此在某条书签还没处理完时，进度条已经前进到这一条。剩余数也会提前减一：

```tsx
aiArchiveProgress.total - aiArchiveProgress.current
```

这会加重“显示已经走到下一步，但实际还在处理”的感知混乱。

### 截图和 AI 分析并行，UI 没有单独的截图状态

`enrichBookmarkWithAI()` 中截图和 AI 分析是 `Promise.all` 并行执行的。当前 UI 只有一个 `processingBookmarkId`，没有 `capturingBookmarkId`、`analyzingBookmarkId` 或 `phaseDetail`。

所以用户看到浏览器窗口正在截图时，页面只能笼统显示“AI 归档中”。一旦 `processingBookmarkId` 滞后，就会显得实际调用和显示完全脱节。

### 批量归档和批量截图共用 `aiArchiveProgress`

位置：`src/store/slices/screenshotSlice.ts`

批量截图也写入 `aiArchiveProgress`：

```ts
set({
  aiArchiveProgress: {
    ...state.aiArchiveProgress!,
    isActive: true,
    ...
  }
});
```

如果批量截图和批量 AI 归档流程重叠，两个流程会互相覆盖同一个进度对象。即使正常用户路径不并发执行，这个设计也会让“归档进度”和“截图进度”的语义混在一起。

## 风险判断

风险等级：中高。

原因：

- 实际处理队列是串行的，当前证据更支持“UI 显示滞后/错位”，不是必然把 B 的截图保存到 A。
- 但进度状态与截图状态共用、批量写入和单条写入重复存在，后续如果引入并发或用户同时触发批量截图，就可能演变成真实数据写错。

## 建议修复方向

### P0：处理指针不节流

把 `processingBookmarkId`、`currentBookmark`、`currentIndex` 这类指针状态从节流里拆出来。

每次进入新书签时必须立即写入：

```ts
setProcessingBookmark(bookmark, i);
```

节流只用于 ETA、速度、统计数字等非关键展示。

### P0：所有提前 `continue` 分支都必须先刷新完成态

跳过、不可达、失败等分支在 `continue` 前必须强制刷新：

```ts
flushProgress(bookmark, true);
```

或者更明确地拆成：

```ts
markBookmarkSkipped(bookmark.id);
clearProcessingBookmark();
```

### P1：拆分“当前处理项”和“已完成数量”

建议字段语义改为：

- `processingBookmarkId`：当前正在执行的书签。
- `processingIndex`：当前执行项的队列位置。
- `completedCount`：已完成、失败、跳过的数量。
- `total`：本批次总数。

进度条应使用 `completedCount / total`，而不是当前循环的一基索引。

### P1：增加截图子阶段状态

在 `ensureBookmarkThumbnail()` 前后设置：

- `capturingBookmarkId`
- `capturingUrl`
- `phaseDetail: 'checking' | 'capturing' | 'analyzing' | 'saving'`

这样 UI 可以显示“正在截图：B”，而不是只显示“正在 AI 归档：A”。

### P2：归档进度和截图进度分开

`screenshotSlice` 不应复用 `aiArchiveProgress`。建议新增：

- `batchScreenshotProgress`
- `batchArchiveProgress`

两类流程互不覆盖。

## 建议补充测试

1. `processArchiveQueue` 单元测试：队列 `[alreadyAnalyzed, needsCapture]` 时，第二项开始前必须同步更新 `processingBookmarkId`。
2. 跳过分支测试：命中 skip 后 `skippedIds` 立即包含该 id，且不会继续显示为 `processing`。
3. UI 测试：当 `processingBookmarkId = B` 时，只有 B 卡片显示处理中，A 显示 skipped/success。
4. 回归测试：批量截图不应写入或覆盖 `aiArchiveProgress`。

## 总结

根因是批量队列的“真实执行指针”和 UI 进度状态不是强一致更新：关键指针被节流，提前跳过分支又没有完成态刷新。修复时应优先保证处理指针每条书签立即同步，其次再拆分已完成数量、截图子阶段和截图进度对象。
