// Content Script诊断和修复工具
export class ContentScriptDiagnostic {
  /**
   * 检查Content Script是否可用
   */
  static async checkContentScript(tabId: number): Promise<{ available: boolean; error?: string }> {
    try {
      console.log(`[诊断工具] 检查标签页 ${tabId} 的Content Script状态`);
      
      // 首先检查标签页是否存在
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) {
        return { available: false, error: '标签页不存在' };
      }
      
      // 检查是否为特殊页面
      const specialPages = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'moz-extension://'];
      if (tab.url && specialPages.some(page => tab.url!.startsWith(page))) {
        return { available: false, error: '系统页面不支持Content Script' };
      }
      
      // 发送PING消息测试连接，使用更短的超时时间
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, { type: 'PING' }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('连接超时')), 2000)
        )
      ]);
      
      if (response && (response as any).success) {
        console.log(`[诊断工具] Content Script在标签页 ${tabId} 中可用`);
        return { available: true };
      } else {
        console.log(`[诊断工具] Content Script响应无效`);
        return { available: false, error: 'Content Script响应无效' };
      }
    } catch (error) {
      console.error(`[诊断工具] 检查Content Script失败:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 处理特定的Chrome扩展错误
      if (errorMessage.includes('Could not establish connection')) {
        return { available: false, error: 'Content Script未注入或已断开连接' };
      }
      if (errorMessage.includes('Receiving end does not exist')) {
        return { available: false, error: 'Content Script消息接收端不存在' };
      }
      if (errorMessage.includes('message channel closed')) {
        return { available: false, error: '消息通道已关闭' };
      }
      
      return { available: false, error: errorMessage };
    }
  }

  /**
   * 注入Content Script
   */
  static async injectContentScript(tabId: number): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[诊断工具] 尝试注入Content Script到标签页 ${tabId}`);
      
      // 首先检查标签页是否可访问
      const tab = await chrome.tabs.get(tabId);
      if (!tab || !tab.url) {
        throw new Error('标签页不存在或无效');
      }
      
      // 检查是否为特殊页面
      const specialPages = ['chrome://', 'chrome-extension://', 'edge://', 'about:'];
      if (tab.url && specialPages.some(page => tab.url!.startsWith(page))) {
        throw new Error('无法在系统页面中注入脚本');
      }
      
      // 先重置守卫标志，防止扩展重载后旧 flag 阻止重新初始化
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => { (window as any).tigermarkContentScriptLoaded = false; }
      });

      // 注入脚本
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      
      console.log(`[诊断工具] Content Script注入成功`);
      
      // 等待脚本初始化
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { success: true };
    } catch (error) {
      console.error(`[诊断工具] Content Script注入失败:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 诊断和修复Content Script连接问题
   */
  static async diagnoseAndFix(): Promise<{ success: boolean; message: string; tabId?: number }> {
    try {
      console.log('[诊断工具] 开始诊断Content Script连接问题');
      
      // 获取当前活动标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        return { success: false, message: '未找到活动标签页' };
      }
      
      const tab = tabs[0];
      if (!tab.id) {
        return { success: false, message: '标签页ID无效' };
      }
      
      console.log(`[诊断工具] 当前标签页: ${tab.url} (ID: ${tab.id})`);
      
      // 检查Content Script连接
      const checkResult = await this.checkContentScript(tab.id);
      if (checkResult.available) {
        return { success: true, message: 'Content Script连接正常', tabId: tab.id };
      }
      
      console.log(`[诊断工具] Content Script不可用，错误: ${checkResult.error}`);
      
      // 尝试注入Content Script
      const injectResult = await this.injectContentScript(tab.id);
      if (!injectResult.success) {
        return { success: false, message: `Content Script注入失败: ${injectResult.error}`, tabId: tab.id };
      }
      
      // 再次检查连接
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待初始化
      const recheckResult = await this.checkContentScript(tab.id);
      if (recheckResult.available) {
        return { success: true, message: 'Content Script修复成功', tabId: tab.id };
      } else {
        return { success: false, message: 'Content Script注入后连接仍然失败', tabId: tab.id };
      }
    } catch (error) {
      console.error('[诊断工具] 诊断过程出错:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: `诊断过程出错: ${errorMessage}` };
    }
  }

  /**
   * 重试机制 - 多次尝试连接
   */
  static async retryConnection(tabId: number, maxRetries: number = 3): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      console.log(`[诊断工具] 重试连接 (${i + 1}/${maxRetries})`);
      
      const result = await this.checkContentScript(tabId);
      if (result.available) {
        return true;
      }
      
      // 如果是连接问题，尝试重新注入
      if (result.error && (
        result.error.includes('未注入') || 
        result.error.includes('不存在') || 
        result.error.includes('已关闭')
      )) {
        console.log(`[诊断工具] 尝试重新注入Content Script`);
        const injectResult = await this.injectContentScript(tabId);
        if (injectResult.success) {
          // 等待脚本初始化后再检查
          await new Promise(resolve => setTimeout(resolve, 1500));
          const recheckResult = await this.checkContentScript(tabId);
          if (recheckResult.available) {
            return true;
          }
        }
      }
      
      // 等待后重试，使用指数退避
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
    
    return false;
  }

  /**
   * 获取详细的诊断信息
   */
  static async getDetailedDiagnostics(): Promise<any> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        return { error: '未找到活动标签页' };
      }
      
      const tab = tabs[0];
      const tabInfo = {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        status: tab.status,
        active: tab.active,
        windowId: tab.windowId
      };
      
      let contentScriptInfo = null;
      if (tab.id) {
        try {
          const response = await Promise.race([
            chrome.tabs.sendMessage(tab.id, { type: 'PING' }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('诊断超时')), 2000)
            )
          ]);
          contentScriptInfo = {
            connected: true,
            response: response,
            lastChecked: Date.now()
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          contentScriptInfo = {
            connected: false,
            error: errorMessage,
            lastChecked: Date.now(),
            errorType: this.categorizeError(errorMessage)
          };
        }
      }
      
      return {
        tabInfo,
        contentScriptInfo,
        timestamp: new Date().toISOString(),
        recommendations: this.getRecommendations(contentScriptInfo)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { error: errorMessage };
    }
  }

  /**
   * 错误分类
   */
  private static categorizeError(errorMessage: string): string {
    if (errorMessage.includes('Could not establish connection')) {
      return 'CONNECTION_FAILED';
    }
    if (errorMessage.includes('Receiving end does not exist')) {
      return 'RECEIVER_NOT_FOUND';
    }
    if (errorMessage.includes('message channel closed')) {
      return 'CHANNEL_CLOSED';
    }
    if (errorMessage.includes('超时') || errorMessage.includes('timeout')) {
      return 'TIMEOUT';
    }
    if (errorMessage.includes('系统页面')) {
      return 'RESTRICTED_PAGE';
    }
    return 'UNKNOWN';
  }

  /**
   * 获取修复建议
   */
  private static getRecommendations(contentScriptInfo: any): string[] {
    const recommendations: string[] = [];
    
    if (!contentScriptInfo || !contentScriptInfo.connected) {
      const errorType = contentScriptInfo?.errorType;
      
      switch (errorType) {
        case 'CONNECTION_FAILED':
        case 'RECEIVER_NOT_FOUND':
          recommendations.push('尝试刷新页面重新加载Content Script');
          recommendations.push('检查扩展是否有足够的权限访问此页面');
          break;
        case 'CHANNEL_CLOSED':
          recommendations.push('页面可能正在加载中，请稍后重试');
          recommendations.push('尝试重新打开扩展弹窗');
          break;
        case 'TIMEOUT':
          recommendations.push('页面响应较慢，请检查网络连接');
          recommendations.push('尝试关闭其他占用资源的标签页');
          break;
        case 'RESTRICTED_PAGE':
          recommendations.push('此页面类型不支持扩展功能');
          recommendations.push('请在普通网页中使用扩展功能');
          break;
        default:
          recommendations.push('尝试刷新页面');
          recommendations.push('重新启动浏览器');
          recommendations.push('检查扩展是否已启用');
      }
    } else {
      recommendations.push('Content Script连接正常');
    }
    
    return recommendations;
  }
}