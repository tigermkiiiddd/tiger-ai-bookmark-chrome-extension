# Sidebar 与联动筛选 UX 规格：从侧边栏到 Facet Explorer

版本：0.1  
日期：2026-05-23  
状态：具体交互规格  
适用范围：书签库 Library Space 的左侧筛选/导航系统

---

## 0. 结论

当前 Sidebar 不应该继续被理解为“全局侧边栏”。  
它应该被重新定义为：

> Library Space 的 Facet Explorer：用搜索、分类树、标签树、状态维度共同描述“当前我想看的书签范围”。

Sidebar 的核心职责不是导航，也不是管理分类/标签，而是帮助用户构造一个可理解、可调整、可保存的 Scope。

公式：

```text
Scope = Query ∧ CategoryFacet ∧ TagFacet ∧ StatusFacet ∧ ViewMode
```

其中：

- `Query` 是用户输入的文本意图。
- `CategoryFacet` 是“位置/归属”维度。
- `TagFacet` 是“语义/特征”维度。
- `StatusFacet` 是“健康/处理状态”维度。
- `ViewMode` 只是结果呈现方式，不改变 Scope。

---

## 1. Sidebar 应不应该在所有模式和功能中负责过滤

不应该。

Sidebar 只应该在“用户正在浏览一组书签”时负责过滤。  
当用户进入整理、检测、同步、设置等流程时，Sidebar 的职责应该切换，甚至可以消失。

### 1.1 Sidebar 的三种形态

| 当前空间 | Sidebar 形态 | 是否负责过滤 | 原因 |
|---|---|---|---|
| Library / 书签库 | Facet Explorer | 是 | 用户正在定义“看哪些书签” |
| Studio / 整理工作台 | Operation Navigator | 否，最多显示范围摘要 | 用户正在执行流程，不是在浏览 |
| Console / 维护控制台 | Issue Navigator | 部分负责问题类型过滤 | 用户在处理诊断结果 |
| Settings | 无 Sidebar 或设置目录 | 否 | 设置不是书签集合 |
| Popup | 无 Sidebar | 否 | Popup 是当前页捕获 |

### 1.2 错误范式

```text
全局永远显示同一个 Sidebar
→ 分类、标签、状态一直在左边
→ 用户进入 AI 归档/标签治理/同步时仍看到书签筛选
```

这会让用户混淆：

- 当前筛选会不会影响这个操作？
- 我在整理全库，还是整理左边筛出来的范围？
- 左边点了标签会不会改变 AI 工作台？

### 1.3 正确范式

Sidebar 是上下文敏感的。

```text
Library：左边是 Facet Explorer
Studio：左边是任务导航 + 当前 Scope 摘要
Console：左边是问题类型和严重程度
Settings：左边是设置章节，或无侧栏
```

---

## 2. Library Sidebar 的真正意义

Library Sidebar 不是页面导航，而是 Scope 构造器。

用户不是在“打开分类页”或“打开标签页”。  
用户是在说：

> 我想看满足这些条件的一组书签。

因此，分类和标签都不应该是独立页面心智。它们是 Facet。

### 2.1 Category 和 Tag 的语义差异

| 维度 | Category | Tag |
---|---|---|
| 语义 | 主要归属、文件夹感 | 多维特征、主题感 |
| 选择数量 | 通常 0-1 个主范围，可支持多选 | 经常多选 |
| 树结构 | 强层级，父节点包含子节点 | 弱层级，但也需要折叠和继承 |
| 结果关系 | 选中父分类 = 包含子分类书签 | 选中父标签 = 默认包含子标签书签 |
| 管理入口 | Studio 的分类治理 | Studio 的标签治理 |
| Library 中职责 | 缩小位置范围 | 缩小语义范围 |

### 2.2 Sidebar 不应直接承担分类/标签管理

Library Sidebar 中可以允许轻量创建分类，但不应塞完整管理能力。

原因：

