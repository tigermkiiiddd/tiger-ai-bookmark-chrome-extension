# TIGERMARKIII MCP 方案可行性研究报告

**文档版本**：1.0  
**日期**：2026-05-21  
**评估对象**：文档第 3.9 节「外部 Agent 与 MCP（书签域窄能力）」及第 4 节技术路径  

---

## 1. 执行摘要

**结论：技术上可行，已有成熟先例，核心体验诉求均可满足。**

文档中规划的「Chrome 扩展 + Native Messaging + 本机 MCP Host」架构，与 2025–2026 年主流 MCP Chrome 扩展（`mcp-chrome`、`chrome-mcp-server`、Claude Code `--chrome`）采用完全相同的工程模式。由于 TIGERMARKIII 的能力边界限定在「书签域数据操作」（而非通用网页自动化），实现难度显著低于现有通用浏览器 MCP 方案。

唯一需要注意的门槛：**Native Host 的首次安装**需要用户配合一次本机设置，但安装后日常使用时随 Chrome 自动就绪，符合 REQ-02「我只管开 Chrome」的体验目标。

---

## 2. 顶层要求逐项评估

### REQ-01：深度整理——从「一次猜完」到「像人一样看全局」

| 评估项 | 结论 |
|--------|------|
| 是否满足 | ✅ 满足 |
| 关键论据 | MCP 协议天然支持「先读取全景 → 再规划 → 再执行」的多步交互模式。外部 Agent 可调用 `list_bookmarks`、`list_categories`、`list_tags` 等工具获取全局数据，基于完整上下文生成合并/归类建议，而非单条书签的孤立决策。 |
| 与现有方案对比 | 内置 AI 受限于 popup/options 页面的单次调用上下文，难以在一次请求中读取全部书签再做规划；MCP 让 Agent 可以分多步读取、思考、再行动。 |
| 风险点 | Agent 的「全局规划质量」取决于 prompt 设计和模型能力，这是产品层问题而非技术可行性问题。 |

### REQ-02：启动与日常负担——「我只管开 Chrome」

| 评估项 | 结论 |
|--------|------|
| 是否满足 | ⚠️ 基本满足，有首次安装门槛 |
| 关键论据 | Chrome Native Messaging 的设计语义即「由 Chrome 按需自动拉起本机进程」，宿主不需要用户手动启动。安装后日常使用完全符合「随 Chrome 使用即就绪」的体验。 |
| 门槛说明 | 用户需要**首次安装**一个 Native Host manifest + 宿主二进制（或 Node.js 脚本）。Claude Code `--chrome`、Cursor 等工具的用户已经熟悉这个流程，但对普通扩展用户可能是一道门槛。 |
| 缓解方案 | 1) 提供一键安装脚本；2) 在扩展设置中引导安装；3) 2026 下半年关注 WebMCP 进展（浏览器原生支持 MCP，无需 Native Host）。 |

### REQ-03：双路径清晰——「快整理」和「稳整理」各干各的

| 评估项 | 结论 |
|--------|------|
| 是否满足 | ✅ 满足 |
| 关键论据 | 两条路径的技术边界天然清晰：内置 AI 走扩展内部调用（`popup.tsx` / `OptionsApp.tsx` → `store` → `AIService.analyzeContent`）；外部 Agent 走 MCP Tool Call（`Cursor/Claude` → `MCP Host` → `Native Messaging` → `扩展`）。两者互不干扰，只在数据层（IndexedDB）交汇。 |
| 产品层要求 | 需要在 UI 中用 30 秒可理解的文案说明「什么时候用内置、什么时候用助手」，这是产品文案工作而非技术障碍。 |

### REQ-04：可控与可恢复——「敢让助手大改」

