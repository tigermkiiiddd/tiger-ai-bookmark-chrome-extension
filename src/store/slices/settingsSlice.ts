import { StorageService } from '../../services/storage';
import { AIService } from '../../services/ai';
import type { Settings } from '../../types/index';

const storageService = StorageService.getInstance();
const aiService = AIService.getInstance();

export const settingsInitialState = {
  settings: {
    theme: 'system',
    aiAutoTagging: true,
    contentSafetyLevel: 'BLOCK_NONE',
    syncDirection: 'bidirectional'
  } as Settings,
};

export function createSettingsSlice(
  set: (partial: any) => void,
  get: () => any
) {
  return {
    loadSettings: async () => {
      try {
        const settings = await storageService.getSettings();
        set({ settings });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '加载设置失败' });
      }
    },

    updateSettings: async (updates: any) => {
      try {
        await storageService.updateSettings(updates);

        const state = get();
        const newSettings = { ...state.settings, ...updates };
        set({ settings: newSettings });

        if (updates.aiApiKey || updates.contentSafetyLevel) {
          await aiService.initialize(newSettings);
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '更新设置失败' });
      }
    },
  };
}
