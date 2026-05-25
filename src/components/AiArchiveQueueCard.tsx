import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  SkipForward,
  Sparkles,
  AlertCircle,
  ExternalLink,
  MoreVertical,
  Edit,
  Bot,
  Trash2,
  Camera
} from 'lucide-react';
import type { Bookmark, Category } from '../types/index';
import { useBookmarkStore } from '../store/index';
import { notificationManager } from '../utils/NotificationManager';
import { getCategoryPath } from '../utils/categoryTreeBuilder';
import { openBookmarkUrl } from '../utils/openBookmark';
import type { AiArchiveRowPhase } from '../utils/aiArchive';
import BookmarkCardShell from './BookmarkCardShell';

interface AiArchiveQueueCardProps {
  bookmark: Bookmark;
  phase: AiArchiveRowPhase;
  categories: Category[];
  index: number;
  errorMessage?: string;
  actionsDisabled?: boolean;
  tagNames: string[];
  lightweight?: boolean;
}

function PhaseBadge({ phase }: { phase: AiArchiveRowPhase }) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium';
  switch (phase) {
    case 'processing': return <span className={`${base} bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200`}><Loader2 className="w-3 h-3 animate-spin" />处理中</span>;
    case 'success': return <span className={`${base} bg-green-600 text-white dark:bg-green-600 dark:text-white shadow-sm`}><CheckCircle className="w-3.5 h-3.5" />已成功归档</span>;
    case 'failed': return <span className={`${base} bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200`}><XCircle className="w-3 h-3" />失败</span>;
    case 'skipped': return <span className={`${base} bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300`}><SkipForward className="w-3 h-3" />已跳过</span>;
    case 'link_dead': return <span className={`${base} bg-red-600 text-white dark:bg-red-700 dark:text-white shadow-sm`}><XCircle className="w-3.5 h-3.5" />链接失效</span>;
    default: return <span className={`${base} bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400`}><Clock className="w-3 h-3" />待处理</span>;
  }
}

function cardBorderClass(phase: AiArchiveRowPhase): string {
  switch (phase) {
    case 'processing': return 'border-purple-400 dark:border-purple-500 ring-2 ring-purple-400/40 shadow-md';
    case 'success': return 'border-green-500 dark:border-green-600 ring-2 ring-green-400/50 shadow-lg shadow-green-500/10 bg-green-50/30 dark:bg-green-950/20';
    case 'failed': return 'border-red-300 dark:border-red-700';
    case 'skipped': return 'border-gray-200 dark:border-gray-700 opacity-80';
    case 'link_dead': return 'border-red-400 dark:border-red-600 ring-2 ring-red-400/40 bg-red-50/40 dark:bg-red-950/25';
    default: return 'border-gray-200 dark:border-gray-700';
  }
}