- Library 的任务是查找和浏览。
- 分类/标签重命名、移动、合并、删除属于结构治理。
- 把治理功能放进筛选树，会污染查找路径。

建议：

- Library Sidebar：只保留筛选、展开、折叠、快速新增。
- Studio：负责重命名、移动、合并、删除、AI 建议。

---

## 3. 目标布局：双 Facet 树 + 独立滚动

用户指出的“category 和 tag 应该分栏单独滚动”是对的。

分类和标签都是树，但它们代表不同维度。把它们上下堆叠会造成两个问题：

- 分类树很长时，标签入口被挤到下面。
- 标签很多时，用户看不到分类上下文。

### 3.1 推荐桌面布局

Library Space 左侧区域不再是 288px 单列，而应是 360-440px 的 Facet Explorer。

```text
┌────────────────────────────────────────────┐
│ Scope Bar                                  │
│ 搜索框 + 当前筛选 chips + 清除             │
├────────────────────────────────────────────┤
│ Status Strip                               │
│ 全部 / 未归档 / 已归档 / 失效 / 未检测      │
├───────────────────┬────────────────────────┤
│ Categories         │ Tags                   │
│ 独立滚动           │ 独立滚动                │
│ 分类树             │ 标签树                  │
│ counts             │ counts                  │
└───────────────────┴────────────────────────┘
```

### 3.2 独立滚动规则

`Scope Bar` 和 `Status Strip` 固定在 Sidebar 顶部。  
`Categories` 和 `Tags` 两列各自独立滚动。

```text
Sidebar
├─ sticky Scope Bar
├─ sticky Status Strip
└─ Facet Split
   ├─ Category Pane: overflow-y-auto
   └─ Tag Pane: overflow-y-auto
```

好处：

- 用户可以保持一个分类位置，同时浏览很多标签。
- 用户可以保持一个标签上下文，同时切换分类。
- 两棵树都能成为高频操作区域。

### 3.3 宽度和响应式

| 宽度 | 行为 |
---|---|
| >= 1280px | Sidebar 400px，分类/标签双列 |
| 1024-1279px | Sidebar 360px，双列但文字更紧凑 |
| 768-1023px | Sidebar 抽屉，分类/标签用顶部 segmented 切换 |
| < 768px | 底部 Filter Sheet，分类/标签分 tab |

不要在窄屏强行双列。

---

## 4. 搜索、分类、标签的联动

### 4.1 搜索不是一个独立页面

搜索应该是 Library Scope 的一部分，不应该跳到 `/search` 独立页面。

用户输入搜索时：

1. 书签结果实时收窄。
2. 分类树显示当前搜索结果在各分类下的分布。
3. 标签树显示当前搜索结果关联哪些标签。
4. 匹配到的分类/标签名称高亮。
5. 搜索词可被转成 tag/category chips。

### 4.2 Faceted Count 规则

分类和标签右侧的数量必须是联动计数，不是静态总数。

#### Category count

分类节点 count 应该表示：

```text
在当前 Query + TagFacet + StatusFacet 条件下，
落在该分类及其子分类中的书签数量。
```

也就是说，计算分类数量时排除当前 CategoryFacet，自身作为候选维度。

#### Tag count

标签节点 count 应该表示：

```text
在当前 Query + CategoryFacet + StatusFacet 条件下，
拥有该标签或其子标签的书签数量。
```

也就是说，计算标签数量时排除当前 TagFacet，自身作为候选维度。

### 4.3 为什么 count 要这样算

这叫 faceted search 的“预测计数”。  
它回答：

> 如果我再点这个分类/标签，会剩下多少结果？

如果 count 只是全局静态数量，用户无法判断下一步筛选是否有效。

### 4.4 组合逻辑

推荐默认逻辑：

```text
Query AND Status AND CategoryGroup AND TagGroup
```

组内逻辑：

```text
多个 Category：OR
多个 Tag：AND 或 OR 可切换，默认 AND
多个 Status：OR
```

解释：

