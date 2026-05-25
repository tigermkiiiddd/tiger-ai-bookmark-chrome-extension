import type { AIAnalysisResult } from '../types/index.js';
import { StorageService } from '../services/storage.js';
import { normalizeCategoryPath } from './categoryTreeBuilder.js';

/**
 * 将 AI 返回的分类路径解析为 categoryId（与主应用 aiArchiveBookmark 一致）
 */
export async function applyAICategoryFromAnalysis(
  analysis: AIAnalysisResult
): Promise<string | undefined> {
  const path = normalizeCategoryPath(analysis.category || '');
  if (!path) return undefined;

  const storageService = StorageService.getInstance();
  const category = await storageService.ensureCategoryPath(path);

  console.debug('🤖 分类决策:', {
    path,
    decision: analysis.categoryDecision,
    reason: analysis.categoryReason,
    categoryId: category.id,
  });

  return category.id;
}