const AiArchiveQueueCard = React.memo<AiArchiveQueueCardProps>(({
  bookmark, phase, categories, index, errorMessage, actionsDisabled = false, tagNames, lightweight = false
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiArchiving, setIsAiArchiving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { openEditModal, aiArchiveBookmark, deleteBookmark, refreshBookmarkThumbnail } = useBookmarkStore();
  const categoryPath = bookmark.categoryId ? getCategoryPath(bookmark.categoryId, categories) : null;
  const hasThumbnail = !!bookmark.imagePreviewUrl;
  const hasAiMeta = !!bookmark.aiGenerated;
  const isWorking = isLoading || isAiArchiving;
  const disabled = actionsDisabled || isWorking;
  const displayPhase: AiArchiveRowPhase = isAiArchiving ? 'processing' : phase;

  useEffect(() => {
    if (!showMenu) return;
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

  const handleAction = useCallback(async (action: 'open' | 'edit' | 'ai-archive' | 'refresh-screenshot' | 'delete') => {
    if (actionsDisabled || isWorking) return;
    setShowMenu(false);
    if (action === 'edit') { openEditModal(bookmark); return; }
    if (action === 'open') { await openBookmarkUrl(bookmark); return; }
    if (action === 'ai-archive') {
      setIsAiArchiving(true);
      try { await aiArchiveBookmark(bookmark.id); } catch (err) {
        const message = err instanceof Error ? err.message : 'AI 归档失败';
        notificationManager.showError('AI 归档失败', message);
      } finally { setIsAiArchiving(false); }
      return;
    }
    if (action === 'refresh-screenshot') {
      setIsLoading(true);
      try {
        await refreshBookmarkThumbnail(bookmark.id);
      } catch (err) {
        notificationManager.showError('更新截图失败', err instanceof Error ? err.message : '未知错误');
      } finally { setIsLoading(false); }
      return;
    }
    if (action === 'delete') {
      if (!confirm('确定要删除这个书签吗？此操作无法撤销。')) return;
      setIsLoading(true);
      try { await deleteBookmark(bookmark.id); } catch (err) {
        notificationManager.showError('删除失败', err instanceof Error ? err.message : '未知错误');
      } finally { setIsLoading(false); }
    }
  }, [actionsDisabled, isWorking, bookmark, openEditModal, aiArchiveBookmark, deleteBookmark, refreshBookmarkThumbnail]);

  return (
    <BookmarkCardShell
      bookmark={bookmark}
      tagNames={tagNames}
      categoryPath={categoryPath}
      className={`h-full ${showMenu ? 'relative z-50' : ''} ${isWorking ? 'opacity-50 pointer-events-none' : ''}`}
      borderClassName={cardBorderClass(displayPhase)}
      imageClassName="flex-shrink-0"
      lightweight={lightweight}
      imageObjectPosition="top"
      imagePlaceholder="icon"
      faviconSize={64}
      imageAlt=""
      showUrl
      showDomainDate
      showCategory
      showCategoryFallback
      showTagFallback
      maxTags={6}
      aiSummaryVariant="purple"
      dateField="updatedAt"
      extraContent={
        <div className="flex flex-wrap gap-1.5 mb-3">
          {!hasThumbnail && phase === 'pending' && <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">归档前将尝试截图</span>}
          {hasAiMeta && <span className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 inline-flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />已有 AI 分析</span>}
        </div>
      }
      footerExtra={errorMessage && (
        <div className="flex items-start gap-1.5 p-2 rounded bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="line-clamp-3">{errorMessage}</span>
        </div>
      )}
      topLeft={
        <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-auto">
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-black/50 text-white rounded">#{index + 1}</span>
          <PhaseBadge phase={displayPhase} />
        </div>
      }
      topRight={
        <div className="absolute top-3 right-3 z-20 pointer-events-auto" ref={menuRef}>
          <button type="button" disabled={disabled} onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
            className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50" aria-label="更多操作">
            <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-[1000]">
              <button type="button" className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); void handleAction('open'); }}>
                <ExternalLink className="w-4 h-4" />在新标签页打开
              </button>
              <button type="button" className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); void handleAction('edit'); }}>
                <Edit className="w-4 h-4" />编辑书签
              </button>
              <button type="button" disabled={isAiArchiving || bookmark.status === 'dead'} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50" onClick={(e) => { e.stopPropagation(); void handleAction('ai-archive'); }}>
                <Bot className="w-4 h-4" />{isAiArchiving ? 'AI归档中...' : 'AI智能归档'}
              </button>
              <button type="button" disabled={bookmark.status === 'dead'} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50" onClick={(e) => { e.stopPropagation(); void handleAction('refresh-screenshot'); }}>
                <Camera className="w-4 h-4" />更新截图
              </button>
              <hr className="border-gray-200 dark:border-gray-700" />
              <button type="button" className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={(e) => { e.stopPropagation(); void handleAction('delete'); }}>
                <Trash2 className="w-4 h-4" />删除书签
              </button>
            </div>
          )}
        </div>
      }
      imageOverlay={
        <>
          {isAiArchiving && <div className="absolute inset-0 flex items-center justify-center bg-black/25 z-[5]"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}
          {displayPhase === 'success' && !isAiArchiving && <div className="absolute inset-x-0 bottom-0 z-[6] py-2 px-3 bg-green-600/95 dark:bg-green-700/95 text-center"><span className="text-xs font-semibold text-white tracking-wide">✓ 已成功归档 · 离开本页后不再显示</span></div>}
        </>
      }
    />
  );
}, (prev, next) =>
  prev.bookmark.id === next.bookmark.id &&
  prev.bookmark.isArchived === next.bookmark.isArchived &&
  prev.bookmark.categoryId === next.bookmark.categoryId &&
  prev.bookmark.tagIds?.join(',') === next.bookmark.tagIds?.join(',') &&
  prev.bookmark.status === next.bookmark.status &&
  prev.bookmark.imagePreviewUrl === next.bookmark.imagePreviewUrl &&
  prev.bookmark.aiGenerated?.category === next.bookmark.aiGenerated?.category &&
  prev.bookmark.aiGenerated?.summary === next.bookmark.aiGenerated?.summary &&
  prev.phase === next.phase &&
  prev.index === next.index &&
  prev.errorMessage === next.errorMessage &&
  prev.actionsDisabled === next.actionsDisabled &&
  prev.categories === next.categories &&
  prev.tagNames === next.tagNames &&
  prev.lightweight === next.lightweight
);

export default AiArchiveQueueCard;