- 多个分类默认 OR：用户通常是在看“这些位置里的书签”。
- 多个标签默认 AND：用户通常是在找“同时具备这些特征”的书签。
- 多个状态默认 OR：状态是集合筛选。

### 4.5 Tag OR/AND 切换

标签多选必须提供模式：

```text
标签匹配：全部满足 / 任一满足
```

默认：全部满足。

原因：

- `React` + `性能` 通常是交集查询。
- 但 `AI` 或 `LLM` 或 `Agent` 可能是并集探索。

这个开关只在已选标签 >= 2 时显示。

---

## 5. 搜索框的具体行为

### 5.1 一个搜索框，两种结果

Sidebar 顶部搜索框不是只搜书签，也不是只搜树节点。它同时驱动：

1. 书签结果 Query。
2. Facet suggestion。

输入 `react` 时：

```text
搜索：react

建议：
- 标签：技术/前端/React
- 分类：编程/前端
- 域名：react.dev

结果：
显示匹配 react 的书签
```

用户可以：

- 直接按 Enter：作为全文 Query。
- 点“标签：React”：添加 TagFacet chip，同时保留或清空 Query 由规则决定。
- 点“分类：前端”：添加 CategoryFacet chip。

### 5.2 Query 与 Facet 的关系

如果用户输入词和一个标签完全匹配，系统不应自动把 Query 变成 TagFacet。  
应该显示建议，让用户选择。

原因：

- 用户搜“react”可能想搜网页内容。
- 也可能想筛选 React 标签。
- 自动转换会让结果不可解释。

### 5.3 当前筛选 chips

Scope Bar 必须始终显示当前 Scope：

```text
搜索: "react" ×
分类: 技术/前端 ×
标签: 性能 ×
标签: TypeScript ×
状态: 未归档 ×
```

用户不应该需要看左侧树的 checkbox 才知道当前范围。

---

## 6. Category Tree 规格

### 6.1 分类树职责

分类树回答：

> 这些书签主要放在哪里？

### 6.2 节点结构

每个节点包含：

```text
chevron
icon
name
count
filter checkbox / selection marker
```

### 6.3 点击语义

分类树必须区分三种动作：

| 动作 | 结果 |
---|---|
| 点击 chevron | 展开/折叠 |
| 点击节点正文 | 设为主 Scope，类似进入该分类 Lens |
| 点击 checkbox | 加入/移除多选 CategoryFacet |
| 双击或右键 | 管理动作入口，但建议弱化 |

如果保留“点击节点正文展开”，会和筛选/进入语义冲突。  
建议改为：chevron 只负责展开，正文负责聚焦/筛选。

### 6.4 父节点选择语义

选中父分类时，默认包含所有子分类。

UI 要显示：

```text
技术 128
```

表示技术及其子分类当前可见书签数。

### 6.5 分类树过滤

当 Query 输入后：

- 匹配分类名的节点高亮。
- 匹配书签所在分类的祖先保持可见。
- 计数为 0 的节点变灰，可配置隐藏。
- 展开路径自动展开到匹配项。

---

## 7. Tag Tree 规格

### 7.1 标签必须是树

当前 `TagList` 只显示热门标签前 20 个，这是不够的。  
既然数据模型已有 `Tag.parentId` 和 `TagTreeNode`，Library Sidebar 中的标签也应该是树。

标签不是一串彩色胶囊，而是可折叠的语义结构。

### 7.2 标签树职责

标签树回答：

> 这些书签具有什么主题、技术、用途或特征？

### 7.3 标签树节点结构

```text
chevron
tag icon / color dot
name
count
checkbox
```

颜色不要用大面积彩色胶囊。  
在树里，标签颜色只作为小色点或细边，不应破坏层级扫描。

### 7.4 标签点击语义

| 动作 | 结果 |
---|---|
| 点击 chevron | 展开/折叠 |
| 点击标签名 | 添加/移除 TagFacet |
| 点击 checkbox | 同上，适合精确多选 |
| Shift 点击 | 仅选该标签，不保留其他标签 |
| Alt/Option 点击 | 排除该标签，作为 NOT filter，P1 再做 |

