/**
 * 设置相关自定义Hooks
 * 提供设置操作的React Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import { settingsStorage } from '../core/storage/settings';
import type { Settings } from '../types/index';

export interface UseSettingsReturn {
  settings: Settings;
  loading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings>(settingsStorage.getDefaultSettings());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载设置
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await settingsStorage.getSettings();
      setSettings(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 更新设置
  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    setError(null);
    
    try {
      const newSettings = await settingsStorage.updateSettings(updates);
      setSettings(newSettings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // 重置设置
  const resetSettings = useCallback(async () => {
    setError(null);
    
    try {
      const defaultSettings = await settingsStorage.resetSettings();
      setSettings(defaultSettings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset settings';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // 刷新设置
  const refreshSettings = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  // 初始化加载
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 监听设置变化
  useEffect(() => {
    const handleSettingsChange = (newSettings: Settings) => {
      setSettings(newSettings);
    };

    settingsStorage.onSettingsChanged(handleSettingsChange);

    return () => {
      // 清理监听器
      settingsStorage.onSettingsChanged(handleSettingsChange);
    };
  }, []);

  return {
    settings,
    loading,
    error,
    updateSettings,
    resetSettings,
    refreshSettings
  };
}

