/**
 * AI 统一入口 — 实现位于 src/services/ai.ts（OpenAI 兼容 API）
 */
export { AIService, aiService } from '../../services/ai';
export type { AIConfig } from '../../services/ai';
export type {
  AIAnalysisResult as GeminiAnalysisResult,
  PageAnalysis
} from '../../types/index';
