import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Settings, Grid, List, Search, Moon, Sun, Laptop, Plus } from 'lucide-react';
import { useBookmarkStore } from '../store/index';
import Sidebar from './sidebar';
import Header from './Header';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef(location.pathname);

  const settings = useBookmarkStore(s => s.settings);
  const updateSettings = useBookmarkStore(s => s.updateSettings);
  const sidebarOpen = useBookmarkStore(s => s.sidebarOpen);
  const setSidebarOpen = useBookmarkStore(s => s.setSidebarOpen);
  const savePageState = useBookmarkStore(s => s.savePageState);
  const restorePageState = useBookmarkStore(s => s.restorePageState);

  // Restore scroll position on mount (e.g. after refresh)
  useEffect(() => {
    const currentPath = location.pathname;
    // Wait for content to render before restoring scroll
    const timer = setTimeout(() => {
      const state = restorePageState(currentPath);
      if (mainRef.current && state?.scrollTop !== undefined) {
        mainRef.current.scrollTop = state.scrollTop;
      }
    }, 100);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save/restore scroll position on route change
  useEffect(() => {
    const prevPath = prevPathRef.current;
    const currentPath = location.pathname;

    if (prevPath !== currentPath && mainRef.current) {
      // Save previous page scroll position
      savePageState(prevPath, { scrollTop: mainRef.current.scrollTop });
      prevPathRef.current = currentPath;

      // Restore new page scroll position (after a tick to let content render)
      requestAnimationFrame(() => {
        const state = restorePageState(currentPath);
        if (mainRef.current && state?.scrollTop !== undefined) {
          mainRef.current.scrollTop = state.scrollTop;
        }
      });
    }
  }, [location.pathname, savePageState, restorePageState]);

  // Auto-save scroll position on scroll
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const handleScroll = () => {
      savePageState(location.pathname, { scrollTop: main.scrollTop });
    };

    main.addEventListener('scroll', handleScroll, { passive: true });
    return () => main.removeEventListener('scroll', handleScroll);
  }, [location.pathname, savePageState]);

  // 主题切换
  const toggleTheme = () => {
    const currentTheme = settings.theme;
    let newTheme: 'light' | 'dark' | 'system';

    if (currentTheme === 'light') {
      newTheme = 'dark';
    } else if (currentTheme === 'dark') {
      newTheme = 'system';
    } else {
      newTheme = 'light';
    }

    updateSettings({ theme: newTheme });
  };

  // 应用主题
  useEffect(() => {
    const applyTheme = () => {
      const { theme } = settings;
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (settings.theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.theme]);

  const getThemeIcon = () => {
    switch (settings.theme) {
      case 'light':
        return <Sun className="w-5 h-5" />;
      case 'dark':
        return <Moon className="w-5 h-5" />;
      default:
        return <Laptop className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-96' : 'w-0'
        } flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 overflow-hidden`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleTheme={toggleTheme}
          themeIcon={getThemeIcon()}
          sidebarOpen={sidebarOpen}
        />

        {/* Page Content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;