### 7.5 父标签选择语义

选中父标签时，默认包含子标签。

示例：

```text
AI
├─ LLM
├─ Agent
└─ Prompt
```

选择 `AI` 表示：

```text
tag in subtree(AI)
```

如果用户只想选父标签本身，应在详情或高级筛选中提供“仅此标签”。

默认包含子标签更符合用户心智。

### 7.6 标签树折叠策略

初始状态：

- 展开命中的活跃路径。
- 展开 top 3 高频根标签。
- 其他根标签折叠。

搜索时：

- 展开所有匹配标签的祖先。
- 匹配文本高亮。
- 无匹配子树隐藏或变灰，建议默认隐藏。

### 7.7 标签数量显示

标签 count 也要包含子标签：

```text
AI 84
  LLM 31
  Agent 18
```

其中 `AI 84` 表示 AI 子树命中数量，不只是直接贴在 AI 上的书签。

### 7.8 热门标签不消失，而是变成快捷区

可以在标签树上方保留“常用标签”一行，但不能替代树。

```text
常用：AI React Design 论文 ...
```

点击常用标签等价于在标签树中选中该标签，并滚动/定位到树节点。

---

## 8. Category 与 Tag 的联动示例

### 8.1 用户先选分类

用户选择：

```text
分类：技术/前端
```

结果：

- 主列表只显示前端分类及子分类下的书签。
- 标签树 count 变成“前端范围内各标签数量”。
- 高频标签可能变成 React、CSS、性能、工程化。
- 分类树仍显示全树，但当前分类路径高亮。

### 8.2 用户再选标签

用户继续选择：

```text
标签：性能
```

结果：

```text
Scope = 分类: 技术/前端 ∧ 标签: 性能
```

- 列表显示前端分类下带性能标签的书签。
- 分类树 count 变成“如果切换/增加分类，在性能标签条件下会有多少”。
- 标签树中性能保持选中，其他标签显示在当前分类下的交集/并集数量。

### 8.3 用户输入搜索

用户输入：

```text
react
```

结果：

```text
Scope = Query("react") ∧ 分类: 技术/前端 ∧ 标签: 性能
```

- 结果继续收窄。
- 分类树和标签树都基于这个 Query 重新计数。
- 如果 `React` 标签存在，搜索建议里显示“转为标签筛选”。

---

## 9. 视觉布局细节

### 9.1 Sidebar 结构

```text
Facet Explorer
├─ Scope Bar
│  ├─ Search Input
│  ├─ Suggestions Popover
│  └─ Active Chips
├─ Status Strip
│  ├─ All
│  ├─ Unarchived
│  ├─ Archived
│  ├─ Site dead
│  └─ Page dead
└─ Facet Columns
   ├─ Category Pane
   │  ├─ Header: 分类  count  add
   │  └─ Tree Scroll
   └─ Tag Pane
      ├─ Header: 标签  count  mode toggle
      ├─ Popular Tags
      └─ Tree Scroll
```

### 9.2 两列比例

默认：

```text
Category 48%
Tag 52%
```

原因：标签通常更多、名字更长。

### 9.3 行高

树节点建议 28px 或 30px。  
不要用大胶囊样式，否则树会变得不可扫描。

### 9.4 Count 样式

count 使用弱化小数字，靠右对齐。

```text
React                         42
```

不要使用过多 badge 颜色。颜色留给状态和风险。

---

## 10. 空状态与零结果

### 10.1 零结果时陈列当前条件即可

组合筛选导致为空时，系统无法判断”该移除哪一个”。任何条件都可能是罪魁祸首。

因此零结果状态只负责做两件事：

1. **明确告知当前范围为空**
2. **列出当前生效的所有条件**，让用户自己判断该松哪一道口子

示例：

```text
没有找到书签

当前范围：
搜索 “react”
分类 技术/前端
标签 性能 + TypeScript

[清除全部筛选]
```

