import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { SuspectedDuplicateMatch } from '@/services/deduplication';

interface PopupDuplicateHintProps {
  matches: SuspectedDuplicateMatch[];
  maxVisible?: number;
}

const matchTypeLabel: Record<SuspectedDuplicateMatch['matchType'], string> = {
  exact: '相同 URL',
  similar: '相似页面',
};

const PopupDuplicateHint: React.FC<PopupDuplicateHintProps> = ({
  matches,
  maxVisible = 3,
}) => {
  if (matches.length === 0) return null;

  const visible = matches.slice(0, maxVisible);
  const hiddenCount = matches.length - visible.length;

  return (
    <div
      className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            库中已有 {matches.length} 条疑似重复，仍可继续添加
          </p>
          <ul className="mt-2 space-y-2">
            {visible.map(({ bookmark, matchType }) => (
              <li key={bookmark.id} className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-medium text-amber-800">
                    {matchTypeLabel[matchType]}
                  </span>
                  <span className="truncate text-gray-800" title={bookmark.title}>
                    {bookmark.title}
                  </span>
                </div>
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 block truncate text-xs text-primary hover:text-primary-hover hover:underline"
                  title={bookmark.url}
                >
                  {bookmark.url}
                </a>
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && (
            <p className="mt-1.5 text-xs text-amber-800">
              另有 {hiddenCount} 条未展开，可在主应用「重复检测」中查看
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PopupDuplicateHint;
