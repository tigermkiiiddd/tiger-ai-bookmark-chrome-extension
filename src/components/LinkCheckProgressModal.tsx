import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, Square, BarChart3, Clock, CheckCircle, XCircle, AlertTriangle, Globe, Zap } from 'lucide-react';
import type { CheckProgress, LinkCheckResult } from '../types/index';
import type { DetailedProgress } from '../services/linkChecker/types';

interface LinkCheckProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  isChecking: boolean;
  isPaused: boolean;
  onCheckComplete?: () => void;
}

const LinkCheckProgressModal: React.FC<LinkCheckProgressModalProps> = ({
  isOpen,
  onClose,
  onStart,
  onPause,
  onStop,
  isChecking,
  isPaused,
  onCheckComplete
}) => {
  const [progress, setProgress] = useState<CheckProgress | null>(null);
  const [detailedProgress, setDetailedProgress] = useState<DetailedProgress | null>(null);
  const [recentResults, setRecentResults] = useState<LinkCheckResult[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const completedNotified = useRef(false);

  useEffect(() => {
    if (!isChecking) {
      completedNotified.current = false;
    }
  }, [isChecking]);

  useEffect(() => {
    if (!isOpen || !isChecking) return;

    const pollProgress = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_LINK_CHECK_PROGRESS'
        });
        
        if (response?.success && response.data) {
          const { progress: prog, detailedProgress: detailed, recentResults: recent } =
            response.data;
          setProgress(prog);
          setDetailedProgress(detailed);
          const safeRecent = Array.isArray(recent) ? recent : [];
          if (safeRecent.length > 0) {
            setRecentResults(safeRecent.slice(-5));
            setCurrentUrl(safeRecent[safeRecent.length - 1]?.url || '');
          }
          if (
            (prog?.status === 'completed' || prog?.status === 'error') &&
            !completedNotified.current
          ) {
            completedNotified.current = true;
            onCheckComplete?.();
          }
        }
      } catch (error) {
        console.error('获取进度失败:', error);
      }
    };

    // 立即执行一次
    pollProgress();
    
    // 每500ms轮询一次
    const interval = setInterval(pollProgress, 500);
    return () => clearInterval(interval);
  }, [isOpen, isChecking]);

  const getProgressPercentage = () => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.completed / progress.total) * 100);
  };

  const getElapsedTime = () => {
    if (!progress || !progress.startTime) return '00:00';
    const elapsed = Math.floor((Date.now() - progress.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getEstimatedTimeRemaining = () => {
    if (!progress || !detailedProgress || progress.completed === 0) return '--:--';
    
    const elapsed = Date.now() - progress.startTime;
    const avgTimePerItem = elapsed / progress.completed;
    const remaining = (progress.total - progress.completed) * avgTimePerItem;
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'dead': return <XCircle className="w-3 h-3 text-red-500" />;
      case 'timeout': return <Clock className="w-3 h-3 text-yellow-500" />;
      case 'blocked': return <AlertTriangle className="w-3 h-3 text-orange-500" />;
      default: return <Globe className="w-3 h-3 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '正常';
      case 'dead': return '失效';
      case 'timeout': return '超时';
      case 'blocked': return '被阻止';
      default: return '未知';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                链接检测进度
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {progress ? `${progress.completed} / ${progress.total} 已完成` : '准备开始检测'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          {/* Progress Bar */}
          {progress && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">总体进度</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {getProgressPercentage()}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
            </div>
          )}

          {/* Statistics */}
          {progress && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-400">正常</span>
                </div>
                <div className="text-lg font-bold text-green-900 dark:text-green-300">
                  {progress.active}
                </div>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800 dark:text-red-400">失效</span>
                </div>
                <div className="text-lg font-bold text-red-900 dark:text-red-300">
                  {progress.dead}
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">错误</span>
                </div>
                <div className="text-lg font-bold text-yellow-900 dark:text-yellow-300">
                  {progress.errors}
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-400">速度</span>
                </div>
                <div className="text-lg font-bold text-blue-900 dark:text-blue-300">
                  {detailedProgress?.throughput || 0}/s
                </div>
              </div>
            </div>
          )}

          {/* Time Information */}
          {progress && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">已用时间:</span>
                <span className="font-medium text-gray-900 dark:text-white">{getElapsedTime()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">预计剩余:</span>
                <span className="font-medium text-gray-900 dark:text-white">{getEstimatedTimeRemaining()}</span>
              </div>
            </div>
          )}

          {/* Current URL */}
          {currentUrl && isChecking && (
            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">当前检测:</div>
              <div className="text-sm font-mono text-gray-900 dark:text-white truncate">
                {currentUrl}
              </div>
            </div>
          )}

          {/* Recent Results */}
          {recentResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">最近结果</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {recentResults.map((result, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-gray-900 dark:text-white truncate">
                        {result.url}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {getStatusText(result.status)} • {result.responseTime}ms
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {progress?.status === 'completed' ? '检测完成' : 
             progress?.status === 'error' ? '检测出错' :
             isPaused ? '已暂停' : 
             isChecking ? '检测中...' : '准备就绪'}
          </div>
          
          <div className="flex items-center gap-3">
            {!isChecking ? (
              <button
                onClick={onStart}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                开始检测
              </button>
            ) : (
              <>
                <button
                  onClick={isPaused ? onStart : onPause}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {isPaused ? '继续' : '暂停'}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  停止
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkCheckProgressModal;