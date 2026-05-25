/**
 * 通用加载组件
 * 提供统一的加载状态显示
 */

import React from 'react';

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  text,
  fullScreen = false,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };
  
  const spinner = (
    <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]} ${className}`}>
      <span className="sr-only">加载中...</span>
    </div>
  );
  
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-75">
        <div className="flex flex-col items-center space-y-4">
          {spinner}
          {text && (
            <p className="text-sm text-gray-600">{text}</p>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center space-y-4">
      {spinner}
      {text && (
        <p className="text-sm text-gray-600">{text}</p>
      )}
    </div>
  );
};

/**
 * 内联加载组件
 * 用于按钮或小区域的加载状态
 */
export const InlineLoading: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 h-4 w-4 ${className}`}>
    <span className="sr-only">加载中...</span>
  </div>
);