| 评估项 | 结论 |
|--------|------|
| 是否满足 | ✅ 满足 |
| 关键论据 | MCP 的 Tool Schema 由产品定义，可以强制设计为「草案 → 确认 → 执行」三阶段：1) `propose_changes` 返回变更草案（不写入数据库）；2) 用户在扩展 UI 中审阅；3) 用户确认后调用 `apply_changes` 真正落库。 |
| 回滚能力 | 需在扩展侧实现快照/事务机制（如批量操作前保存 bookmarks 数组的快照到 `chrome.storage.local` 或 IndexedDB 的单独 store）。技术上完全可行。 |
| 参考实现 | `gitnexus` 等工具已经使用类似的「impact analysis → user confirm → apply」模式。 |

### REQ-05：并发与冲突——「不会两个整理源互相踩脚」

| 评估项 | 结论 |
|--------|------|
| 是否满足 | ⚠️ 可满足，需自行实现 |
| 关键论据 | MCP 协议本身不提供并发控制，Chrome Native Messaging 也不处理业务层冲突。需要在扩展侧实现队列/互斥/锁机制。 |
| 可行方案 | 1) **互斥锁**：在 IndexedDB 中维护一个 `processing` 标志，内置整理和 MCP 操作开始前检查并获取锁；2) **队列**：所有整理操作进入队列串行执行；3) **乐观并发**：记录最后修改时间戳，冲突时提示用户选择保留哪个版本。 |
| 复杂度 | 中等，是工程实现问题而非技术不可行。 |

### REQ-06：能力边界——用户心智里「这就是书签管家」

| 评估项 | 结论 |
|--------|------|
 是否满足 | ✅ 天然满足 |
| 关键论据 | MCP Tool Schema 完全由产品定义。TIGERMARKIII 只暴露书签域工具（`list_bookmarks`、`propose_category_merge`、`apply_tag_changes` 等），不暴露 `execute_javascript`、`navigate_to_url`、`fill_form` 等通用浏览器控制工具。Agent 能做什么完全取决于你注册了什么 tools。 |
| 与通用 MCP Chrome 扩展的区别 | `mcp-chrome`、`chrome-mcp-server` 等通用方案暴露 18+ 个浏览器自动化工具（截图、点击、导航、DOM 操作），容易被误解为「远程控制浏览器」；TIGERMARKIII 的「书签窄域」定位天然避开了这个模糊地带。 |

### REQ-07：助手侧体验——「在我习惯用的工具里就能下令」

| 评估项 | 结论 |
|--------|------|
| 是否满足 | ✅ 满足，这是 MCP 的核心价值 |
| 关键论据 | Cursor、Claude Code、Claude Desktop、Continue 等主流桌面 AI 工具均已原生支持 MCP。用户在这些工具中安装 TIGERMARKIII 的 MCP Server 后，可以直接用自然语言下达指令（如「帮我合并过碎的分类」），Agent 会调用对应的 MCP tools 执行实际操作。 |
| 与「生成建议文本」的区别 | MCP tools 返回的结果可以被 Agent 继续用于下一步操作（如读取分类树 → 发现过细分类 → 提议合并 → 执行合并），形成真正的闭环；而不是只生成一段文本让用户手动复制。 |

### REQ-08：隐私与信任——「我的书留在我的地盘」

| 评估项 | 结论 |
|--------|------|
| 是否满足 | ✅ 满足 |
| 关键论据 | 1) MCP Host 跑在用户本机，数据流在 `Cursor/Claude` ↔ `本机进程` ↔ `Chrome 扩展` 之间，**不经过第三方云端**；2) IndexedDB 中的书签数据始终保存在用户本地；3) MCP 的读写权限通过 Tool Schema 精确控制，Agent 只能访问你暴露的接口。 |
| 需产品层补充 | 首次启用 MCP 时，需在 UI 中清晰告知用户「谁会看到什么、关掉什么就停什么」，符合文档中「说人话、一次说清」的要求。 |

### REQ-09：归档批量缩略图——「自动跑完，但我看得见」

