import React from 'react';
import { useBookmarkStore } from '../../store';
import { isBookmarkArchived } from '../../utils/bookmarkArchive';
import type { StatusFilterValue } from '../../types/index';
import { STATUS_FILTER_LABELS } from '../../utils/statusFilter';

const STATUS_OPTIONS: {
  id: StatusFilterValue;
  dotClass: string;
}[] = [
  {
    id: 'unarchived',
    dotClass: 'bg-slate-400',
  },
  {
    id: 'active',
    dotClass: 'bg-green-500',
  },
  {
    id: 'archived',
    dotClass: 'bg-yellow-500',
  },
  {
    id: 'site_dead',
    dotClass: 'bg-orange-500',
  },
  {
    id: 'page_dead',
    dotClass: 'bg-red-500',
  }
];

const StatusFilters: React.FC = () => {
  const activeFilters = useBookmarkStore(s => s.activeFilters);
  const setActiveFilters = useBookmarkStore(s => s.setActiveFilters);
  const bookmarks = useBookmarkStore(s => s.bookmarks);

  const stats = React.useMemo(() => {
    let unarchived = 0;
    let active = 0;
    let archived = 0;
    let siteDead = 0;
    let pageDead = 0;
    for (const b of bookmarks) {
      if (isBookmarkArchived(b)) {
        archived++;
      } else {
        unarchived++;
        if (b.status === 'dead') {
          if (b.linkFailureType === 'site_dead') siteDead++;
          else pageDead++;
        } else if (b.status === 'active') {
          active++;
        }
      }
    }
    return { unarchived, active, archived, siteDead, pageDead };
  }, [bookmarks]);

  const counts: Record<StatusFilterValue, number> = {
    unarchived: stats.unarchived,
    active: stats.active,
    archived: stats.archived,
    dead: stats.siteDead + stats.pageDead,
    site_dead: stats.siteDead,
    page_dead: stats.pageDead
  };

  const currentStatus = activeFilters.status || [];

  const toggleStatus = (id: StatusFilterValue) => {
    const next = currentStatus.includes(id)
      ? currentStatus.filter(s => s !== id)
      : [...currentStatus, id];
    setActiveFilters({ ...activeFilters, status: next });
  };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {currentStatus.length > 0 && (
          <button
            onClick={() => setActiveFilters({ ...activeFilters, status: [] })}
            className="flex-shrink-0 px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            全部
          </button>
        )}
        {STATUS_OPTIONS.map(({ id, dotClass }) => {
          const isActive = currentStatus.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggleStatus(id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
              <span>{STATUS_FILTER_LABELS[id]}</span>
              <span className={`text-[10px] ${isActive ? 'text-gray-300 dark:text-gray-500' : 'text-gray-400 dark:text-gray-500'}`}>
                {counts[id]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StatusFilters;
