import React from 'react';
import { ExternalLink, FileText, Tag as TagIcon, StickyNote, Camera, Loader2 } from 'lucide-react';
import type { Bookmark, Category } from '../types/index';
import TagInput from './TagInput';
import CategoryTreeSelect from './CategoryTreeSelect';
import { extractDomain } from '../utils/index';

export interface BookmarkEditorProps {
  value: Bookmark;
  onChange: (patch: Partial<Bookmark>) => void;
  categories: Category[];
  errors?: Record<string, string>;
  disabled?: boolean;
  showNotes?: boolean;
  urlReadOnly?: boolean;
  /** default=主应用编辑弹窗；popup=Popup 专用布局 */
  layout?: 'default' | 'popup';
  /** popup：仅预览 / 仅表单 / 完整（默认） */
  popupSection?: 'full' | 'preview' | 'form';
  categoriesLoaded?: boolean;
  onCreateCategory?: (name: string) => Promise<string | void>;
  className?: string;
  /** popup 预览区：手动截取当前标签页 */
  showScreenshotRefresh?: boolean;
  onRefreshScreenshot?: () => void;
  isRefreshingScreenshot?: boolean;
}

const BookmarkEditor: React.FC<BookmarkEditorProps> = ({
  value,
  onChange,
  categories,
  errors = {},
  disabled = false,
  showNotes = false,
  urlReadOnly = false,
  layout = 'default',
  popupSection = 'full',
  categoriesLoaded = true,
  onCreateCategory,
  className = '',
  showScreenshotRefresh = false,
  onRefreshScreenshot,
  isRefreshingScreenshot = false,
}) => {
  const isPopup = layout === 'popup';
  const showPreview = !isPopup || popupSection === 'full' || popupSection === 'preview';
  const showFields = !isPopup || popupSection === 'full' || popupSection === 'form';
  const compactPreview = isPopup && popupSection === 'preview';
  const domain = extractDomain(value.url);
  const previewUrl =
    value.imagePreviewUrl ||
    `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;

  const patch = (partial: Partial<Bookmark>) => onChange(partial);

  /** Popup 宽 500px 时 75%（w-3/4）≈ 375×211（16:9） */
  const previewFrameClass = compactPreview
    ? 'w-full aspect-video rounded-md border border-gray-200 bg-white overflow-hidden shadow-sm'
    : 'aspect-video w-full bg-gray-100 dark:bg-gray-700 overflow-hidden';

  const refreshDisabled = disabled || isRefreshingScreenshot || !onRefreshScreenshot;

  const cardPreview = showPreview ? (
    <div className={compactPreview ? 'w-full' : ''}>
      <div className={`relative ${compactPreview ? 'mx-auto w-3/4 max-w-[375px]' : 'w-full'}`}>
        <div className={previewFrameClass}>
          {value.imagePreviewUrl ? (
            <img
              src={value.imagePreviewUrl}
              alt={value.title}
              className={`w-full h-full object-cover object-top bg-gray-100 ${
                isRefreshingScreenshot ? 'opacity-40' : ''
              }`}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = previewUrl;
                target.className = 'w-full h-full object-contain object-center p-4';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={previewUrl}
                alt={domain}
                className={compactPreview ? 'w-10 h-10 opacity-60' : 'w-16 h-16 opacity-60'}
                onError={(e) => {
                  e.currentTarget.src =
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23ccc"/></svg>';
                }}
              />
            </div>
          )}

          {isRefreshingScreenshot && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 rounded-md">
              <Loader2 className="w-8 h-8 text-white animate-spin" aria-hidden />
            </div>
          )}
        </div>

        {compactPreview && showScreenshotRefresh && onRefreshScreenshot && (
          <button
            type="button"
            onClick={onRefreshScreenshot}
            disabled={refreshDisabled}
            title="截取当前标签页画面（请在页面加载完成后再点）"
            className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-gray-900/75 hover:bg-gray-900/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md shadow-md backdrop-blur-sm transition-colors"
          >
            {isRefreshingScreenshot ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            ) : (
              <Camera className="w-3.5 h-3.5" aria-hidden />
            )}
            {isRefreshingScreenshot ? '截图中…' : value.imagePreviewUrl ? '更新截图' : '截取页面'}
          </button>
        )}
      </div>
    </div>
  ) : null;

  const fields = (
    <div className={`space-y-4 ${isPopup ? '' : 'p-4'}`}>
      {value.aiGenerated && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-sm font-medium text-blue-900 mb-1">AI 分析结果</h4>
          <div className="text-sm text-blue-800 space-y-1">
            {value.aiGenerated.summary && (
              <p>
                <strong>摘要:</strong> {value.aiGenerated.summary}
              </p>
            )}
            {value.aiGenerated.keywords?.length > 0 && (
              <p>
                <strong>关键词:</strong> {value.aiGenerated.keywords.join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <FileText className="w-4 h-4 inline mr-1" />
          标题 *
        </label>
        <input
          type="text"
          value={value.title}
          onChange={(e) => patch({ title: e.target.value })}
          disabled={disabled}
          className={`w-full px-3 py-2 text-sm border rounded-md bg-white text-gray-900 ${
            errors.title ? 'border-red-300' : 'border-gray-300 focus:ring-primary focus:border-primary'
          }`}
          placeholder="输入书签标题..."
        />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <ExternalLink className="w-4 h-4 inline mr-1" />
          网址 *
        </label>
        <input
          type="url"
          value={value.url}
          onChange={(e) => patch({ url: e.target.value })}
          disabled={disabled || urlReadOnly}
          readOnly={urlReadOnly}
          className={`w-full px-3 py-2 text-sm border rounded-md ${
            urlReadOnly ? 'bg-gray-50 text-gray-600' : 'bg-white text-gray-900'
          } ${errors.url ? 'border-red-300' : 'border-gray-300 focus:ring-primary focus:border-primary'}`}
        />
        {errors.url && <p className="mt-1 text-xs text-red-600">{errors.url}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <FileText className="w-4 h-4 inline mr-1" />
          描述
        </label>
        <textarea
          value={value.description || ''}
          onChange={(e) => patch({ description: e.target.value })}
          disabled={disabled}
          rows={isPopup ? 4 : 3}
          className={`w-full px-3 py-2 text-sm border rounded-md resize-none bg-white text-gray-900 ${
            errors.description
              ? 'border-red-300'
              : 'border-gray-300 focus:ring-primary focus:border-primary'
          }`}
          placeholder="添加书签描述（可从页面 meta 自动填充）..."
        />
        {errors.description && (
          <p className="mt-1 text-xs text-red-600">{errors.description}</p>
        )}
      </div>

      <CategoryTreeSelect
        categories={categories}
        value={value.categoryId || ''}
        onChange={(categoryId) => patch({ categoryId: categoryId || undefined })}
        disabled={disabled}
        categoriesLoaded={categoriesLoaded}
        onCreateCategory={onCreateCategory}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <TagIcon className="w-4 h-4 inline mr-1" />
          标签
        </label>
        <TagInput
          tagIds={value.tagIds || []}
          onTagIdsChange={(tagIds) => patch({ tagIds })}
          disabled={disabled}
          placeholder="添加标签，按回车确认..."
        />
      </div>

      {showNotes && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <StickyNote className="w-4 h-4 inline mr-1" />
            备注（可选）
          </label>
          <textarea
            value={value.notes || ''}
            onChange={(e) => patch({ notes: e.target.value })}
            disabled={disabled}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md resize-none bg-white text-gray-900 focus:ring-primary focus:border-primary"
            placeholder="添加备注..."
          />
        </div>
      )}

      {!isPopup && (
        <p className="text-xs text-gray-500 truncate border-t border-gray-100 pt-2">{domain}</p>
      )}
    </div>
  );

  if (isPopup) {
    if (popupSection === 'preview') {
      return <div className={`bookmark-editor-preview ${className}`}>{cardPreview}</div>;
    }
    if (popupSection === 'form') {
      return <div className={`bookmark-editor-form ${className}`}>{fields}</div>;
    }
    return (
      <div className={`bookmark-editor ${className}`}>
        {cardPreview}
        {fields}
      </div>
    );
  }

  return (
    <div
      className={`bookmark-editor rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden ${className}`}
    >
      {cardPreview}
      {fields}
    </div>
  );
};

export default BookmarkEditor;
