// 诊断工具函数
export class DiagnosticTool {
  static async checkContentScript(tabId: number): Promise<boolean> {
    try {
      // 发送PING消息测试Content Script连接
      const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      return response && response.success === true;
    } catch (error) {
      console.error('Content Script连接检查失败:', error);
      return false;
    }
  }

  static async injectContentScript(tabId: number): Promise<boolean> {
    try {
      // 注入Content Script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      return true;
    } catch (error) {
      console.error('Content Script注入失败:', error);
      return false;
    }
  }

  static async getCurrentTab(): Promise<chrome.tabs.Tab | null> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0] || null;
    } catch (error) {
      console.error('获取当前标签页失败:', error);
      return null;
    }
  }

  static async diagnoseAndFix(): Promise<{ success: boolean; message: string }> {
    try {
      // 获取当前标签页
      const tab = await this.getCurrentTab();
      if (!tab || !tab.id) {
        return { success: false, message: '无法获取当前标签页' };
      }

      // 检查Content Script连接
      const isConnected = await this.checkContentScript(tab.id);
      if (isConnected) {
        return { success: true, message: 'Content Script连接正常' };
      }

      // 尝试注入Content Script
      const injected = await this.injectContentScript(tab.id);
      if (!injected) {
        return { success: false, message: 'Content Script注入失败' };
      }

      // 等待片刻后再次检查连接
      await new Promise(resolve => setTimeout(resolve, 1000));
      const reconnected = await this.checkContentScript(tab.id);
      if (reconnected) {
        return { success: true, message: 'Content Script修复成功' };
      } else {
        return { success: false, message: 'Content Script注入后连接仍然失败' };
      }
    } catch (error) {
      console.error('诊断过程出错:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: `诊断过程出错: ${errorMessage}` };
    }
  }
}