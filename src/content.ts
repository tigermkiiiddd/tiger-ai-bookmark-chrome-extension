import type { PageAnalysis, ChromeMessage } from './types/index';

declare global {
  interface Window {
    tigermarkContentScriptLoaded?: boolean;
  }
}

// Content Script - 网页内容提取
if (!window.tigermarkContentScriptLoaded) {
  window.tigermarkContentScriptLoaded = true;

  (async () => {

    class PageContentExtractor {
      private static instance: PageContentExtractor;
      private initialized: boolean = false;
      private initializationAttempts: number = 0;
      private maxInitializationAttempts: number = 3;

      public static getInstance(): PageContentExtractor {
        if (!PageContentExtractor.instance) {
          PageContentExtractor.instance = new PageContentExtractor();
        }
        return PageContentExtractor.instance;
      }

      private constructor() {
        // 延迟初始化以确保页面完全加载
        if (document.readyState === 'complete') {
          setTimeout(() => this.init(), 100);
        } else {
          window.addEventListener('load', () => {
            setTimeout(() => this.init(), 100);
          });
        }
      }

      private async init(): Promise<void> {
        // 限制初始化尝试次数
        if (this.initializationAttempts >= this.maxInitializationAttempts) {
          console.warn('TIGERMARKIII Content Script 初始化尝试次数已达上限');
          return;
        }
        
        this.initializationAttempts++;
        
        try {
          // 检查是否已经初始化过
          if (this.initialized) {
            console.log('TIGERMARKIII Content Script 已经初始化，跳过重复初始化');
            return;
          }
          
          // 标记为已初始化
          this.initialized = true;
          
          // 监听来自popup的消息
          chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
            console.log('Content Script 收到消息:', message.type);
            
            try {
              if (message.type === 'PING') {
                // 健康检查响应 - 增强版
                sendResponse({
                  success: true, 
                  message: 'Content Script is ready',
                  timestamp: Date.now(),
                  url: window.location.href,
                  initialized: this.initialized
                });
              } else if (message.type === 'ANALYZE_PAGE') {
                console.log('开始页面分析...');
                const analysis = this.extractPageContent();
                console.log('页面分析完成:', analysis);
                sendResponse({ success: true, data: analysis });
              } else if (message.type === 'GET_PAGE_INFO') {
                console.log('获取页面信息...');
                // 同步提取 metadata，不等截图，立即返回
                const seo = this.extractSEOMetadata();
                const ogDescription =
                  document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                  document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ||
                  undefined;
                const ogImage =
                  document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                  document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
                  undefined;

                let description =
                  seo?.description?.trim() ||
                  ogDescription?.trim() ||
                  undefined;
                if (!description) {
                  const firstParagraph = document.querySelector(
                    'article p, main p, [role="main"] p, .content p, p'
                  );
                  const excerpt = firstParagraph?.textContent?.trim();
                  if (excerpt && excerpt.length > 20) {
                    description = excerpt.slice(0, 280);
                  }
                }

                sendResponse({ success: true, data: {
                  title: this.extractTitle(),
                  url: window.location.href,
                  favicon: this.getFaviconUrl(),
                  description,
                  image: ogImage,
                }});
              } else if (message.type === 'AUTO_ANALYZE') {
                console.log('自动分析已禁用，请手动触发AI分析');
                sendResponse({ success: false, error: '自动分析已禁用' });
              } else if (message.type === 'GET_PAGE_SNAPSHOT') {
                console.log('获取页面快照（用于截图fallback）...');
                // 尝试使用html2canvas或其他方法获取页面截图
                this.capturePageScreenshot()
                  .then(screenshot => {
                    if (screenshot) {
                      console.log('Content script截图成功');
                      sendResponse({
                        success: true, 
                        screenshot: screenshot,
                        metadata: {
                          timestamp: Date.now(),
                          url: window.location.href,
                          title: document.title,
                          method: 'content_script'
                        }
                      });
                    } else {
                      console.log('Content script截图失败');
                      sendResponse({ success: false, error: 'Screenshot capture failed' });
                    }
                  })
                  .catch(error => {
                    console.error('Content script截图出错:', error);
                    sendResponse({ success: false, error: (error as Error).message });
                  });
                return true; // 保持消息通道开放
              } else {
                console.warn('未知消息类型:', message.type);
                sendResponse({ success: false, error: 'Unknown message type' });
              }
            } catch (error) {
              console.error('Content Script 处理消息时出错:', error);
              sendResponse({ success: false, error: (error as Error).message });
            }
            
            return true; // 保持消息通道开放
          });

          // AI分析功能已改为手动触发，移除自动分析逻辑

          console.log('TIGERMARKIII Content Script 初始化完成');
        } catch (error) {
          console.error('TIGERMARKIII Content Script 初始化失败:', error);
          // 重置初始化状态，允许重试
          window.tigermarkContentScriptLoaded = false;
          this.initialized = false;
        }
      }

      /**
       * 提取当前页面的主要内容（增强版）
       */
      public extractPageContent(): PageAnalysis {
        const url = window.location.href;
        const title = this.extractTitle();
        const images = this.extractImages();
        const mainImage = this.extractMainImage(images);
        
        // 新增：提取更多结构化数据
        const enhancedData = this.extractEnhancedPageData();
        const content = this.buildAIContent(
          this.extractMainContent(),
          enhancedData.navigationContext
        );

        return {
          url,
          title,
          content,
          images,
          mainImage,
          ...enhancedData
        };
      }

      /**
       * 提取页面标题
       */
      private extractTitle(): string {
        // 优先使用页面标题
        let title = document.title;
        
        // 尝试从Open Graph标签获取
        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
        if (ogTitle) {
          title = ogTitle;
        }

        // 尝试从Twitter Card获取
        const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
        if (twitterTitle) {
          title = twitterTitle;
        }

        // 尝试从h1标签获取
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent && h1.textContent.length < title.length) {
          title = h1.textContent;
        }

        return title.trim();
      }

      /**
       * 提取页面主要内容（增强版）
       */
      private extractMainContent(): string {
        let content = '';

        // 尝试多种方法提取主要内容
        const contentSelectors = [
          'main',
          'article',
          '[role="main"]',
          '.main-content',
          '.content',
          '.article-content',
          '.post-content',
          '.entry-content',
          '#content',
          '#main',
          '.post-body',  // 博客文章主体
          '.article-body',  // 文章主体
          '.news-content',  // 新闻内容
          '.document-content'  // 文档内容
        ];

        let mainElement: Element | null = null;

        // 寻找主要内容容器
        for (const selector of contentSelectors) {
          const element = document.querySelector(selector);
          if (element && this.hasSubstantialText(element)) {
            mainElement = element;
            break;
          }
        }

        // 如果没找到明显的内容容器，使用智能选择策略
        if (!mainElement) {
          mainElement = this.findMainContentElement();
        }

        // 提取文本内容
        if (mainElement) {
          content = this.extractTextFromElement(mainElement);
        }

        // 添加meta描述作为补充
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content');
        if (metaDescription) {
          content = metaDescription + '\n\n' + content;
        }

        return content.trim().substring(0, 8000); // 增加长度限制以获取更多内容
      }

      /**
       * 智能查找主要内容元素
       */
      private findMainContentElement(): Element | null {
        // 获取所有可能包含主要内容的元素
        const candidates = Array.from(document.querySelectorAll('div, section, article'));
        
        // 过滤掉导航、侧边栏、页脚等元素
        const filteredCandidates = candidates.filter(element => {
          const excludeSelectors = [
            'nav', 'header', 'footer', 'aside', 'sidebar',
            '.nav', '.header', '.footer', '.aside', '.sidebar',
            '.menu', '.navigation', '.comments', '.ads', '.advertisement'
          ];
          
          return !excludeSelectors.some(selector => 
            element.matches(selector) || element.closest(selector)
          );
        });
        
        // 根据文本长度排序，选择文本最多且合理的元素
        const rankedCandidates = filteredCandidates
          .map(element => ({
            element,
            textLength: this.extractTextFromElement(element).length,
            paragraphCount: element.querySelectorAll('p').length
          }))
          .filter(item => item.textLength > 100 && item.paragraphCount > 0)
          .sort((a, b) => b.textLength - a.textLength);
        
        // 返回文本最多的元素
        return rankedCandidates.length > 0 ? rankedCandidates[0].element : document.body;
      }

      private buildAIContent(mainContent: string, navigationContext?: any): string {
        const navigationLines = this.formatNavigationContext(navigationContext);
        if (navigationLines.length === 0) {
          return mainContent;
        }

        const navigationBlock = [
          '[Navigation Context]',
          ...navigationLines,
          '',
          '[Main Content]'
        ].join('\n');

        return `${navigationBlock}\n${mainContent}`.trim().substring(0, 8000);
      }

      private formatNavigationContext(navigationContext?: any): string[] {
        if (!navigationContext) return [];

        const lines: string[] = [];
        const addList = (label: string, values?: string[]) => {
          const cleanValues = Array.isArray(values)
            ? values.map(value => value.trim()).filter(Boolean)
            : [];
          if (cleanValues.length > 0) {
            lines.push(`${label}: ${cleanValues.join(' > ')}`);
          }
        };

        addList('Top nav', navigationContext.topNav);
        addList('Breadcrumbs', navigationContext.breadcrumbs);
        addList('Sidebar nav', navigationContext.sidebarNav);
        addList('Footer nav', navigationContext.footerNav);

        if (navigationContext.activeSection) {
          lines.push(`Active section: ${navigationContext.activeSection}`);
        }

        return lines;
      }

      /**
       * 从元素中提取纯文本（增强版）
       */
      private extractTextFromElement(element: Element): string {
        const clone = element.cloneNode(true) as Element;
        
        // 移除不需要的元素
        const elementsToRemove = [
          'script', 'style', 'nav', 'header', 'footer', 
          'aside', 'advertisement', '.ad', '.ads', 
          '.navigation', '.menu', '.sidebar', '.comments',
          '.social-share', '.related-posts', '.breadcrumb',
          '.pagination', '.tags', '.meta', '.author-info',
          '.post-info', '.article-info', '.timestamp'
        ];

        elementsToRemove.forEach(selector => {
          clone.querySelectorAll(selector).forEach(el => el.remove());
        });

        // 特殊处理：保留标题和列表，但清理样式
        const headings = clone.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach(heading => {
          // 保留标题文本，但移除可能的图标或其他装饰元素
          const text = heading.textContent?.trim() || '';
          if (text) {
            heading.innerHTML = text;
          }
        });

        const lists = clone.querySelectorAll('ul, ol');
        lists.forEach(list => {
          // 简化列表结构，只保留文本
          const items = list.querySelectorAll('li');
          items.forEach(item => {
            const text = item.textContent?.trim() || '';
            if (text) {
              item.innerHTML = text;
            }
          });
        });

        // 获取纯文本
        let text = clone.textContent || '';
        
        // 清理文本
        text = text
          .replace(/\s+/g, ' ') // 合并多个空格
          .replace(/\n\s*\n/g, '\n\n') // 合并多个换行
          .trim();

        return text;
      }

      /**
       * 检查元素是否包含实质性文本
       */
      private hasSubstantialText(element: Element): boolean {
        const text = element.textContent || '';
        const wordCount = text.trim().split(/\s+/).length;
        return wordCount > 50; // 至少50个单词
      }

      /**
       * 提取页面图片
       */
      private extractImages(): string[] {
        const images: string[] = [];
        const imageElements = document.querySelectorAll('img');

        imageElements.forEach(img => {
          const src = img.src || img.dataset.src || img.dataset.lazy;
          if (src && this.isValidImageUrl(src)) {
            // 转换相对URL为绝对URL
            try {
              const absoluteUrl = new URL(src, window.location.href).href;
              images.push(absoluteUrl);
            } catch {
              // 忽略无效的URL
            }
          }
        });

        // 去重并返回
        return [...new Set(images)];
      }

      /**
       * 提取主要图片
       */
      private extractMainImage(images: string[]): string | undefined {
        // 优先使用Open Graph图片
        const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        if (ogImage) {
          try {
            return new URL(ogImage, window.location.href).href;
          } catch {
            // 忽略无效的URL
          }
        }

        // 尝试Twitter卡片图片
        const twitterImage = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
        if (twitterImage) {
          try {
            return new URL(twitterImage, window.location.href).href;
          } catch {
            // 忽略无效的URL
          }
        }

        // 寻找文章内的主要图片
        const heroSelectors = [
          '.hero img',
          '.featured-image img', 
          '.article-image img',
          '.post-image img',
          'main img:first-of-type',
          'article img:first-of-type'
        ];

        for (const selector of heroSelectors) {
          const img = document.querySelector(selector) as HTMLImageElement;
          if (img && this.isValidImageUrl(img.src)) {
            try {
              return new URL(img.src, window.location.href).href;
            } catch {
              continue;
            }
          }
        }

        // 如果都没找到，使用第一张有效图片
        return images.find(img => this.isValidImageUrl(img));
      }

      /**
       * 验证图片URL是否有效
       */
      private isValidImageUrl(url: string): boolean {
        if (!url) return false;
        
        // 排除常见的无用图片
        const excludePatterns = [
          /1x1\.gif/i,
          /blank\.gif/i,
          /spacer\.gif/i,
          /pixel\.png/i,
          /tracking/i,
          /analytics/i,
          /avatar.*default/i,
          /data:image/i // 排除base64图片
        ];

        return !excludePatterns.some(pattern => pattern.test(url));
      }

      /**
       * 获取页面快照信息（用于快速添加书签）
       */
      public async getPageSnapshot(): Promise<{
        title: string;
        url: string;
        favicon: string;
        description?: string;
        image?: string;
        screenshot?: string;
      }> {
        let screenshot: string | undefined;
        try {
          screenshot = await this.capturePageScreenshot();
        } catch {
          // 截图失败不影响 meta 提取
        }
        const seo = this.extractSEOMetadata();
        const ogImage =
          document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
          document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
          undefined;

        const ogDescription =
          document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
          document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ||
          undefined;

        let description =
          seo?.description?.trim() ||
          ogDescription?.trim() ||
          undefined;

        if (!description) {
          const firstParagraph = document.querySelector(
            'article p, main p, [role="main"] p, .content p, p'
          );
          const excerpt = firstParagraph?.textContent?.trim();
          if (excerpt && excerpt.length > 20) {
            description = excerpt.slice(0, 280);
          }
        }

        return {
          title: this.extractTitle(),
          url: window.location.href,
          favicon: this.getFaviconUrl(),
          description,
          // 书签预览优先用整页截图；og:image 常为站点 logo 小图
          image: screenshot || ogImage,
          screenshot,
        };
      }

      /**
       * 捕获页面截图
       */
      private async capturePageScreenshot(): Promise<string | undefined> {
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'CAPTURE_ACTIVE_TAB',
            payload: {},
          });
          if (response?.success && response.data) {
            return response.data;
          }
          return undefined;
        } catch (error) {
          console.error('截图失败:', error);
          return undefined;
        }
      }

      /**
       * 执行自动分析（核心AI功能）
       */
      // performAutoAnalysis方法已移除 - AI分析改为手动触发

      /**
       * 显示分析结果通知
       */
      private showAnalysisNotification(analysis: any): void {
        // 创建一个简单的通知显示分析结果
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #2196F3;
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          max-width: 300px;
          opacity: 0;
          transform: translateX(100%);
          transition: all 0.3s ease;
        `;
        
        notification.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 4px;">🤖 TIGERMARK AI分析完成</div>
          <div>标签: ${analysis.tags.slice(0, 3).join(', ')}</div>
          <div>分类: ${analysis.category}</div>
        `;
        
        document.body.appendChild(notification);
        
        // 动画显示
        setTimeout(() => {
          notification.style.opacity = '1';
          notification.style.transform = 'translateX(0)';
        }, 100);
        
        // 3秒后自动隐藏
        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transform = 'translateX(100%)';
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 300);
        }, 3000);
      }

      /**
       * 检测系统语言
       */
      private detectSystemLanguage(): string {
        // 优先使用浏览器语言设置
        const browserLang = navigator.language || (navigator as any).userLanguage;
        
        // 检查页面语言
        const htmlLang = document.documentElement.lang;
        
        // 检查内容语言
        const contentLang = this.detectDominantLanguage(document.body.textContent || '');
        
        // 优先级：页面语言 > 浏览器语言 > 内容检测
        if (htmlLang && htmlLang.startsWith('zh')) return 'zh';
        if (browserLang && browserLang.startsWith('zh')) return 'zh';
        if (contentLang === 'zh') return 'zh';
        
        return 'en'; // 默认英文
      }

      /**
       * 提取增强的页面数据（优化版 - 更关注内容特征）
       */
      private extractEnhancedPageData(): any {
        const navigationContext = this.extractNavigationContext();

        return {
          // 内容特征（对AI分类最有用）
          contentFeatures: this.extractContentFeatures(),
          
          // 页面结构信息
          contentStructure: this.extractContentStructure(),
          navigationContext,
          
          // SEO元数据
          seoMetadata: this.extractSEOMetadata(),
          
          // 网站基本信息
          siteInfo: this.extractSiteInfo(),
          
          // 时间信息
          timeInfo: this.extractTimeInfo()
        };
      }

      private extractNavigationContext(): any {
        const topNav = this.extractLinkTexts(
          'header nav a, nav a, [role="navigation"] a, .nav a, .navigation a, .menu a',
          12
        );
        const breadcrumbs = this.extractLinkTexts(
          '.breadcrumb a, .breadcrumbs a, [aria-label*="breadcrumb" i] a, nav[aria-label*="breadcrumb" i] a',
          8
        );
        const sidebarNav = this.extractLinkTexts(
          'aside nav a, .sidebar a, [class*="sidebar"] a, [class*="toc"] a, .table-of-contents a',
          10
        );
        const footerNav = this.extractLinkTexts('footer a', 8);
        const activeSection = this.extractActiveNavigationText();

        return {
          topNav,
          breadcrumbs,
          sidebarNav,
          footerNav,
          activeSection,
          hasNavigationSignals:
            topNav.length > 0 ||
            breadcrumbs.length > 0 ||
            sidebarNav.length > 0 ||
            footerNav.length > 0 ||
            !!activeSection
        };
      }

      private extractLinkTexts(selector: string, limit: number): string[] {
        const values: string[] = [];
        const seen = new Set<string>();

        document.querySelectorAll(selector).forEach(element => {
          const text = this.cleanNavigationText(element.textContent || '');
          if (!text || seen.has(text)) return;

          seen.add(text);
          values.push(text);
        });

        return values.slice(0, limit);
      }

      private extractActiveNavigationText(): string | undefined {
        const activeSelectors = [
          'nav [aria-current="page"]',
          'nav .active',
          'nav [class*="active"]',
          '.breadcrumb [aria-current="page"]',
          '.sidebar .active',
          '[class*="toc"] .active'
        ];

        for (const selector of activeSelectors) {
          const element = document.querySelector(selector);
          const text = this.cleanNavigationText(element?.textContent || '');
          if (text) return text;
        }

        return undefined;
      }

      private cleanNavigationText(text: string): string {
        return text
          .replace(/\s+/g, ' ')
          .replace(/[|›»/\\]+/g, ' ')
          .trim()
          .substring(0, 80);
      }

      /**
       * 提取内容特征（增强版 - 更关注对AI分类有用的信息）
       */
      private extractContentFeatures(): any {
        const text = document.body.textContent || '';
        const words = text.trim().split(/\s+/);
        
        // 提取页面中的关键元素
        const codeElements = document.querySelectorAll('pre, code');
        const hasCode = codeElements.length > 0;
        
        // 检测内容类型
        const contentType = this.detectContentType();
        
        // 检测技术栈（如果有代码）
        let techStack: string[] = [];
        if (hasCode) {
          techStack = this.detectTechStack(codeElements);
        }
        
        return {
          wordCount: words.length,
          characterCount: text.length,
          paragraphCount: document.querySelectorAll('p').length,
          headingCount: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
          linkCount: document.querySelectorAll('a[href]').length,
          externalLinkCount: this.countExternalLinks(),
          imageCount: document.querySelectorAll('img').length,
          hasCode,
          hasVideo: document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0,
          hasTable: document.querySelectorAll('table').length > 0,
          hasList: document.querySelectorAll('ul, ol').length > 0,
          hasForm: document.querySelectorAll('form').length > 0,
          contentType,
          techStack,
          hasEmail: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text),
          hasPhone: /\+?[1-9]\d{1,14}/.test(text),
          dominantLanguage: this.detectDominantLanguage(text),
          estimatedReadingTime: this.calculateReadingTime()
        };
      }

      /**
       * 检测内容类型
       */
      private detectContentType(): string {
        const bodyText = document.body.textContent?.toLowerCase() || '';
        const url = window.location.href.toLowerCase();
        
        // 检测常见内容类型
        if (bodyText.includes('function') || bodyText.includes('class') || bodyText.includes('var ') || bodyText.includes('let ')) {
          return 'technical';
        }
        
        if (document.querySelector('pre, code')) {
          return 'technical';
        }
        
        if (url.includes('blog') || url.includes('article') || document.querySelector('article')) {
          return 'blog';
        }
        
        if (url.includes('news') || url.includes('article') || document.querySelector('.news, .article')) {
          return 'news';
        }
        
        if (document.querySelector('form')) {
          return 'form';
        }
        
        if (document.querySelector('.product, .item, [class*="product"]')) {
          return 'product';
        }
        
        if (document.querySelector('.video, video, iframe[src*="youtube"], iframe[src*="vimeo"]')) {
          return 'video';
        }
        
        return 'general';
      }

      /**
       * 检测技术栈
       */
      private detectTechStack(codeElements: NodeListOf<Element>): string[] {
        const techStack: string[] = [];
        const codeText = Array.from(codeElements)
          .map(el => el.textContent || '')
          .join(' ')
          .toLowerCase();
        
        // 常见技术关键词
        const techKeywords = {
          'JavaScript': ['javascript', 'js', 'node.js', 'npm'],
          'Python': ['python', 'django', 'flask', 'pip'],
          'Java': ['java', 'spring', 'maven'],
          'C#': ['c#', 'csharp', '.net'],
          'PHP': ['php', 'laravel', 'composer'],
          'Ruby': ['ruby', 'rails', 'gem'],
          'Go': ['go', 'golang'],
          'Rust': ['rust', 'cargo'],
          'TypeScript': ['typescript', 'ts'],
          'React': ['react', 'jsx'],
          'Vue': ['vue', 'vue.js'],
          'Angular': ['angular', 'angularjs'],
          'HTML': ['html', 'html5'],
          'CSS': ['css', 'css3', 'sass', 'scss'],
          'SQL': ['sql', 'mysql', 'postgresql', 'mongodb'],
          'Docker': ['docker', 'dockerfile'],
          'Kubernetes': ['kubernetes', 'k8s'],
          'AWS': ['aws', 'amazon', 'ec2', 's3'],
          'Git': ['git', 'github', 'gitlab']
        };
        
        // 检测匹配的技术
        Object.entries(techKeywords).forEach(([tech, keywords]) => {
          if (keywords.some(keyword => codeText.includes(keyword))) {
            techStack.push(tech);
          }
        });
        
        return [...new Set(techStack)].slice(0, 5); // 去重并限制数量
      }

      /**
       * 提取网站基本信息
       */
      private extractSiteInfo(): any {
        const hostname = window.location.hostname;
        const domain = hostname.replace(/^www\./, '');
        const subdomain = hostname.includes('www.') ? null : hostname.split('.')[0];
        
        return {
          domain,
          subdomain,
          hostname,
          protocol: window.location.protocol,
          port: window.location.port,
          siteName: this.getSiteName(),
          siteType: this.detectSiteType(),
          isSecure: window.location.protocol === 'https:',
          charset: document.characterSet || document.charset
        };
      }

      /**
       * 获取网站名称
       */
      private getSiteName(): string {
        // 优先从 Open Graph 获取
        const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
        if (ogSiteName) return ogSiteName;

        // 从 application-name 获取
        const appName = document.querySelector('meta[name="application-name"]')?.getAttribute('content');
        if (appName) return appName;

        // 从页面标题推断
        const title = document.title;
        const titleParts = title.split(/[-|_–—]/);
        if (titleParts.length > 1) {
          return titleParts[titleParts.length - 1].trim();
        }

        // 默认使用域名
        return window.location.hostname.replace(/^www\./, '');
      }

      /**
       * 检测网站类型
       */
      private detectSiteType(): string {
        const hostname = window.location.hostname;
        const path = window.location.pathname;
        const content = document.body.textContent?.toLowerCase() || '';
        
        // 常见网站类型匹配
        const sitePatterns = {
          'social': ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'weibo.com'],
          'news': ['news', 'cnn.com', 'bbc.com', 'reuters.com', '新闻'],
          'blog': ['blog', 'medium.com', 'wordpress.com', '博客'],
          'ecommerce': ['shop', 'store', 'amazon.com', 'taobao.com', 'jd.com', '购物'],
          'video': ['youtube.com', 'vimeo.com', 'bilibili.com', 'video'],
          'documentation': ['docs', 'api', 'guide', 'manual', '文档'],
          'forum': ['forum', 'community', 'discuss', '论坛'],
          'wiki': ['wiki', 'wikipedia.org', '百科'],
          'education': ['edu', 'course', 'learn', 'tutorial', '教育'],
          'government': ['gov', '政府'],
          'search': ['google.com', 'bing.com', 'baidu.com', '搜索']
        };

        for (const [type, patterns] of Object.entries(sitePatterns)) {
          if (patterns.some(pattern => 
            hostname.includes(pattern) || 
            path.includes(pattern) || 
            content.includes(pattern)
          )) {
            return type;
          }
        }

        return 'website';
      }

      /**
       * 提取内容结构
       */
      private extractContentStructure(): any {
        const headings = this.extractHeadings();
        const lists = this.extractLists();
        const tables = document.querySelectorAll('table').length;
        const forms = document.querySelectorAll('form').length;
        const videos = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
        const codeBlocks = document.querySelectorAll('pre, code').length;
        
        return {
          headings,
          lists: lists.length,
          tables,
          forms,
          videos,
          codeBlocks,
          hasNavigation: !!document.querySelector('nav'),
          hasComments: this.hasComments(),
          hasShareButtons: this.hasSocialShare(),
          estimatedReadingTime: this.calculateReadingTime()
        };
      }

      /**
       * 提取标题结构
       */
      private extractHeadings(): any {
        const headings = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
        const headingTexts: string[] = [];
        
        for (let i = 1; i <= 6; i++) {
          const elements = document.querySelectorAll(`h${i}`);
          headings[`h${i}` as keyof typeof headings] = elements.length;
          
          elements.forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 0) {
              headingTexts.push(text);
            }
          });
        }
        
        return { ...headings, texts: headingTexts.slice(0, 10) };
      }

      /**
       * 提取列表信息
       */
      private extractLists(): any[] {
        const lists: any[] = [];
        
        document.querySelectorAll('ul, ol').forEach(list => {
          const items = list.querySelectorAll('li');
          if (items.length > 0) {
            lists.push({
              type: list.tagName.toLowerCase(),
              itemCount: items.length,
              nested: list.querySelectorAll('ul, ol').length > 0
            });
          }
        });
        
        return lists;
      }

      /**
       * 检测是否有评论区
       */
      private hasComments(): boolean {
        const commentSelectors = [
          '.comments', '#comments', '.comment-section',
          '.disqus', '.facebook-comments', '.livefyre',
          '[id*="comment"]', '[class*="comment"]'
        ];
        
        return commentSelectors.some(selector => document.querySelector(selector));
      }

      /**
       * 检测是否有社交分享按钮
       */
      private hasSocialShare(): boolean {
        const shareSelectors = [
          '.share', '.social-share', '.share-buttons',
          '[class*="share"]', '[id*="share"]',
          'a[href*="facebook.com/sharer"]',
          'a[href*="twitter.com/intent"]'
        ];
        
        return shareSelectors.some(selector => document.querySelector(selector));
      }

      /**
       * 计算阅读时间
       */
      private calculateReadingTime(): number {
        const text = document.body.textContent || '';
        const wordsPerMinute = 200; // 平均阅读速度
        const wordCount = text.trim().split(/\s+/).length;
        return Math.ceil(wordCount / wordsPerMinute);
      }

      /**
       * 提取SEO元数据
       */
      private extractSEOMetadata(): any {
        const description = document.querySelector('meta[name="description"]')?.getAttribute('content');
        const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content');
        const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content');
        const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
        const author = document.querySelector('meta[name="author"]')?.getAttribute('content');
        
        return {
          description,
          keywords: keywords?.split(',').map(k => k.trim()),
          robots,
          canonical,
          author,
          hasStructuredData: this.hasStructuredData()
        };
      }

      /**
       * 检测是否有结构化数据
       */
      private hasStructuredData(): boolean {
        const structuredDataSelectors = [
          'script[type="application/ld+json"]',
          '[itemscope]',
          '[property^="og:"]',
          '[name^="twitter:"]'
        ];
        
        return structuredDataSelectors.some(selector => document.querySelector(selector));
      }

      /**
       * 提取社交媒体元数据
       */
      private extractSocialMetadata(): any {
        const ogData: any = {};
        const twitterData: any = {};
        
        // Open Graph 数据
        document.querySelectorAll('meta[property^="og:"]').forEach(meta => {
          const property = meta.getAttribute('property')?.replace('og:', '');
          const content = meta.getAttribute('content');
          if (property && content) {
            ogData[property] = content;
          }
        });
        
        // Twitter Card 数据
        document.querySelectorAll('meta[name^="twitter:"]').forEach(meta => {
          const name = meta.getAttribute('name')?.replace('twitter:', '');
          const content = meta.getAttribute('content');
          if (name && content) {
            twitterData[name] = content;
          }
        });
        
        return { openGraph: ogData, twitter: twitterData };
      }

      /**
       * 提取技术信息
       */
      private extractTechnicalInfo(): any {
        const scripts = document.querySelectorAll('script[src]').length;
        const stylesheets = document.querySelectorAll('link[rel="stylesheet"]').length;
        const generator = document.querySelector('meta[name="generator"]')?.getAttribute('content');
        const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content');
        
        // 检测常见框架和库
        const frameworks = this.detectFrameworks();
        
        return {
          scripts,
          stylesheets,
          generator,
          viewport,
          frameworks,
          hasServiceWorker: 'serviceWorker' in navigator,
          isResponsive: this.isResponsiveDesign(),
          loadTime: performance.now()
        };
      }

      /**
       * 检测前端框架
       */
      private detectFrameworks(): string[] {
        const frameworks: string[] = [];
        
        // 检测常见框架
        if ((window as any).React) frameworks.push('React');
        if ((window as any).Vue) frameworks.push('Vue');
        if ((window as any).angular) frameworks.push('Angular');
        if ((window as any).jQuery || (window as any).$) frameworks.push('jQuery');
        if (document.querySelector('[ng-app], [data-ng-app]')) frameworks.push('AngularJS');
        if (document.querySelector('[v-app], [data-v-]')) frameworks.push('Vue');
        if (document.querySelector('[data-reactroot]')) frameworks.push('React');
        
        return frameworks;
      }

      /**
       * 检测是否为响应式设计
       */
      private isResponsiveDesign(): boolean {
        const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content');
        return !!(viewport && viewport.includes('width=device-width'));
      }



      /**
       * 统计外部链接
       */
      private countExternalLinks(): number {
        const currentDomain = window.location.hostname;
        const links = document.querySelectorAll('a[href]');
        let externalCount = 0;
        
        links.forEach(link => {
          const href = (link as HTMLAnchorElement).href;
          if (href && !href.includes(currentDomain) && href.startsWith('http')) {
            externalCount++;
          }
        });
        
        return externalCount;
      }

      /**
       * 检测主要语言
       */
      private detectDominantLanguage(text: string): string {
        // 简单的语言检测
        const chineseChars = (text.match(/[一-鿿]/g) || []).length;
        const totalChars = text.length;
        
        if (chineseChars / totalChars > 0.1) {
          return 'zh'; // 中文
        }
        
        return 'en'; // 默认英文
      }

      /**
       * 提取语言和地区信息
       */
      private extractLanguageInfo(): any {
        const htmlLang = document.documentElement.lang;
        const langMeta = document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content');
        const text = document.body.textContent || '';
        
        return {
          htmlLang,
          contentLanguage: langMeta,
          detectedLanguage: this.detectDominantLanguage(text),
          isMultilingual: this.isMultilingual(),
          textDirection: document.dir || 'ltr'
        };
      }

      /**
       * 检测是否多语言
       */
      private isMultilingual(): boolean {
        return document.querySelectorAll('[lang], [hreflang]').length > 1;
      }

      /**
       * 提取时间信息
       */
      private extractTimeInfo(): any {
        const publishedTime = this.extractPublishedTime();
        const modifiedTime = this.extractModifiedTime();
        
        return {
          publishedTime,
          modifiedTime,
          extractedAt: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
      }

      /**
       * 提取发布时间
       */
      private extractPublishedTime(): string | null {
        // 尝试多种方式提取发布时间
        const selectors = [
          'meta[property="article:published_time"]',
          'meta[property="og:published_time"]', 
          'meta[name="DC.date.issued"]',
          'time[datetime]',
          '.published-date',
          '.publish-time',
          '.date'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            const datetime = element.getAttribute('datetime') || 
                            element.getAttribute('content') ||
                            element.textContent;
            if (datetime) {
              const date = new Date(datetime);
              if (!isNaN(date.getTime())) {
                return date.toISOString();
              }
            }
          }
        }
        
        return null;
      }

      /**
       * 提取修改时间
       */
      private extractModifiedTime(): string | null {
        const selectors = [
          'meta[property="article:modified_time"]',
          'meta[property="og:updated_time"]',
          'meta[name="DC.date.modified"]',
          '.modified-date',
          '.update-time'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            const datetime = element.getAttribute('datetime') ||
                            element.getAttribute('content') ||
                            element.textContent;
            if (datetime) {
              const date = new Date(datetime);
              if (!isNaN(date.getTime())) {
                return date.toISOString();
              }
            }
          }
        }
        
        return null;
      }

      /**
       * 获取网站图标URL
       */
      private getFaviconUrl(): string {
        // 尝试多种方法获取favicon
        const faviconSelectors = [
          'link[rel="icon"]',
          'link[rel="shortcut icon"]', 
          'link[rel="apple-touch-icon"]'
        ];

        for (const selector of faviconSelectors) {
          const link = document.querySelector(selector) as HTMLLinkElement;
          if (link && link.href) {
            return link.href;
          }
        }

        // 默认使用Google的favicon服务
        const domain = window.location.hostname;
        return `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
      }
    }

    // 全局标识，防止重复初始化
    if (!(window as any).contentScriptInitialized) {
      (window as any).contentScriptInitialized = true;

      // 根据页面加载状态选择初始化时机
      const initializeContentScript = () => {
        try {
          PageContentExtractor.getInstance();
          console.log('✅ Content Script 初始化成功');

          // 向background发送初始化完成信号
          chrome.runtime.sendMessage({
            type: 'CONTENT_SCRIPT_READY',
            url: window.location.href,
            timestamp: Date.now()
          }).catch(error => {
            console.warn('⚠️ 无法发送初始化信号:', error);
          });

        } catch (error) {
          console.error('❌ Content Script 初始化失败:', error);
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeContentScript);
      } else {
        // 页面已加载完成，立即初始化
        setTimeout(initializeContentScript, 100);
      }

    }

    // 导出给全局使用
    (window as any).tigermarkExtractor = PageContentExtractor.getInstance();

  })();
}
