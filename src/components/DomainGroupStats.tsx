import React, { useState, useEffect } from 'react';
import { DomainGroupStats as DomainGroupStatsType } from '../types';
import { StorageService } from '../services/storage';
import { Globe, BookOpen, TrendingUp, BarChart3 } from 'lucide-react';

interface DomainGroupStatsProps {
  className?: string;
  onDomainClick?: (domain: string) => void;
}

export const DomainGroupStats: React.FC<DomainGroupStatsProps> = ({
  className = '',
  onDomainClick
}) => {
  const [stats, setStats] = useState<DomainGroupStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const storageService = StorageService.getInstance();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await storageService.getDomainGroupResult();
      setStats(result.stats);
    } catch (err) {
      console.error('Failed to load domain group stats:', err);
      setError('加载统计信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDomainClick = (domain: string) => {
    if (onDomainClick) {
      onDomainClick(domain);
    }
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 ${className}`}>
        <div className="text-center text-red-600 dark:text-red-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-red-300 dark:text-red-500" />
          <p>{error}</p>
          <button
            onClick={loadStats}
            className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm ${className}`}>
      {/* 标题 */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">域名分组统计</h2>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* 总分组数 */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">总分组数</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{stats.totalGroups}</p>
              </div>
              <Globe className="w-8 h-8 text-blue-500 dark:text-blue-400" />
            </div>
          </div>

          {/* 总书签数 */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">总书签数</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-200">{stats.totalBookmarks}</p>
              </div>
              <BookOpen className="w-8 h-8 text-green-500 dark:text-green-400" />
            </div>
          </div>

          {/* 平均书签数 */}
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/20 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">平均书签数</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">{stats.averageBookmarksPerGroup}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500 dark:text-purple-400" />
            </div>
          </div>

          {/* 覆盖率 */}
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-900/20 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">分组覆盖率</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">
                  {stats.totalBookmarks > 0
                    ? Math.round((stats.totalBookmarks / stats.totalBookmarks) * 100)
                    : 0}%
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-orange-500 dark:text-orange-400" />
            </div>
          </div>
        </div>

        {/* 热门域名 */}
        {stats.topDomains.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">热门域名 Top 10</h3>
            <div className="space-y-2">
              {stats.topDomains.map((domainStat, index) => {
                const percentage = stats.totalBookmarks > 0
                  ? (domainStat.count / stats.totalBookmarks) * 100
                  : 0;

                return (
                  <div
                    key={domainStat.domain}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    onClick={() => handleDomainClick(domainStat.domain)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">
                        {index + 1}
                      </div>
                      <div className="flex items-center space-x-2">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domainStat.domain}&sz=16`}
                          alt={`${domainStat.domain} favicon`}
                          className="w-4 h-4 rounded"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                        <span className="font-medium text-gray-900 dark:text-white">{domainStat.domain}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{domainStat.count} 个书签</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{percentage.toFixed(1)}%</p>
                      </div>

                      {/* 进度条 */}
                      <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 刷新按钮 */}
        <div className="mt-6 text-center">
          <button
            onClick={loadStats}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            刷新统计
          </button>
        </div>
      </div>
    </div>
  );
};

export default DomainGroupStats;