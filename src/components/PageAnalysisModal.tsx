import React, { useState, useEffect } from 'react';
import { X, Globe, Clock, Code, FileText, Eye, Zap, Languages, Calendar } from 'lucide-react';
import type { PageAnalysis } from '../types/index';
import { fetchPageAnalysis } from '../services/pageAnalysisService';
import { getRuntimeLocaleTag, t } from '../i18n';

interface PageAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  url?: string;
  /** Popup 已提取的结构数据，避免重复请求 */
  initialPageAnalysis?: PageAnalysis;
}

const PageAnalysisModal: React.FC<PageAnalysisModalProps> = ({
  isOpen,
  onClose,
  url,
  initialPageAnalysis,
}) => {
  const [pageData, setPageData] = useState<PageAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialPageAnalysis) {
      setPageData(initialPageAnalysis);
      setError(null);
      setIsLoading(false);
      return;
    }
    if (url) {
      analyzeCurrentPage();
    }
  }, [isOpen, url, initialPageAnalysis]);

  const analyzeCurrentPage = async () => {
    setIsLoading(true);
    setError(null);

    const result = await fetchPageAnalysis();
    if (result.success && result.data) {
      setPageData(result.data);
    } else {
      setError(result.error || t('pageAnalysisFailed'));
    }

    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 bg-black/50 backdrop-blur-sm">
      <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('pageAnalysisTitle')}
            </h2>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">{t('pageAnalysisLoading')}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
              <p>{error}</p>
              <button
                onClick={analyzeCurrentPage}
                className="mt-2 text-sm text-red-700 hover:text-red-800 underline"
              >
                {t('pageAnalysisRetry')}
              </button>
            </div>
          )}

          {pageData && (
            <div className="space-y-6">
              {/* 基本信息 */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  {t('pageAnalysisBasicInfo')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisPageTitle')}</span>
                    <p className="text-gray-900 dark:text-white mt-1">{pageData.title}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisDomain')}</span>
                    <p className="text-gray-900 dark:text-white mt-1">{pageData.siteInfo?.domain}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisSiteType')}</span>
                    <p className="text-gray-900 dark:text-white mt-1">{pageData.siteInfo?.siteType}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisSiteName')}</span>
                    <p className="text-gray-900 dark:text-white mt-1">{pageData.siteInfo?.siteName}</p>
                  </div>
                </div>
              </div>

              {/* 内容特征 */}
              {pageData.contentFeatures && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {t('pageAnalysisContentFeatures')}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {pageData.contentFeatures.wordCount}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{t('pageAnalysisWordCount')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {pageData.contentStructure?.estimatedReadingTime}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{t('pageAnalysisReadMinutes')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {pageData.contentFeatures.imageCount}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{t('pageAnalysisImageCount')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {pageData.contentFeatures.linkCount}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{t('pageAnalysisLinkCount')}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 内容结构 */}
              {pageData.contentStructure && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    {t('pageAnalysisStructure')}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {pageData.contentStructure.headings && (
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisHeadingStructure')}</span>
                        <div className="mt-1">
                          {Object.entries(pageData.contentStructure.headings)
                            .filter(([key, value]) => key !== 'texts' && (value as number) > 0)
                            .map(([level, count]) => (
                              <div key={level} className="flex justify-between">
                                <span className="text-gray-700 dark:text-gray-300">{level.toUpperCase()}:</span>
                                <span className="text-gray-900 dark:text-white">{count as number}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisSpecialElements')}</span>
                      <div className="mt-1 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-700 dark:text-gray-300">{t('pageAnalysisTables')}</span>
                          <span className="text-gray-900 dark:text-white">{pageData.contentStructure.tables}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700 dark:text-gray-300">{t('pageAnalysisForms')}</span>
                          <span className="text-gray-900 dark:text-white">{pageData.contentStructure.forms}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700 dark:text-gray-300">{t('pageAnalysisVideos')}</span>
                          <span className="text-gray-900 dark:text-white">{pageData.contentStructure.videos}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisInteractiveFeatures')}</span>
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${pageData.contentStructure.hasComments ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('pageAnalysisComments')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${pageData.contentStructure.hasShareButtons ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('pageAnalysisShareButtons')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${pageData.contentStructure.hasNavigation ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('pageAnalysisNavigation')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 技术信息 */}
              {pageData.technicalInfo && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    {t('pageAnalysisTechnicalFeatures')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisFrameworks')}</span>
                      <div className="mt-1">
                        {(pageData.technicalInfo.frameworks || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(pageData.technicalInfo.frameworks || []).map(framework => (
                              <span key={framework} className="px-2 py-1 bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-xs rounded">
                                {framework}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">{t('pageAnalysisNotDetected')}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisPageAttributes')}</span>
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${pageData.technicalInfo.isResponsive ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('pageAnalysisResponsive')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${pageData.siteInfo?.isSecure ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('pageAnalysisHttps')}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisResourceStats')}</span>
                      <div className="mt-1 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-700 dark:text-gray-300">{t('pageAnalysisScripts')}</span>
                          <span className="text-gray-900 dark:text-white">{pageData.technicalInfo.scripts}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700 dark:text-gray-300">{t('pageAnalysisStylesheets')}</span>
                          <span className="text-gray-900 dark:text-white">{pageData.technicalInfo.stylesheets}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 语言和时间信息 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 语言信息 */}
                {pageData.languageInfo && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Languages className="w-5 h-5" />
                      {t('pageAnalysisLanguageInfo')}
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisDetectedLanguage')}</span>
                        <p className="text-gray-900 dark:text-white">{pageData.languageInfo.detectedLanguage === 'zh' ? t('pageLanguageZh') : t('pageLanguageEn')}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisHtmlLanguage')}</span>
                        <p className="text-gray-900 dark:text-white">{pageData.languageInfo.htmlLang || t('pageAnalysisNotSet')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${pageData.languageInfo.isMultilingual ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{t('pageAnalysisMultilingual')}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 时间信息 */}
                {pageData.timeInfo && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      {t('pageAnalysisTimeInfo')}
                    </h3>
                    <div className="space-y-2">
                      {pageData.timeInfo.publishedTime && (
                        <div>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisPublishedTime')}</span>
                          <p className="text-gray-900 dark:text-white">
                            {new Date(pageData.timeInfo.publishedTime).toLocaleDateString(getRuntimeLocaleTag())}
                          </p>
                        </div>
                      )}
                      {pageData.timeInfo.modifiedTime && (
                        <div>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisModifiedTime')}</span>
                          <p className="text-gray-900 dark:text-white">
                            {new Date(pageData.timeInfo.modifiedTime).toLocaleDateString(getRuntimeLocaleTag())}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisExtractedTime')}</span>
                        <p className="text-gray-900 dark:text-white">
                          {pageData.timeInfo.extractedAt ? new Date(pageData.timeInfo.extractedAt).toLocaleString(getRuntimeLocaleTag()) : t('pageAnalysisUnknown')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SEO元数据 */}
              {pageData.seoMetadata && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    {t('pageAnalysisSeoMetadata')}
                  </h3>
                  <div className="space-y-3">
                    {pageData.seoMetadata.description && (
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisPageDescription')}</span>
                        <p className="text-gray-900 dark:text-white mt-1 text-sm">{pageData.seoMetadata.description}</p>
                      </div>
                    )}
                    {pageData.seoMetadata.keywords && pageData.seoMetadata.keywords.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisKeywords')}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {pageData.seoMetadata.keywords.map((keyword, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs rounded">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {pageData.seoMetadata.author && (
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('pageAnalysisAuthor')}</span>
                        <p className="text-gray-900 dark:text-white">{pageData.seoMetadata.author}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={analyzeCurrentPage}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {t('pageAnalysisReanalyze')}
          </button>
          
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-md transition-colors"
          >
            {t('pageAnalysisClose')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PageAnalysisModal;
