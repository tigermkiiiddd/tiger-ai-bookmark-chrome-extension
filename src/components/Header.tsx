import React from 'react';
import { Menu, Settings, Plus, Skull } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  themeIcon: React.ReactNode;
  sidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  onToggleTheme,
  themeIcon,
  sidebarOpen
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const openAddBookmarkPopup = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.action.openPopup();
      }
    });
  };

  return (
    <header className="flex items-center justify-between bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title={sidebarOpen ? '隐藏侧边栏' : '显示侧边栏'}
        >
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 text-primary">
            <svg fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M14.5 3L14.5 12.5L21 12.5L21 21L3 21L3 3L14.5 3Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <path
                d="M14.5 3L9 3C7.34315 3 6 4.34315 6 6L6 21"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            TIGERMARKIII
          </h1>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        <button
          onClick={openAddBookmarkPopup}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md transition-colors"
          title="添加书签"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">添加书签</span>
        </button>

        <button
          onClick={() => navigate('/graveyard')}
          className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors ${location.pathname === '/graveyard' ? 'text-blue-600 dark:text-blue-400' : ''}`}
          title="URL 坟场"
        >
          <Skull className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        <button
          onClick={onToggleTheme}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="切换主题"
        >
          {themeIcon}
        </button>

        <button
          onClick={() => navigate('/settings')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="设置"
        >
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        {/* 用户头像区域 */}
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">T</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
