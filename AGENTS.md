对话用中文。

## Project Notes

- 这是 Chrome 扩展/插件项目，不是普通 Web 站点项目。
- 不要把 `options/index.html`、`popup/index.html` 或 Vite dev server 当作最终运行环境来直接浏览器预览验收；这类页面依赖 Chrome Extension API、扩展路由和 manifest 环境，普通浏览器直开可能空白、状态不完整或行为失真。
- UI 验证应优先使用 `npm run build` 产物，通过 Chrome 扩展加载 `dist/` 后在扩展环境中检查；必要时再用扩展页面 URL、Chrome 插件调试页面或针对扩展上下文的自动化方式验证。
- 如果只是做 TypeScript/构建层验证，使用 `npm run type-check` 和 `npm run build`，不要默认启动 dev server 作为预览依据。

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **chrome-exten** (5306 symbols, 10233 relationships, 283 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/chrome-exten/context` | Codebase overview, check index freshness |
| `gitnexus://repo/chrome-exten/clusters` | All functional areas |
| `gitnexus://repo/chrome-exten/processes` | All execution flows |
| `gitnexus://repo/chrome-exten/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
