import { AIChatService, type ChatMessage, type ToolCall } from '../../services/ai';
import { tagService } from '../../services/tagService';
import { tagStorage } from '../../core/storage/tagStorage';
import { bookmarkStorage } from '../../core/storage/bookmarks';
import { buildTagPathByIdMap } from '../../utils/tagPath';

const aiChatService = AIChatService.getInstance();

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: { toolCallId: string; name: string; result: string }[];
  reasoningContent?: string;
  timestamp: number;
}

export interface AgentAction {
  id: string;
  type: 'rename_tag' | 'merge_tags' | 'move_tag' | 'delete_tags';
  params: Record<string, unknown>;
  result: string;
  timestamp: number;
  status: 'executed' | 'confirmed' | 'rejected';
  undoData?: Record<string, unknown>;
}

export interface TagAgentState {
  agentMessages: AgentMessage[];
  isAgentProcessing: boolean;
  agentError: string | null;
  agentActionLog: AgentAction[];
}

export const tagAgentInitialState: TagAgentState = {
  agentMessages: [],
  isAgentProcessing: false,
  agentError: null,
  agentActionLog: [],
};

// ─── 工具 Schema（全部使用完整路径） ───

export const TAG_AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_tags',
      description: '列出标签及其使用统计。返回值用完整路径标识（如 "技术/前端/React"）。',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            enum: ['all', 'unused', 'used'],
            description: 'all=全部(默认), unused=仅子树总用量为0的标签, used=仅子树总用量>0的标签',
          },
          rootTag: {
            type: 'string',
            description: '从哪个标签完整路径开始展开子树，空字符串=从根节点。如 "技术/前端"',
          },
          maxDepth: {
            type: 'number',
            description: '最多返回几层标签，包含起始层本身。默认1=只显示根标签/指定rootTag本身；2=再显示一层子标签；0=不限制层级，全部展开',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_tag_details',
      description: '批量获取标签详情。参数必须用完整路径',
      parameters: {
        type: 'object',
        properties: {
          tagPaths: {
            type: 'array',
            items: { type: 'string' },
            description: '标签完整路径列表（如 ["技术/前端/React", "AI工具"]）',
          },
        },
        required: ['tagPaths'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'rename_tag',
      description: '重命名标签。tagPath 必须是完整路径',
      parameters: {
        type: 'object',
        properties: {
          tagPath: { type: 'string', description: '要重命名的标签完整路径（如 "技术/前端/React"）' },
          newName: { type: 'string', description: '新名称（仅叶子名称，如 "Vue3"）' }
        },
        required: ['tagPath', 'newName'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'merge_tags',
      description: '将多个源标签合并到一个目标标签。参数必须用完整路径',
      parameters: {
        type: 'object',
        properties: {
          sourcePaths: { type: 'array', items: { type: 'string' }, description: '源标签完整路径列表（如 ["技术/前端/React", "技术/前端/Vue"]）' },
          targetPath: { type: 'string', description: '目标标签完整路径（如 "技术/框架"）' },
        },
        required: ['sourcePaths', 'targetPath'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'move_tag',
      description: '批量移动标签到新的父级。参数必须用完整路径。parentPath 为空字符串=根级',
      parameters: {
        type: 'object',
        properties: {
          tagPaths: { type: 'array', items: { type: 'string' }, description: '要移动的标签完整路径列表（如 ["技术/前端/React", "技术/前端/Vue"]）' },
          parentPath: { type: 'string', description: '新的父标签完整路径，空字符串表示根级（如 "技术/框架"）' },
        },
        required: ['tagPaths', 'parentPath'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_tags',
      description: '批量删除标签及其所有子标签。参数必须用完整路径',
      parameters: {
        type: 'object',
        properties: {
          tagPaths: {
            type: 'array',
            items: { type: 'string' },
            description: '要删除的标签完整路径列表（如 ["技术/前端/React", "未使用标签"]）',
          },
        },
        required: ['tagPaths'],
      },
    },
  },
];

// ─── 统一路径解析 ───

/** 按完整路径解析标签：含 / → 逐层 walk，不含 / → 仅匹配根级 */
function resolveTagByPath(input: string, tags: any[]): any | undefined {
  const trimmed = input.trim();

  // 1. 路径解析："技术/前端/React" → 逐层 name+parentId walk
  if (trimmed.includes('/')) {
    const segments = trimmed.split('/').map(s => s.trim()).filter(Boolean);
    let parentId: string | undefined;
    let result: any;
    for (const seg of segments) {
      const match = tags.find((t: any) => t.name === seg && t.parentId === parentId);
      if (!match) return undefined;
      result = match;
      parentId = match.id;
    }
    return result;
  }

  // 2. 不含 / 时，仅匹配根级标签
  return tags.find((t: any) => t.name === trimmed && t.parentId === undefined);
}

// ─── 子树计数 ───

async function buildSubtreeCounts(): Promise<Map<string, number>> {
  const [bookmarks, allTags] = await Promise.all([
    bookmarkStorage.getBookmarks(),
    tagStorage.getAll(),
  ]);
  const selfCounts = new Map<string, number>();
  for (const tag of allTags) selfCounts.set(tag.id, 0);
  for (const b of bookmarks) {
    for (const tid of b.tagIds || []) {
      selfCounts.set(tid, (selfCounts.get(tid) || 0) + 1);
    }
  }
  const childMap = new Map<string, string[]>();
  for (const t of allTags) {
    if (t.parentId) {
      const arr = childMap.get(t.parentId) || [];
      arr.push(t.id);
      childMap.set(t.parentId, arr);
    }
  }
  const result = new Map<string, number>();
  function accumulate(id: string): number {
    let sum = selfCounts.get(id) || 0;
    for (const cid of (childMap.get(id) || [])) sum += accumulate(cid);
    result.set(id, sum);
    return sum;
  }
  for (const t of allTags) {
    if (!t.parentId || !allTags.some(p => p.id === t.parentId)) accumulate(t.id);
  }
  for (const t of allTags) {
    if (!result.has(t.id)) result.set(t.id, selfCounts.get(t.id) || 0);
  }
  return result;
}

// ─── 工具执行 ───

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  storeGet: () => any,
  onAction?: (action: AgentAction) => void
): Promise<string> {
  const state = storeGet();
  const tags: any[] = state.tags || [];

  switch (name) {
    case 'list_tags': {
      const filter = String(args.filter || 'all');
      const rootTag = String(args.rootTag || '');
      const maxDepth = typeof args.maxDepth === 'number' ? args.maxDepth : 1;
      const tagTree = await tagService.getTagTree();
      const counts = await tagService.getTagCounts();
      const subtreeCounts = await buildSubtreeCounts();
      // 构建 tagId→fullPath 映射
      const allTags = await tagStorage.getAll();
      const pathMap = buildTagPathByIdMap(allTags);
      const lines: string[] = [];

      let startNodes = tagTree;
      if (rootTag) {
        const target = resolveTagByPath(rootTag, tags);
        if (!target) return `未找到标签 "${rootTag}"`;
        function findInTree(nodes: any[]): any | null {
          for (const node of nodes) {
            if (node.id === target.id) return node;
            if (node.children?.length) { const found = findInTree(node.children); if (found) return found; }
          }
          return null;
        }
        const rootNode = findInTree(tagTree);
        if (!rootNode) return `未在标签树中找到 "${rootTag}"`;
        startNodes = [rootNode];
        const depthLabel = maxDepth === 0 ? '全部层级' : `${maxDepth}层(包含起始标签)`;
        lines.push(`# 从 "${pathMap.get(target.id) || target.name}" 展开 (${depthLabel}, filter=${filter})`);
      }

      function walk(nodes: any[], indent: string, depth: number) {
        for (const node of nodes) {
          const count = counts.get(node.id) || 0;
          const subtreeCount = subtreeCounts.get(node.id) || 0;
          const fullPath = pathMap.get(node.id) || node.name;
          const shouldShow =
            filter === 'all' ||
            (filter === 'unused' && subtreeCount === 0) ||
            (filter === 'used' && subtreeCount > 0);
          if (shouldShow) {
            lines.push(`${indent}- ${fullPath} (${count} 个书签, 子树共 ${subtreeCount} 个)`);
          }
          if (node.children?.length && (maxDepth === 0 || depth < maxDepth)) {
            walk(node.children, indent + '  ', depth + 1);
          }
        }
      }
      walk(startNodes, '', 1);
      return lines.join('\n') || '暂无标签';
    }

    case 'get_tag_details': {
      const tagPaths = (args.tagPaths as string[]) || [];
      if (tagPaths.length === 0) return '未提供标签路径';
      const freshBookmarks = await bookmarkStorage.getBookmarks();
      const counts = await tagService.getTagCounts();
      const subtreeCounts = await buildSubtreeCounts();
      const blocks: string[] = [];
      for (const path of tagPaths) {
        const tag = resolveTagByPath(path, tags);
        if (!tag) { blocks.push(`[${path}] 未找到`); continue; }
        const selfCount = counts.get(tag.id) || 0;
        const total = subtreeCounts.get(tag.id) || 0;
        const children = tags.filter((t: any) => t.parentId === tag.id);
        const fullPath = await tagService.getTagPathString(tag.id);
        const relatedBookmarks = freshBookmarks
          .filter((b: any) => b.tagIds?.includes(tag.id))
          .slice(0, 10)
          .map((b: any) => `- ${b.title || b.url}`)
          .join('\n');
        blocks.push([
          `[${fullPath}]`,
          `自身书签: ${selfCount} 个`,
          `子树累计: ${total} 个（含子标签）`,
          `子标签: ${children.map((c: any) => c.name).join(', ') || '无'}`,
          `关联书签（前10）:\n${relatedBookmarks || '无'}`,
        ].join('\n'));
      }
      return blocks.join('\n\n');
    }

    case 'rename_tag': {
      const tagPath = String(args.tagPath || '');
      const toName = String(args.newName || '');
      const tag = resolveTagByPath(tagPath, tags);
      if (!tag) return `未找到标签 "${tagPath}"`;
      const oldPath = await tagService.getTagPathString(tag.id);
      await state.renameTag(tag.id, toName);
      const newPath = await tagService.getTagPathString(tag.id);
      const result = `已将 "${oldPath}" 重命名为 "${newPath}"`;
      if (onAction) {
        onAction({
          id: `action_${Date.now()}`,
          type: 'rename_tag',
          params: { tagPath, newName: toName },
          result,
          timestamp: Date.now(),
          status: 'executed',
          undoData: { tagId: tag.id, oldName: tag.name },
        });
      }
      return result;
    }

    case 'merge_tags': {
      const sourcePaths = (args.sourcePaths as string[]) || [];
      const targetPath = String(args.targetPath || '');
      const sourceIds = sourcePaths.map(p => resolveTagByPath(p, tags)).filter(Boolean).map((t: any) => t.id);
      if (sourceIds.length === 0) return '未找到源标签';
      const targetTag = resolveTagByPath(targetPath, tags);
      if (!targetTag) return `未找到目标标签 "${targetPath}"`;
      const targetFullPath = await tagService.getTagPathString(targetTag.id);
      await state.mergeTags(sourceIds, targetTag.id);
      const result = `已将 ${sourcePaths.join(', ')} 合并到 "${targetFullPath}"`;
      if (onAction) {
        onAction({
          id: `action_${Date.now()}`,
          type: 'merge_tags',
          params: { sourcePaths, targetPath },
          result,
          timestamp: Date.now(),
          status: 'executed',
          undoData: { sourceIds, targetId: targetTag.id },
        });
      }
      return result;
    }

    case 'move_tag': {
      const tagPaths = (args.tagPaths as string[]) || [];
      const parentPath = String(args.parentPath || '');
      const parentTag = parentPath ? resolveTagByPath(parentPath, tags) : null;
      if (parentPath && !parentTag) return `未找到父标签 "${parentPath}"`;

      const results: string[] = [];
      for (const path of tagPaths) {
        const tag = resolveTagByPath(path, tags);
        if (!tag) {
          results.push(`未找到标签 "${path}"`);
          continue;
        }
        await state.moveTag(tag.id, parentTag?.id);
        const newFullPath = await tagService.getTagPathString(tag.id);
        const result = `"${path}" → "${newFullPath || '根级'}"`;
        results.push(result);
        if (onAction) {
          onAction({
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'move_tag',
            params: { tagPath: path, parentPath },
            result,
            timestamp: Date.now(),
            status: 'executed',
            undoData: { tagId: tag.id, oldParentId: tag.parentId },
          });
        }
      }
      return results.join('\n') || '未提供标签路径';
    }

    case 'delete_tags': {
      const tagPaths = (args.tagPaths as string[]) || [];
      if (tagPaths.length === 0) return '未提供标签路径';
      const bookmarks: any[] = state.bookmarks || [];
      const pathInfos: { path: string; tag: any; idsToDelete: Set<string> }[] = [];
      const allIdsToDelete = new Set<string>();
      const results: string[] = [];

      for (const path of tagPaths) {
        const tag = resolveTagByPath(path, tags);
        if (!tag) { results.push(`未找到 "${path}"`); continue; }
        const idsToDelete = new Set<string>();
        function collectDescendants(pid: string) {
          idsToDelete.add(pid);
          tags.filter((t: any) => t.parentId === pid).forEach((t: any) => collectDescendants(t.id));
        }
        collectDescendants(tag.id);
        idsToDelete.forEach(id => allIdsToDelete.add(id));
        pathInfos.push({ path, tag, idsToDelete });
        const fullPath = await tagService.getTagPathString(tag.id);
        results.push(`"${fullPath}" 及 ${idsToDelete.size - 1} 个子标签`);
      }

      if (allIdsToDelete.size === 0) return results.join('\n');

      await state.deleteTags(Array.from(allIdsToDelete));

      if (onAction) {
        for (const info of pathInfos) {
          const deletedTags = tags.filter((t: any) => info.idsToDelete.has(t.id));
          const affectedBookmarks = bookmarks
            .filter((b: any) => b.tagIds?.some((tid: string) => info.idsToDelete.has(tid)))
            .map((b: any) => ({ bookmarkId: b.id, tagIds: [...b.tagIds] }));
          const fullPath = await tagService.getTagPathString(info.tag.id);
          onAction({
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'delete_tags',
            params: { tagPath: info.path },
            result: `已删除 "${fullPath}" 及 ${info.idsToDelete.size - 1} 个子标签`,
            timestamp: Date.now(),
            status: 'executed',
            undoData: { deletedTags, affectedBookmarks },
          });
        }
      }

      return `已删除: ${results.join(', ')}`;
    }

    default:
      return `未知工具: ${name}`;
  }
}

// ─── Agent 对话循环 ───

const SYSTEM_PROMPT = `你是 TIGERMARK 标签管理助手。

你可以调用以下工具来操作标签：
- list_tags: 查看所有标签（返回完整路径）
- get_tag_details: 批量查看标签详情（参数用完整路径，tagPaths 为列表）
- rename_tag: 重命名标签（参数用完整路径）
- merge_tags: 合并多个源标签到目标标签（参数用完整路径，sourcePaths 为列表）
- move_tag: 批量移动标签到新的父级（参数用完整路径，tagPaths 为列表，parentPath 为空字符串=根级）
- delete_tags: 批量删除标签及其所有子标签（参数用完整路径，tagPaths 为列表）

工作原则：
1. 先了解当前标签状况，再给出建议
2. 任何修改操作前，先向用户说明你的计划，获得确认后再执行
3. 所有标签操作必须使用完整路径，如 "技术/前端/React"，不能只用叶子名称
4. 优先建立层级结构，将扁平标签组织成树形
5. 每次回复尽量简洁明了

标签路径使用 "/" 表示层级。`;

async function runAgentLoop(
  messages: AgentMessage[],
  storeGet: () => any,
  onUpdate: (msgs: AgentMessage[]) => void,
  onAction?: (action: AgentAction) => void,
): Promise<void> {
  const settings = storeGet().settings;
  await aiChatService.initialize(settings);

  const tagTree = await tagService.getTagTree();
  const counts = await tagService.getTagCounts();
  const subtreeCounts = new Map<string, number>();
  function calcSubtree(nodes: any[]): void {
    for (const node of nodes) {
      const selfCount = counts.get(node.id) || 0;
      let childTotal = 0;
      if (node.children?.length) {
        calcSubtree(node.children);
        for (const child of node.children) childTotal += subtreeCounts.get(child.id) || 0;
      }
      subtreeCounts.set(node.id, selfCount + childTotal);
    }
  }
  calcSubtree(tagTree);

  let usedCount = 0;
  let unusedCount = 0;
  function countUsage(nodes: any[]) {
    for (const node of nodes) {
      if ((subtreeCounts.get(node.id) || 0) > 0) usedCount++;
      else unusedCount++;
      if (node.children?.length) countUsage(node.children);
    }
  }
  countUsage(tagTree);
  const totalCount = usedCount + unusedCount;
  const statsPrompt = `\n\n【当前标签统计】总标签 ${totalCount} 个：已使用（子树总用量>0）${usedCount} 个，未使用（子树总用量=0）${unusedCount} 个。`;

  const chatMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT + statsPrompt },
    ...messages.flatMap((m): ChatMessage | ChatMessage[] => {
      if (m.role === 'tool') {
        if (m.toolResults && m.toolResults.length > 0) {
          return m.toolResults.map(r => ({ role: 'tool' as const, content: r.result, tool_call_id: r.toolCallId, name: r.name }));
        }
        return { role: 'tool', content: m.content, tool_call_id: '', name: '' };
      }
      if (m.role === 'assistant') {
        const cm: ChatMessage = { role: 'assistant', content: m.content };
        if (m.toolCalls) cm.tool_calls = m.toolCalls;
        if (m.reasoningContent) cm.reasoning_content = m.reasoningContent;
        return cm;
      }
      return { role: m.role, content: m.content };
    }),
  ];

  const MAX_ITERATIONS = 5;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await aiChatService.chatWithTools(chatMessages, TAG_AGENT_TOOLS);

    const assistantMsg: AgentMessage = {
      id: `assistant_${Date.now()}_${i}`,
      role: 'assistant',
      content: response.content || '',
      toolCalls: response.toolCalls.length > 0 ? response.toolCalls : undefined,
      reasoningContent: response.reasoningContent,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, assistantMsg];
    onUpdate(updatedMessages);

    if (response.toolCalls.length === 0) break;

    const toolResults: { toolCallId: string; name: string; result: string }[] = [];
    for (const tc of response.toolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
      const result = await executeTool(tc.function.name, args, storeGet, onAction);
      toolResults.push({ toolCallId: tc.id, name: tc.function.name, result });
    }

    const toolMsg: AgentMessage = {
      id: `tool_${Date.now()}_${i}`,
      role: 'tool',
      content: toolResults.map(r => `[${r.name}] ${r.result}`).join('\n\n'),
      toolResults,
      timestamp: Date.now(),
    };

    messages = [...updatedMessages, toolMsg];
    onUpdate(messages);

    const nextAssistantMsg: ChatMessage = { role: 'assistant', content: response.content || '', tool_calls: response.toolCalls };
    if (response.reasoningContent) nextAssistantMsg.reasoning_content = response.reasoningContent;
    chatMessages.push(nextAssistantMsg, ...toolResults.map((r): ChatMessage => ({ role: 'tool', content: r.result, tool_call_id: r.toolCallId, name: r.name })));
  }
}

// ─── Store Slice ───

export function createTagAgentSlice(
  set: (partial: any) => void,
  get: () => any
) {
  return {
    ...tagAgentInitialState,

    sendAgentMessage: async (text: string) => {
      const state = get();
      if (state.isAgentProcessing) return;
      const userMsg: AgentMessage = { id: `user_${Date.now()}`, role: 'user', content: text, timestamp: Date.now() };
      const newMessages = [...state.agentMessages, userMsg];
      set({ agentMessages: newMessages, isAgentProcessing: true, agentError: null });
      try {
        await runAgentLoop(newMessages, get, (msgs) => { set({ agentMessages: msgs }); }, (action) => { set((s: TagAgentState) => ({ agentActionLog: [...s.agentActionLog, action] })); });
      } catch (error) {
        console.error('Agent 对话失败:', error);
        set({ agentError: error instanceof Error ? error.message : 'Agent 对话失败' });
      } finally {
        set({ isAgentProcessing: false });
      }
    },

    clearAgentConversation: () => { set({ agentMessages: [], agentError: null }); },

    confirmAgentAction: (actionId: string) => {
      set((s: TagAgentState) => ({ agentActionLog: s.agentActionLog.map((a) => a.id === actionId ? { ...a, status: 'confirmed' as const } : a) }));
    },

    rejectAgentAction: async (actionId: string) => {
      const state = get();
      const action = state.agentActionLog.find((a: AgentAction) => a.id === actionId);
      if (!action) return;
      set((s: TagAgentState) => ({ agentActionLog: s.agentActionLog.map((a) => a.id === actionId ? { ...a, status: 'rejected' as const } : a) }));
      if (action.undoData) await state.undoAgentAction(actionId);
    },

    undoAgentAction: async (actionId: string) => {
      const state = get();
      const action = state.agentActionLog.find((a: AgentAction) => a.id === actionId);
      if (!action) return;
      if (!action.undoData) { set({ agentError: '该操作不支持撤销' }); return; }
      try {
        switch (action.type) {
          case 'rename_tag': {
            const { tagId, oldName } = action.undoData;
            await state.renameTag(tagId, oldName);
            break;
          }
          case 'move_tag': {
            const { tagId, oldParentId } = action.undoData as { tagId: string; oldParentId: string | undefined };
            await state.moveTag(tagId, oldParentId || undefined);
            break;
          }
          case 'delete_tags': {
            const { deletedTags, affectedBookmarks } = action.undoData as { deletedTags: any[]; affectedBookmarks: any[] };
            await tagStorage.batchInsert(deletedTags);
            if (affectedBookmarks?.length) {
              for (const { bookmarkId, tagIds } of affectedBookmarks) {
                await bookmarkStorage.updateBookmark(bookmarkId, { tagIds });
              }
            }
            await get().loadBookmarks();
            set({ tags: await tagStorage.getAll() });
            break;
          }
          case 'merge_tags': {
            set({ agentError: '合并操作暂不支持自动撤销，请手动处理' });
            return;
          }
        }
        set((s: TagAgentState) => ({ agentActionLog: s.agentActionLog.map((a) => a.id === actionId ? { ...a, status: 'rejected' as const } : a) }));
      } catch (error) {
        set({ agentError: `撤销失败: ${error instanceof Error ? error.message : '未知错误'}` });
      }
    },

    clearAgentActionLog: () => { set({ agentActionLog: [] }); },
  };
}
