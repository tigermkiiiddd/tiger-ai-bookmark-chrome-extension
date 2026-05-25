import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useBookmarkStore } from '../store';

export function usePageState() {
  const location = useLocation();
  const savePageState = useBookmarkStore(s => s.savePageState);
  const restorePageState = useBookmarkStore(s => s.restorePageState);
  const recordPageNavigation = useBookmarkStore(s => s.recordPageNavigation);
  const pathRef = useRef(location.pathname);

  const save = useCallback(
    (extraState?: Record<string, unknown>) => {
      savePageState(location.pathname, extraState ?? {});
    },
    [location.pathname, savePageState]
  );

  const restore = useCallback(() => {
    return restorePageState(location.pathname);
  }, [location.pathname, restorePageState]);

  // Record navigation when path changes
  useEffect(() => {
    const prevPath = pathRef.current;
    const currentPath = location.pathname;
    if (prevPath !== currentPath) {
      recordPageNavigation(prevPath, currentPath);
      pathRef.current = currentPath;
    }
  }, [location.pathname, recordPageNavigation]);

  return { save, restore, path: location.pathname };
}
