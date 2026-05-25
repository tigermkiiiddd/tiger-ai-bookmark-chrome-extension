import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, Globe, FolderOpen, Tag, ImageIcon } from 'lucide-react';
import type { Bookmark } from '../types';
import { extractDomain } from '../utils/url';
import { getTagColor } from '../utils/colors';
import { formatDate } from '../utils/date';
import { isBookmarkArchived } from '../utils/bookmarkArchive';

interface BookmarkCardShellProps {
  bookmark: Bookmark;
  tagNames: string[];
  categoryPath?: string | null;

  className?: string;
  borderClassName?: string;
  imageClassName?: string;
  lightweight?: boolean;
  imageObjectPosition?: 'center' | 'top';
  faviconSize?: number;
  imageAlt?: string;
  imagePlaceholder?: 'favicon' | 'icon';

  // 内容区选项
  showUrl?: boolean;
  showDomainDate?: boolean;
  showCategory?: boolean;
  showFooter?: boolean;
  maxTags?: number;
  showTagExpand?: boolean;
  aiSummaryVariant?: 'default' | 'purple';
  dateField?: 'createdAt' | 'updatedAt';
  showCategoryFallback?: boolean;
  showTagFallback?: boolean;

  // 额外内容（插入内容区中间）
  extraContent?: React.ReactNode;
  // 底部额外内容（插入内容区底部）
  footerExtra?: React.ReactNode;

  // 叠加层
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  imageOverlay?: React.ReactNode;
  cardFooter?: React.ReactNode;

  onContextMenu?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  'data-bookmark-item'?: boolean;
}

