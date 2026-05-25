/**
 * 设置存储服务
 * 专门处理应用设置相关的存储操作
 */

import { chromeStorage } from './chrome';
import type { Settings } from '../../types/index';

export class SettingsStorageService {
  private static instance: SettingsStorageService;
  private readonly STORAGE_KEY = 'settings';
  private readonly defaultSettings: Settings = {
    theme: 'system',
    aiAutoTagging: true,
    syncDirection: 'bidirectional',
    aiApiKey: '',
    aiApiBaseUrl: 'https://api.openai.com',
    aiModel: 'gpt-4o-mini',
    aiProcessingDelay: 3000,
    aiMaxConcurrent: 1,
    aiRateLimitMode: 'balanced',
    linkCheckSkipRecently: false,
    linkCheckSkipPeriod: '1m',
    aiArchiveLinkCheckMode: 'off'
  };

  public static getInstance(): SettingsStorageService {
    if (!SettingsStorageService.instance) {
      SettingsStorageService.instance = new SettingsStorageService();
    }
    return SettingsStorageService.instance;
  }

  private constructor() {}

  /**
   * 获取设置
   */
  async getSettings(): Promise<Settings> {
    try {
      const result = await chromeStorage.get<{ settings?: Settings }>(this.STORAGE_KEY, { useSync: true });
      return { ...this.defaultSettings, ...result.settings };
    } catch (error) {
      console.error('Failed to get settings:', error);
      // 返回默认设置
      return this.defaultSettings;
    }
  }

  /**
   * 更新设置
   */
  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    try {
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...updates };
      
      await chromeStorage.set({ [this.STORAGE_KEY]: newSettings }, { useSync: true });
      
      return newSettings;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }

  /**
   * 重置设置为默认值
   */
  async resetSettings(): Promise<Settings> {
    try {
      await chromeStorage.set({ [this.STORAGE_KEY]: this.defaultSettings }, { useSync: true });
      return this.defaultSettings;
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw error;
    }
  }

  /**
   * 获取特定设置项
   */
  async getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
    try {
      const settings = await this.getSettings();
      return settings[key];
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return this.defaultSettings[key];
    }
  }

  /**
   * 设置特定设置项
   */
  async setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    try {
      await this.updateSettings({ [key]: value } as Partial<Settings>);
    } catch (error) {
      console.error(`Failed to set setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * 检查设置是否存在
   */
  async hasSettings(): Promise<boolean> {
    try {
      const result = await chromeStorage.get<{ settings?: Settings }>(this.STORAGE_KEY, { useSync: true });
      return result.settings !== null && result.settings !== undefined;
    } catch (error) {
      console.error('Failed to check if settings exist:', error);
      return false;
    }
  }

  /**
   * 导出设置
   */
  async exportSettings(): Promise<Settings> {
    return this.getSettings();
  }

  /**
   * 导入设置
   */
  async importSettings(settings: Settings): Promise<void> {
    try {
      // 验证设置格式
      const validatedSettings = this.validateSettings(settings);
      await chromeStorage.set({ [this.STORAGE_KEY]: validatedSettings }, { useSync: true });
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw error;
    }
  }

  /**
   * 验证设置格式
   */
  private validateSettings(settings: any): Settings {
    const validated: Settings = { ...this.defaultSettings };

    if (typeof settings === 'object' && settings !== null) {
      // 验证主题设置
      if (settings.theme && ['light', 'dark', 'system'].includes(settings.theme)) {
        validated.theme = settings.theme;
      }

      // 验证AI自动标签设置
      if (typeof settings.aiAutoTagging === 'boolean') {
        validated.aiAutoTagging = settings.aiAutoTagging;
      }

      // 验证同步方向
      if (settings.syncDirection &&
          ['import', 'export', 'bidirectional'].includes(settings.syncDirection)) {
        validated.syncDirection = settings.syncDirection;
      }

      // 验证AI API密钥
      if (typeof settings.aiApiKey === 'string') {
        validated.aiApiKey = settings.aiApiKey;
      }

      // 验证AI API Base URL
      if (typeof settings.aiApiBaseUrl === 'string') {
        validated.aiApiBaseUrl = settings.aiApiBaseUrl;
      }

      // 验证AI模型名称
      if (typeof settings.aiModel === 'string') {
        validated.aiModel = settings.aiModel;
      }

      // 验证AI处理间隔
      if (typeof settings.aiProcessingDelay === 'number' && settings.aiProcessingDelay >= 1000) {
        validated.aiProcessingDelay = settings.aiProcessingDelay;
      }

      // 验证最大并发数
      if (typeof settings.aiMaxConcurrent === 'number' && settings.aiMaxConcurrent >= 1 && settings.aiMaxConcurrent <= 5) {
        validated.aiMaxConcurrent = settings.aiMaxConcurrent;
      }

      // 验证速率限制模式
      if (settings.aiRateLimitMode && 
          ['conservative', 'balanced', 'aggressive'].includes(settings.aiRateLimitMode)) {
        validated.aiRateLimitMode = settings.aiRateLimitMode;
      }

      if (typeof settings.linkCheckSkipRecently === 'boolean') {
        validated.linkCheckSkipRecently = settings.linkCheckSkipRecently;
      }

      if (
        settings.linkCheckSkipPeriod &&
        ['1m', '6m', '1y'].includes(settings.linkCheckSkipPeriod)
      ) {
        validated.linkCheckSkipPeriod = settings.linkCheckSkipPeriod;
      }

      if (
        typeof settings.linkCheckSkipWithinHours === 'number' &&
        settings.linkCheckSkipWithinHours >= 0 &&
        settings.linkCheckSkipWithinHours <= 24 * 365
      ) {
        validated.linkCheckSkipWithinHours = settings.linkCheckSkipWithinHours;
      }

      if (typeof settings.lastLinkCheckAt === 'number') {
        validated.lastLinkCheckAt = settings.lastLinkCheckAt;
      }

      if (
        settings.aiArchiveLinkCheckMode &&
        ['strict', 'lenient', 'off'].includes(settings.aiArchiveLinkCheckMode)
      ) {
        validated.aiArchiveLinkCheckMode = settings.aiArchiveLinkCheckMode;
      }
    }

    return validated;
  }

  /**
   * 监听设置变化
   */
  onSettingsChanged(callback: (newSettings: Settings, oldSettings: Settings) => void): void {
    chromeStorage.onChanged((changes, areaName) => {
      if (areaName === 'sync' && changes[this.STORAGE_KEY]) {
        const newSettings = changes[this.STORAGE_KEY].newValue || this.defaultSettings;
        const oldSettings = changes[this.STORAGE_KEY].oldValue || this.defaultSettings;
        callback(newSettings, oldSettings);
      }
    });
  }

  /**
   * 获取默认设置
   */
  getDefaultSettings(): Settings {
    return { ...this.defaultSettings };
  }
}

// 导出单例实例
export const settingsStorage = SettingsStorageService.getInstance();