| 评估项 | 结论 |
|--------|------|
| 是否满足 | ✅ 满足（MCP 方案不影响此功能） |
| 关键论据 | 批量缩略图是扩展内部功能（`chrome.tabs` 激活 + `captureVisibleTab`），与 MCP 架构无关。MCP 方案的引入不会干扰现有截图流程。 |

---

## 3. 技术架构验证

### 3.1 已验证的生产级先例

| 项目 | 架构 | 与 TIGERMARKIII 的相似度 |
|------|------|-------------------------|
| **Claude Code `--chrome`** | Extension + Native Messaging + MCP Host | 架构完全相同，但能力域是通用浏览器控制 |
| **`mcp-chrome` (hangwin)** | Extension + Native Host + TCP bridge + MCP Server | 架构相同，社区多 fork 活跃维护 |
| **`chrome-mcp-server`** | Extension + Native Messaging + 18 tools | 架构相同，工具粒度更细 |
| **MCP SuperAssistant** | 纯 Extension，集成到 ChatGPT/Perplexity 等 Web UI | 能力集成方式不同，但说明 MCP 在浏览器生态已被广泛接受 |

### 3.2 TIGERMARKIII 的简化优势

现有通用浏览器 MCP 方案需要处理的高复杂度问题，TIGERMARKIII **不需要面对**：

| 通用方案的高复杂度问题 | TIGERMARKIII 是否需要面对 |
|---------------------|-------------------------|
| CDP (Chrome DevTools Protocol) 集成 | ❌ 不需要，书签域全是数据操作 |
| DOM 坐标映射与元素引用 (`ref_1`, `ref_2`) | ❌ 不需要 |
| 截图与 Retina 设备像素比处理 | ❌ 不需要（缩略图走扩展内部流程） |
| 网页导航与表单填充的状态机 | ❌ 不需要 |
| 内容脚本注入与跨域安全 | ❌ 不需要 |
| 只需要 | IndexedDB 读写 + 简单的数据结构操作 |

**结论：TIGERMARKIII 的 MCP 实现难度显著低于通用浏览器 MCP，约等于「一个本地 JSON API 服务」的复杂度。**

---

## 4. 风险与缓解

| 风险 | 等级 | 说明 | 缓解方案 |
|------|------|------|---------|
| Native Host 首次安装门槛 | 中 | 用户需要运行一次安装脚本或手动放置 manifest | 1) 提供 npm 全局安装包；2) 扩展内检测未安装时引导用户；3) 长期关注 WebMCP |
| MV3 Service Worker 休眠导致连接断开 | 中 | Chrome 30 秒无活动终止 SW，Native Messaging 连接随之断开 | 1) 实现指数退避重连（现有标准做法）；2) 使用 Offscreen Document keepalive；3) MCP Host 侧缓存请求，连接恢复后重发 |
| Agent 规划质量不可控 | 中 | 模型可能提出不合理的分类合并建议 | 1) 强制的「草案 → 确认」流程；2) 用户可配置的偏好规则（F-86）；3) 撤销机制 |
| 双路径并发冲突 | 低 | 内置整理和 MCP 同时修改数据 | 在扩展侧实现互斥锁或队列（见 REQ-05 评估） |
| 2026 WebMCP 可能改变架构 | 低 | 若浏览器原生支持 MCP，Native Host 层可能不再需要 | 设计时保持 Host 层薄且可替换，预留迁移路径 |

---

## 5. 实施建议

### 5.1 最小可行原型（MVP）

建议先验证核心链路，再逐步扩展能力：

**Phase 1：只读链路验证（1–2 天）**
1. 实现一个最小 MCP Host（Node.js，stdio transport）
2. 注册 2 个 tool：`list_bookmarks`、`list_categories`
3. 在 Cursor/Claude Code 中安装并验证能读取到数据
4. 验证 Native Messaging 连接稳定性