export const BookmarkCardShell = React.memo<BookmarkCardShellProps>(
  ({
    bookmark,
    tagNames,
    categoryPath,
    className = '',
    borderClassName = 'border-gray-200 dark:border-gray-700',
    imageClassName = '',
    lightweight = false,
    imageObjectPosition = 'center',
    faviconSize = 32,
    imageAlt = '',
    imagePlaceholder = 'favicon',
    showUrl = false,
    showDomainDate = false,
    showCategory = false,
    showFooter = false,
    maxTags = 6,
    showTagExpand = false,
    aiSummaryVariant = 'default',
    dateField = 'createdAt',
    showCategoryFallback = false,
    showTagFallback = false,
    extraContent,
    footerExtra,
    topLeft,
    topRight,
    imageOverlay,
    cardFooter,
    onContextMenu,
    onClick,
    'data-bookmark-item': dataBookmarkItem,
  }) => {
    const domain = extractDomain(bookmark.url);
    const resolvedImageAlt = imageAlt || bookmark.title || '';
    const faviconUrl =
      bookmark.imagePreviewUrl ||
      `https://www.google.com/s2/favicons?sz=${faviconSize}&domain=${domain}`;

    const descriptionText = bookmark.description?.trim();
    const aiSummaryText = bookmark.aiGenerated?.summary?.trim();
    const showAiSummary = !!aiSummaryText && aiSummaryText !== descriptionText;
    const archived = isBookmarkArchived(bookmark);

    const [tagExpanded, setTagExpanded] = useState(false);
    const visibleTags = tagExpanded ? tagNames : tagNames.slice(0, maxTags);
    const moreTags = tagNames.length - visibleTags.length;

    const dataProps = dataBookmarkItem
      ? { 'data-bookmark-item': true as const }
      : {};

    return (
      <div
        className={`relative group flex flex-col bg-white dark:bg-gray-800 rounded-lg border-2 transition-[border-color,box-shadow] duration-300 ${borderClassName} ${className}`}
        onContextMenu={onContextMenu}
        onClick={onClick}
        {...dataProps}
      >
        {/* 图片区（仅裁切图片，不裁切角标/菜单） */}
        <div
          className={`relative ${lightweight ? 'h-10' : 'aspect-video'} w-full bg-gray-100 dark:bg-gray-700 rounded-t-lg ${imageClassName}`}
        >
          <div className="absolute inset-0 overflow-hidden rounded-t-lg">
            {lightweight ? (
              <div className="w-full h-full flex items-center px-3 gap-2">
                <img src={faviconUrl} alt="" className="w-5 h-5 rounded" />
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">
                  {domain}
                </span>
              </div>
            ) : bookmark.imagePreviewUrl ? (
              <img
                src={bookmark.imagePreviewUrl}
                alt={resolvedImageAlt}
                className={`w-full h-full object-cover object-${imageObjectPosition}`}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.src = faviconUrl;
                  e.currentTarget.className =
                    'w-full h-full object-contain p-10 opacity-60';
                }}
              />
            ) : imagePlaceholder === 'icon' ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
                <ImageIcon className="w-8 h-8 opacity-50" />
                <span className="text-xs">无缩略图</span>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <img
                  src={faviconUrl}
                  alt={domain}
                  loading="lazy"
                  decoding="async"
                  className="w-12 h-12 opacity-50"
                  onError={(e) => {
                    e.currentTarget.src =
                      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23ccc"/></svg>';
                  }}
                />
              </div>
            )}
          </div>

          {imageOverlay}
        </div>

        {/* 内容区 */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 mb-2">
            {bookmark.title || domain}
          </h3>

          {descriptionText && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
              {descriptionText}
            </p>
          )}

          {showAiSummary && (
            <p
              className={`text-xs line-clamp-2 italic mb-3 ${
                aiSummaryVariant === 'purple'
                  ? 'text-purple-700/90 dark:text-purple-300/90 bg-purple-50/80 dark:bg-purple-900/20 rounded px-2 py-1'
                  : 'text-gray-500 dark:text-gray-500'
              }`}
            >
              {aiSummaryText}
            </p>
          )}

          {/* 标签 */}
          {tagNames.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-1">
                {visibleTags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getTagColor(tag)}`}
                    title={tag}
                  >
                    {tag}
                  </span>
                ))}
                {moreTags > 0 &&
                  (showTagExpand ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTagExpanded(!tagExpanded);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-full hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                    >
                      {tagExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" />
                          收起
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          +{moreTags}
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="px-2 py-1 text-xs text-gray-500 border border-gray-300 dark:border-gray-600 rounded-full">
                      +{moreTags}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {showUrl && (
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-start gap-1 text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline line-clamp-2 break-all mb-3"
            >
              <Globe className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>{bookmark.url}</span>
            </a>
          )}

          {showDomainDate && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mb-3">
              <span className="inline-flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {domain}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(bookmark[dateField])}
              </span>
            </div>
          )}

          {showCategory && categoryPath && (
            <div className="inline-flex items-center gap-1 max-w-full text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/25 border border-purple-200/60 dark:border-purple-700/50 rounded px-2 py-1 mb-3">
              <FolderOpen className="w-3 h-3 flex-shrink-0" />
              <span className="truncate font-medium">{categoryPath}</span>
            </div>
          )}
          {showCategory && !categoryPath && showCategoryFallback && (
            <span className="text-xs text-amber-600 dark:text-amber-400 mb-3">
              尚无分类
            </span>
          )}

          {showTagFallback && tagNames.length === 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-400 inline-flex items-center gap-1 mb-3">
              <Tag className="w-3 h-3" />
              尚无标签
            </span>
          )}

          {extraContent}

          {showFooter && (
            <>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-auto pt-3">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(bookmark[dateField])}</span>
                </div>
                <div className="flex items-center gap-1">
                  {categoryPath && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200/50 dark:border-purple-700/50 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-md shadow-sm">
                      <Tag className="w-3.5 h-3.5" />
                      <span className="font-semibold">{categoryPath}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {domain}
                </p>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {archived && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">
                      已归档
                    </span>
                  )}
                  {bookmark.status === 'dead' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                      失效
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {footerExtra}
        </div>

        {(topLeft || topRight) && (
          <div className="absolute inset-0 z-30 overflow-visible pointer-events-none">
            {topLeft}
            {topRight}
          </div>
        )}

        {cardFooter}
      </div>
    );
  }
);

export default BookmarkCardShell;
