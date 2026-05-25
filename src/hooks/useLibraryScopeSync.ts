import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBookmarkStore } from '../store';

/**
 * 将 Library 筛选状态与 URL query string 双向同步。
 * 初始化时以 URL 为准（支持分享链接），后续以 store 为准。
 */
export function useLibraryScopeSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialized = useRef(false);

  const searchQuery = useBookmarkStore(s => s.searchQuery);
  const activeFilters = useBookmarkStore(s => s.activeFilters);
  const setSearchQuery = useBookmarkStore(s => s.setSearchQuery);
  const setActiveFilters = useBookmarkStore(s => s.setActiveFilters);

  // 初始化：从 URL 读取并覆盖 store（URL 优先）
  useEffect(() => {
    if (initialized.current) return;

    const q = searchParams.get('q') || '';
    const catParam = searchParams.get('cat');
    const tagParam = searchParams.get('tag');
    const statusParam = searchParams.get('status');

    let nextFilters = { ...activeFilters };
    let hasUrlScope = false;

    if (q) {
      setSearchQuery(q);
      hasUrlScope = true;
    }
    if (catParam) {
      nextFilters = { ...nextFilters, categories: catParam.split(',').filter(Boolean) };
      hasUrlScope = true;
    }
    if (tagParam) {
      nextFilters = { ...nextFilters, tags: tagParam.split(',').filter(Boolean) };
      hasUrlScope = true;
    }
    if (statusParam) {
      nextFilters = { ...nextFilters, status: statusParam.split(',').filter(Boolean) as any };
      hasUrlScope = true;
    }

    if (hasUrlScope) {
      setActiveFilters(nextFilters);
    }

    initialized.current = true;
    // 只在初始化时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步到 URL（replace，不增加历史记录）
  useEffect(() => {
    if (!initialized.current) return;

    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (activeFilters.categories?.length) params.set('cat', activeFilters.categories.join(','));
    if (activeFilters.tags?.length) params.set('tag', activeFilters.tags.join(','));
    if (activeFilters.status?.length) params.set('status', activeFilters.status.join(','));

    setSearchParams(params, { replace: true });
  }, [searchQuery, activeFilters, setSearchParams]);
}