### 10.2 Facet 中的零计数

默认变灰，不隐藏。  
提供一个小开关：

```text
隐藏 0 结果项
```

高级用户会需要看到”为什么没有”。

---

## 11. URL 与状态表达

当前 Scope 应该可以被 URL 表达，方便返回、分享、恢复状态。

建议：

```text
/library?q=react&cat=frontend&tag=performance,typescript&tagMode=and&status=unarchived&view=grid
```

内部状态也应围绕这个 Scope 对象：

```ts
type LibraryScope = {
  query: string;
  categoryIds: string[];
  tagIds: string[];
  tagMode: 'and' | 'or';
  status: StatusFilterValue[];
  includeCategoryDescendants: boolean;
  includeTagDescendants: boolean;
};
```

这比把搜索、activeFilters、currentView 分散在不同 store 字段更清楚。

---

## 12. 与现有实现的具体差距

### 12.1 当前实现

当前 Sidebar：

- 一个搜索框，只设置全局搜索。
- 状态筛选独立。
- 分类树在上方，标签列表在下方。
- 标签只显示热门前 20。
- 标签以 `tag.name` 过滤，而不是稳定 `tag.id`。
- 分类和标签没有真正的联动预测计数。
- 分类树可折叠，标签没有树。
- 分类点击、展开、筛选语义混杂。

### 12.2 目标实现

目标 Sidebar：

- 搜索、分类、标签、状态共同构造 `LibraryScope`。
- 分类和标签是并列 facet panes。
- 两棵树独立滚动。
- 标签改为可折叠树。
- counts 是基于其他 facet 的联动预测计数。
- active chips 总是可见。
- tag/category 使用 id 作为筛选值，展示时再转 path。
- 分类/标签管理动作迁移到 Studio。

---

## 13. 实现优先级

### P0：修正筛选模型

1. 定义 `LibraryScope`。
2. tag filter 从 `tag.name` 改为 `tag.id`。
3. category filter 明确为包含子分类。
4. tag filter 明确为包含子标签。
5. active chips 显示 path，而不是裸 id/name。

### P1：Sidebar 布局重构

1. Sidebar 改成 Facet Explorer。
2. Scope Bar 固定。
3. Category/Tag 双列。
4. 两列独立滚动。
5. 状态筛选压缩成横向 strip。

### P2：标签树

1. 复用 `tagService.getTagTree()` 或前端构建 tag tree。
2. 实现 `TagTreeNode`。
3. 支持展开/折叠。
4. 支持搜索自动展开匹配路径。
5. 保留常用标签快捷区。

### P3：联动计数

1. 实现 faceted count 计算。
2. 分类 count 排除当前 category filter。
3. 标签 count 排除当前 tag filter。
4. 支持隐藏 0 结果项。

### P4：URL 状态同步

1. Scope 写入 query string。
2. 返回/刷新恢复 Scope。
3. 分类/标签 Lens 不再需要独立路由。

---

## 14. 判断标准

这套 Sidebar 成功的标准不是“看起来更高级”，而是用户可以自然完成这些动作：

1. 搜一个词，看到结果和相关分类/标签同时变化。
2. 选一个分类，标签树立刻变成该分类范围内的标签分布。
3. 再选两个标签，结果范围清晰显示在 chips 中。
4. 分类树和标签树都能独立滚动，不互相挤压。
5. 用户能展开标签树，理解标签层级，而不是只能看热门标签。
6. 进入 AI 归档或同步时，用户不会误以为左侧书签筛选仍在全局生效。

---

## 15. 对顶层 UX 文档的修正

`ux-paradigm-redesign.md` 中对 Sidebar 的描述还不够具体。应补充：

- Library 的 Sidebar 是 Facet Explorer。
- Category 和 Tag 是两个并列 facet tree。
- Search、Category、Tag、Status 必须组成一个联动 Scope。
- Sidebar 不在所有空间承担过滤职责。
- 标签必须树化、可折叠，并与分类联动计数。

