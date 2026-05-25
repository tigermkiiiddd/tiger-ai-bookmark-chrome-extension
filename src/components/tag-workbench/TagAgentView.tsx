import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBookmarkStore } from '../../store';
import { Send, Loader2, Bot, User, Wrench, Trash2, Sparkles, Check, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { AgentAction } from '../../store/slices/tagAgentSlice';
import type { Tag } from '../../types';
import { TagCloudView } from './TagCloudView';

interface TagAgentViewProps {
  tags: Tag[];
  tagCounts: Map<string, number>;
  tagPathMap: Map<string, string>;
  searchQuery: string;
  selectedTagId: string | null;
  onTagSelect: (tagId: string) => void;
}

const ToolCallCard: React.FC<{ name: string }> = ({ name }) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
    <Wrench className="w-3.5 h-3.5" />
    <span>调用工具: <span className="font-medium">{name}</span></span>
  </div>
);

export const TagAgentView: React.FC<TagAgentViewProps> = ({
  tags,
  tagCounts,
  tagPathMap,
  searchQuery,
  selectedTagId,
  onTagSelect,
}) => {
  const messages = useBookmarkStore(s => s.agentMessages);
  const isProcessing = useBookmarkStore(s => s.isAgentProcessing);
  const error = useBookmarkStore(s => s.agentError);
  const sendAgentMessage = useBookmarkStore(s => s.sendAgentMessage);
  const clearAgentConversation = useBookmarkStore(s => s.clearAgentConversation);
  const agentActionLog = useBookmarkStore(s => s.agentActionLog);
  const confirmAgentAction = useBookmarkStore(s => s.confirmAgentAction);
  const rejectAgentAction = useBookmarkStore(s => s.rejectAgentAction);
  const clearAgentActionLog = useBookmarkStore(s => s.clearAgentActionLog);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput('');
    await sendAgentMessage(text);
  }, [input, isProcessing, sendAgentMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const hasMessages = messages.length > 0;
  const pendingActions = agentActionLog.filter(a => a.status === 'executed');
  const hasActions = pendingActions.length > 0;

  const getActionDescription = (action: AgentAction) => {
    const p = action.params;
    switch (action.type) {
      case 'rename_tag':
        return `重命名 "${p.tagPath}" → "${p.newName}"`;
      case 'merge_tags':
        return `合并 ${(p.sourcePaths as string[]).join(', ')} → "${p.targetPath}"`;
      case 'move_tag':
        return `移动 "${p.tagPath}" → "${p.parentPath || '根级'}"`;
      case 'delete_tags':
        return `删除 ${(p.tagPaths as string[]).map((n: string) => `"${n}"`).join(', ')}`;
      default:
        return action.type;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'rename_tag': return <span className="text-blue-500 font-medium text-xs">重命名</span>;
      case 'merge_tags': return <span className="text-purple-500 font-medium text-xs">合并</span>;
      case 'move_tag': return <span className="text-cyan-500 font-medium text-xs">移动</span>;
      case 'delete_tags': return <span className="text-red-500 font-medium text-xs">删除</span>;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* 左侧：标签云 */}
      <div className="flex-1 h-[40vh] lg:h-full relative border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
        <TagCloudView
          tags={tags}
          tagCounts={tagCounts}
          tagPathMap={tagPathMap}
          searchQuery={searchQuery}
          selectedTagId={selectedTagId}
          onTagSelect={onTagSelect}
        />
      </div>

      {/* 右侧：Agent 聊天面板 */}
      <div className="flex flex-col h-[60vh] lg:h-full lg:w-[400px] xl:w-[440px] bg-gray-50/50 dark:bg-gray-900/50">
        {/* 面板头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI 标签助手</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">多轮对话整理标签</p>
            </div>
          </div>
          {hasMessages && (
            <button
              onClick={clearAgentConversation}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="清空对话"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 审批面板 */}
        {hasActions && (
          <div className="border-b border-gray-200 dark:border-gray-700 bg-amber-50/60 dark:bg-amber-900/10">
            <div className="flex items-center justify-between px-4 py-2 border-b border-amber-100 dark:border-amber-800/30">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">操作审批</span>
                <span className="text-xs text-amber-600 dark:text-amber-400">({pendingActions.length})</span>
              </div>
              <button
                onClick={clearAgentActionLog}
                className="p-1 text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300 rounded transition-colors"
                title="清空记录"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="max-h-[160px] overflow-y-auto px-3 py-2 space-y-2">
              {pendingActions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs bg-white dark:bg-gray-800 border-amber-200 dark:border-amber-800/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {getActionIcon(action.type)}
                      <span className="text-gray-700 dark:text-gray-300 truncate">
                        {getActionDescription(action)}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      待确认
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => confirmAgentAction(action.id)}
                      className="p-1.5 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30 rounded-md transition-colors"
                      title="确认"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => rejectAgentAction(action.id)}
                      className="p-1.5 text-red-500 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors"
                      title="拒绝(撤销)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
              <Bot className="w-12 h-12 opacity-30" />
              <p className="text-sm text-center">我是你的标签整理助手</p>
              <div className="space-y-1.5 text-xs text-center">
                <p className="text-gray-500 dark:text-gray-500">试试这样说：</p>
                <button
                  onClick={() => {
                    setInput('帮我整理一下重复标签');
                    inputRef.current?.focus();
                  }}
                  className="block px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-700 transition-colors text-gray-600 dark:text-gray-400"
                >
                  "帮我整理一下重复标签"
                </button>
                <button
                  onClick={() => {
                    setInput('把扁平标签组织成层级结构');
                    inputRef.current?.focus();
                  }}
                  className="block px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-700 transition-colors text-gray-600 dark:text-gray-400"
                >
                  "把扁平标签组织成层级结构"
                </button>
                <button
                  onClick={() => {
                    setInput('看看有哪些标签没在使用');
                    inputRef.current?.focus();
                  }}
                  className="block px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-700 transition-colors text-gray-600 dark:text-gray-400"
                >
                  "看看有哪些标签没在使用"
                </button>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* 头像 */}
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                msg.role === 'user'
                  ? 'bg-blue-100 dark:bg-blue-900/40'
                  : msg.role === 'tool'
                  ? 'bg-amber-100 dark:bg-amber-900/40'
                  : 'bg-purple-100 dark:bg-purple-900/40'
              }`}>
                {msg.role === 'user' ? (
                  <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                ) : msg.role === 'tool' ? (
                  <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                )}
              </div>

              {/* 消息内容 */}
              <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="space-y-1.5">
                    {msg.toolCalls.map((tc) => (
                      <ToolCallCard key={tc.id} name={tc.function.name} />
                    ))}
                  </div>
                )}

                {msg.content && (
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : msg.role === 'tool'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-bl-md'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md shadow-sm'
                  }`}>
                    {msg.content}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 正在处理指示 */}
          {isProcessing && (
            <div className="flex gap-2.5">
              <div className="shrink-0 w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isProcessing ? 'AI 正在思考...' : '输入指令，如：帮我整理重复标签...'}
              disabled={isProcessing}
              rows={1}
              className="flex-1 px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400 text-gray-900 dark:text-gray-100 resize-none min-h-[40px] max-h-[120px] disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isProcessing || !input.trim()}
              className="p-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
