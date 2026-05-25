/**
 * 通知管理器 - 处理浏览器通知功能
 */

export interface NotificationOptions {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number; // 自动关闭时间（毫秒），0表示不自动关闭
}

class NotificationManager {
  private hasPermission = false;

  constructor() {
    this.checkPermission();
  }

  /**
   * 检查通知权限
   */
  private async checkPermission(): Promise<void> {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        this.hasPermission = true;
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        this.hasPermission = permission === 'granted';
      }
    }
  }

  /**
   * 请求通知权限
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('此浏览器不支持桌面通知');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.hasPermission = true;
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    }

    return false;
  }

  /**
   * 显示浏览器通知
   */
  async showNotification(options: NotificationOptions): Promise<void> {
    const { title, message, type = 'info', duration = 5000 } = options;

    // 如果没有权限，尝试请求权限
    if (!this.hasPermission) {
      const granted = await this.requestPermission();
      if (!granted) {
        console.warn('通知权限被拒绝，无法显示通知');
        return;
      }
    }

    try {
      // 创建通知
      const notification = new Notification(title, {
        body: message,
        icon: this.getIconForType(type),
        badge: '/icons/icon-48.png',
        tag: `tigermark-${type}-${Date.now()}`, // 防止重复通知
        requireInteraction: type === 'error', // 错误通知需要用户交互才关闭
        silent: false,
      });

      // 点击通知时聚焦到扩展页面
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // 自动关闭通知
      if (duration > 0 && type !== 'error') {
        setTimeout(() => {
          notification.close();
        }, duration);
      }

    } catch (error) {
      console.error('显示通知失败:', error);
    }
  }

  /**
   * 根据通知类型获取图标
   */
  private getIconForType(type: string): string {
    const baseIcon = '/icons/icon-48.png';
    
    // 可以根据不同类型返回不同图标
    switch (type) {
      case 'success':
        return baseIcon;
      case 'error':
        return baseIcon;
      case 'warning':
        return baseIcon;
      default:
        return baseIcon;
    }
  }

  /**
   * 显示成功通知
   */
  async showSuccess(title: string, message: string): Promise<void> {
    await this.showNotification({
      title,
      message,
      type: 'success',
      duration: 4000
    });
  }

  /**
   * 显示错误通知
   */
  async showError(title: string, message: string): Promise<void> {
    await this.showNotification({
      title,
      message,
      type: 'error',
      duration: 0 // 错误通知不自动关闭
    });
  }

  /**
   * 显示信息通知
   */
  async showInfo(title: string, message: string): Promise<void> {
    await this.showNotification({
      title,
      message,
      type: 'info',
      duration: 3000
    });
  }

  /**
   * 显示警告通知
   */
  async showWarning(title: string, message: string): Promise<void> {
    await this.showNotification({
      title,
      message,
      type: 'warning',
      duration: 5000
    });
  }

  /**
   * 显示批量归档完成通知
   */
  async showBatchArchiveComplete(
    successCount: number,
    failureCount: number,
    totalCount: number
  ): Promise<void> {
    const successRate = Math.round((successCount / totalCount) * 100);
    
    if (failureCount === 0) {
      await this.showSuccess(
        '🎉 批量归档完成',
        `成功归档 ${successCount} 个书签，成功率 ${successRate}%`
      );
    } else {
      await this.showWarning(
        '⚠️ 批量归档完成',
        `成功 ${successCount} 个，失败 ${failureCount} 个，成功率 ${successRate}%`
      );
    }
  }
}

// 导出单例实例
export const notificationManager = new NotificationManager();
export default notificationManager;