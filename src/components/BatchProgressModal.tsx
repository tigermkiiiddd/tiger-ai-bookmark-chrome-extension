import React from 'react';
import { useBookmarkStore } from '../store';
import { Play, Pause, X, Clock, AlertCircle, CheckCircle } from 'lucide-react';

export const BatchProgressModal: React.FC = () => {
  const { 
    aiArchiveProgress,
    lastBatchResult,
    clearLastBatchResult,
    pauseArchive,
    resumeArchive,
    cancelArchive
  } = useBookmarkStore(state => ({
    aiArchiveProgress: state.aiArchiveProgress,
    lastBatchResult: state.lastBatchResult,
    clearLastBatchResult: state.clearLastBatchResult,
    pauseArchive: state.pauseArchive,
    resumeArchive: state.resumeArchive,
    cancelArchive: state.cancelArchive
  }));

  // 格式化时间显示
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  // 格式化处理速度
  const formatSpeed = (startTime: number, processed: number): string => {
    if (!startTime || processed === 0) return '计算中...';
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = processed / elapsed;
    return `${speed.toFixed(1)} 个/分钟`;
  };

  const showModal = aiArchiveProgress?.isActive || lastBatchResult;

  if (!showModal) {
    return null;
  }

  const renderProgress = () => {
    if (!aiArchiveProgress || (aiArchiveProgress?.total || 0) === 0) return null;
    
    const { current, total, currentBookmark, successCount, failureCount, skippedCount, 
            isPaused, startTime, estimatedTimeRemaining, errors } = aiArchiveProgress;
    
    const percentage = Math.round(((current || 0) / (total || 1)) * 100);
    const processed = (current || 0);
    
    return (
      <div className="p-6">
        {/* 标题和状态 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            AI 智能归档进行中
          </h3>
          <div className="flex items-center space-x-2">
            {isPaused ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                <Pause className="w-3 h-3 mr-1" />
                已暂停
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <Play className="w-3 h-3 mr-1" />
                处理中
              </span>
            )}
          </div>
        </div>

        {/* 当前处理项目 */}
        {currentBookmark && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">正在处理:</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {currentBookmark}
            </p>
          </div>
        )}

        {/* 进度条 */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>进度: {processed} / {total}</span>
            <span>{percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${
                isPaused ? 'bg-yellow-500' : 'bg-blue-600'
              }`} 
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-lg font-semibold text-green-600">{successCount || 0}</span>
            </div>
            <p className="text-xs text-gray-500">成功</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
              <span className="text-lg font-semibold text-red-600">{failureCount || 0}</span>
            </div>
            <p className="text-xs text-gray-500">失败</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <span className="text-lg font-semibold text-gray-600">{skippedCount || 0}</span>
            </div>
            <p className="text-xs text-gray-500">跳过</p>
          </div>
        </div>

        {/* 时间信息 */}
        {startTime && (
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              <span>处理速度: {formatSpeed(startTime, processed)}</span>
            </div>
            {estimatedTimeRemaining > 0 && (
              <span>预计剩余: {formatTime(estimatedTimeRemaining)}</span>
            )}
          </div>
        )}

        {/* 错误信息 */}
        {errors && errors.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              错误详情 ({errors.length})
            </h4>
            <div className="max-h-32 overflow-y-auto bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              {errors.map((err, index) => (
                <div key={index} className="text-xs text-red-600 dark:text-red-400 mb-1">
                  <span className="font-medium">{(err as any).bookmarkTitle || err.bookmarkId}</span>: {err.message}
                  {err.retryCount > 0 && (
                    <span className="ml-2 text-red-500">(重试 {err.retryCount} 次)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 控制按钮 */}
        <div className="flex justify-center space-x-3">
          {isPaused ? (
            <button
              onClick={resumeArchive}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <Play className="w-4 h-4 mr-2" />
              继续
            </button>
          ) : (
            <button
              onClick={pauseArchive}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              <Pause className="w-4 h-4 mr-2" />
              暂停
            </button>
          )}
          <button
            onClick={cancelArchive}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4 mr-2" />
            取消
          </button>
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    if (!lastBatchResult) return null;
    
    const { total, successCount, failureCount, skippedCount, errors, duration } = lastBatchResult;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;
    
    return (
      <div className="p-6">
        {/* 完成标题 */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">
                批量归档完成
              </h3>
              <p className="text-sm text-gray-500">
                成功率: {successRate}%
              </p>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="w-6 h-6 text-green-500 mr-2" />
              <span className="text-2xl font-bold text-green-600">{successCount}</span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300">成功归档</p>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertCircle className="w-6 h-6 text-red-500 mr-2" />
              <span className="text-2xl font-bold text-red-600">{failureCount}</span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300">处理失败</p>
          </div>
          
          {skippedCount > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center col-span-2">
              <div className="flex items-center justify-center mb-2">
                <span className="text-2xl font-bold text-gray-600">{skippedCount}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">跳过处理</p>
            </div>
          )}
        </div>

        {/* 处理时间 */}
        {duration && (
          <div className="flex items-center justify-center mb-4 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4 mr-2" />
            <span>总耗时: {formatTime(duration)}</span>
          </div>
        )}

        {/* 错误详情 */}
        {errors && errors.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-red-600 mb-3 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              失败详情 ({errors.length} 项)
            </h4>
            <div className="max-h-40 overflow-y-auto bg-red-50 dark:bg-red-900/20 rounded-lg p-4 space-y-2">
              {errors.map((err, index) => (
                <div key={index} className="border-l-2 border-red-300 pl-3">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    {(err as any).bookmarkTitle || `书签 ${err.bookmarkId}`}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {err.message}
                  </p>
                  {(err as any).retryCount > 0 && (
                    <p className="text-xs text-red-500">
                      已重试 {(err as any).retryCount} 次
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 操作建议 */}
        {failureCount > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-500 mr-2 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  处理建议
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  部分书签处理失败，建议检查网络连接或稍后重试失败的项目。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 关闭按钮 */}
        <div className="flex justify-center">
          <button
            onClick={clearLastBatchResult}
            className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            完成
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full">
        {aiArchiveProgress?.isActive ? renderProgress() : renderSummary()}

      </div>
    </div>
  );
};