**Phase 2：草案-确认-提交链路（3–5 天）**
1. 增加 `propose_changes` tool（返回 JSON 草案，不写入数据库）
2. 在扩展 Options 页面增加「外部助手建议」审阅面板
3. 增加 `apply_changes` tool（只在用户确认后落库）
4. 实现简单的快照回滚（保存操作前的 bookmarks 数组）

**Phase 3：完整能力（1–2 周）**
1. 补齐 F-82 到 F-89 的所有工具
2. 实现并发控制（互斥锁）
3. 优化 Agent prompt，提升整理质量
4. 用户偏好配置（F-86）

### 5.2 技术栈建议

| 组件 | 建议技术 |
|------|---------|
| MCP Host | Node.js + `@modelcontextprotocol/sdk`（Anthropic 官方 SDK） |
| Transport | stdio（与 AI 工具兼容性最好） |
| Native Host 到 Extension | Chrome Native Messaging（binary-framed JSON） |
| Extension 侧 | 复用现有 Service Worker + IndexedDB 存储层 |
| 扩展与 Host 通信格式 | 与现有 store action 对齐的 JSON 结构，避免引入第二套领域模型 |

### 5.3 与现有代码的集成点

MCP 不需要重构现有代码，只需在现有架构上增加一层「外部调用入口」：

```
┌─────────────────────────────────────────┐
│  现有代码（无需改动）                      │
│  - store/index.ts（所有数据操作）          │
│  - core/storage/*（IndexedDB 读写）       │
│  - services/ai.ts（AI 分析）              │
└─────────────────────────────────────────┘
                    ▲
                    │ 调用
┌───────────────────┼─────────────────────┐
│ 新增：MCP 适配层   │                     │
│  - background.ts   │  增加 message       │
│    路由（Native    │  handler            │
│    Messaging →      │                     │
│    store action）  │                     │
└───────────────────┴─────────────────────┘
                    ▲
                    │ Native Messaging
┌───────────────────┴─────────────────────┐
│ 新增：MCP Host（Node.js）                 │
│  - MCP Server（stdio transport）          │
│  - Tool 定义（调用扩展的只读/写操作）       │
└─────────────────────────────────────────┘
```

---

## 6. 结论

| 维度 | 评估 |
|------|------|
| **技术可行性** | ✅ 完全可以实现，已有多个生产级先例验证 |
| **满足顶层要求** | ✅ 9 条 REQ 中 7 条直接满足，2 条（REQ-02 首次安装门槛、REQ-05 并发控制）需额外工程但技术路径清晰 |
| **实现难度** | **中等偏低** — 远低于通用浏览器 MCP（不需要 CDP/DOM/截图坐标映射），约等于「本地 API + 审阅 UI」的复杂度 |
| **推荐行动** | 建议实施。先做一个 Phase 1 MVP 验证 Cursor 能读到书签数据，再决定是否投入完整实现 |

---

## 7. 参考来源

- [Chrome DevTools MCP: Debug Browser With AI Agents (2026)](https://byteiota.com/chrome-devtools-mcp-debug-browser-with-ai-agents-2026/)
- [GitHub - hangwin/mcp-chrome](https://github.com/hangwin/mcp-chrome)
- [Native Message Protocol Efficiency | hangwin/mcp-chrome](https://zread.ai/hangwin/mcp-chrome/32-native-message-protocol-efficiency)
- [Architecture overview - MCP](https://modelcontextprotocol.io/docs/learn/architecture)
- [The Ultimate Guide to Chrome MCP Servers for AI Engineers](https://skywork.ai/skypage/en/The-Ultimate-Guide-to-Chrome-MCP-Servers-for-AI-Engineers/1972823669484482560)
- [Claude Code MCP Browser Extension Issues](https://github.com/anthropics/claude-code/issues/48804)
- [GitHub - syedazharmbnr1/chrome-mcp-server](https://github.com/syedazharmbnr1/chrome-mcp-server)
- [MCP SuperAssistant Chrome Extension](https://lobehub.com/en/mcp/srbhptl39-mcp-superassistant)
