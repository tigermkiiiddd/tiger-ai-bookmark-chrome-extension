/**
 * @file 统一 AI 服务 — OpenAI Chat Completions 兼容格式
 * 合并原有4个Gemini实现，支持任意OpenAI兼容端点
 */
import type { AIAnalysisResult, Settings, PageAnalysis, CategoryArchiveContext, Tag } from '../types/index.js';
import { formatCategoryTreeForAI, formatTaxonomyRulesForAI, normalizeCategoryPath } from '../utils/categoryTreeBuilder.js';
import { tryGetUiLanguage } from '../i18n/index.js';

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface TagSuggestion {
  action: 'merge' | 'rename' | 'delete';
  sourceTag?: string;
  targetTag?: string;
  newName?: string;
  reason: string;
}

type JSONSchema = Record<string, unknown>;
type StructuredMode = 'tool' | 'json_schema' | 'json_object' | 'prompt';
type OutputLanguage = string;

interface StructuredOutputConfig {
  name: string;
  description: string;
  schema: JSONSchema;
}

const DEFAULT_BASE_URL = 'https://api.openai.com';
const DEFAULT_MODEL = 'gpt-4o-mini';
const PERSONA_TARGET_LENGTH = 30;
const CATEGORY_REASON_TARGET_LENGTH = 40;

const AI_ANALYSIS_SCHEMA: JSONSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['simulated_persona', 'tags', 'category', 'categoryDecision', 'categoryReason', 'keywords', 'summary'],
  properties: {
    simulated_persona: {
      type: 'string',
      minLength: 2,
      description: `用户画像描述，禁止超过 ${PERSONA_TARGET_LENGTH} 字符`,
    },
    tags: {
      type: 'array',
      minItems: 12,
      maxItems: 22,
      description:
        '层级标签路径列表（tag tree 叶子路径）。每条必须是 "父/子" 或 "父/子/孙" 形式，除最多 2 条领域根节点外，其余全部必须包含 "/"。禁止单词级扁平标签。',
      items: {
        type: 'string',
        minLength: 2,
        description:
          '单条层级标签完整路径，必须含 "/"（如 "漫画/奇幻/魔法"、"编程/TypeScript"）。禁止仅输出 "魔法"、"日系" 等孤立词。',
      },
    },
    category: { type: 'string' },
    categoryDecision: { type: 'string', enum: ['reuse', 'extend', 'create'] },
    categoryReason: {
      type: 'string',
      description: `分类原因说明，禁止超过 ${CATEGORY_REASON_TARGET_LENGTH} 字符`,
    },
    keywords: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: { type: 'string' },
    },
    summary: { type: 'string' },
  },
};

const TAG_SUGGESTIONS_SCHEMA: JSONSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'sourceTag', 'targetTag', 'newName', 'reason'],
        properties: {
          action: { type: 'string', enum: ['merge', 'rename', 'delete'] },
          sourceTag: { type: ['string', 'null'], description: '标签路径，用 "/" 表达层级（如 "漫画/奇幻"）' },
          targetTag: { type: ['string', 'null'], description: '合并目标路径，用 "/" 表达层级' },
          newName: { type: ['string', 'null'], description: '重命名后的新路径，用 "/" 表达层级' },
          reason: { type: 'string' },
        },
      },
    },
  },
};

export class AIService {
  private static instance: AIService;
  private config: AIConfig | null = null;
  private analysisCache = new Map<string, Promise<AIAnalysisResult>>();
  /** 记录已确认不支持的 structured output 模式，避免重复无效调用 */
  private unsupportedModes = new Set<StructuredMode>();

  private isChineseLocale(locale?: string): boolean {
    return typeof locale === 'string' && locale.toLowerCase().startsWith('zh');
  }

  private isEnglishLocale(locale?: string): boolean {
    return typeof locale === 'string' && locale.toLowerCase().startsWith('en');
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /** 重置模式探测缓存（切换 API 提供商后应调用） */
  resetModeCache(): void {
    this.unsupportedModes.clear();
  }

  private constructor() {}

  async initialize(settings: Settings): Promise<void> {
    const newConfig = {
      apiKey: settings.aiApiKey || '',
      baseUrl: (settings.aiApiBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ''),
      model: settings.aiModel || DEFAULT_MODEL,
    };
    if (
      !this.config ||
      this.config.baseUrl !== newConfig.baseUrl ||
      this.config.model !== newConfig.model
    ) {
      this.unsupportedModes.clear();
    }
    this.config = newConfig;
  }

  getConfig(): AIConfig | null {
    return this.config;
  }

  resetConfig(): void {
    this.config = null;
  }

  private getModes(structuredOutput?: StructuredOutputConfig): StructuredMode[] {
    if (!structuredOutput) return ['prompt'];
    // DeepSeek 标准 Function Calling：优先走 tool，再降级到 json_object/prompt。
    const all: StructuredMode[] = ['tool', 'json_object', 'prompt'];
    return all.filter(m => !this.unsupportedModes.has(m));
  }

  getCacheSize(): number {
    return this.analysisCache.size;
  }

  clearCache(): void {
    this.analysisCache.clear();
  }

  // ─── 分析入口 ───

  async analyzeContent(
    content: string,
    url: string,
    pageAnalysis?: PageAnalysis,
    categoryContext?: CategoryArchiveContext,
    existingTags?: Tag[],
    tagCounts?: Map<string, number>
  ): Promise<AIAnalysisResult> {
    if (!this.config) throw new Error('AI服务未初始化');

    const outputLanguage = this.resolveOutputLanguage();
    const cacheKey = `${url}:${outputLanguage}:${content.substring(0, 500)}:${categoryContext?.categories.length ?? 0}`;
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    const promise = (async () => {
      try {
        const prompt = this.buildAnalysisPrompt(
          content,
          url,
          categoryContext,
          existingTags,
          tagCounts,
          outputLanguage
        );
        const response = await this.callAPI(prompt.user, {
          systemPrompt: prompt.system,
          temperature: 0.2,
          structuredOutput: {
            name: 'save_bookmark_analysis',
            description:
              'Analyze bookmark content and return hierarchical tag paths only. Every tag string MUST use "/" (e.g. "漫画/奇幻/魔法"). Flat single-word tags are forbidden except at most 2 domain roots. Reuse paths from existing_tag_tree when possible. Do NOT create a tag with the same leaf name under a different parent if that leaf already exists in the tree.',
            schema: AI_ANALYSIS_SCHEMA,
          },
        });
        return this.parseAnalysisResult(response, url);
      } catch (error) {
        this.analysisCache.delete(cacheKey);
        throw new Error(`AI分析失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    })();

    this.analysisCache.set(cacheKey, promise);
    return promise;
  }

  async generateTagSuggestions(tags: Tag[], tagCounts: Map<string, number>): Promise<TagSuggestion[]> {
    if (!this.config) throw new Error('AI服务未初始化');
    const prompt = this.buildTagSuggestionPrompt(tags, tagCounts);
    const response = await this.callAPI(prompt.user, {
      systemPrompt: prompt.system,
      temperature: 0.2,
      structuredOutput: {
        name: 'suggest_tag_cleanup',
        description: 'Analyze tags for cleanup. Prioritize suggesting hierarchy for flat tags (e.g. "魔法" → "漫画/魔法").',
        schema: TAG_SUGGESTIONS_SCHEMA,
      },
    });
    return this.parseTagSuggestionResult(response);
  }

  // ─── 衍生方法 ───

  async generateTags(content: string, url: string): Promise<string[]> {
    const r = await this.analyzeContent(content, url);
    return r.tags;
  }

  async categorizeContent(content: string, url: string): Promise<string> {
    const r = await this.analyzeContent(content, url);
    return r.category;
  }

  async extractKeywords(content: string, url: string): Promise<string[]> {
    const r = await this.analyzeContent(content, url);
    return r.keywords;
  }

  async generateSummary(content: string, url: string): Promise<string> {
    const r = await this.analyzeContent(content, url);
    return r.summary;
  }

  // ─── OpenAI Chat Completions 调用 ───

  private async callAPI(
    userPrompt: string,
    opts?: { temperature?: number; maxTokens?: number; systemPrompt?: string; structuredOutput?: StructuredOutputConfig }
  ): Promise<string> {
    if (!this.config) throw new Error('AI服务未初始化');

    const defaultMaxRetries = 3;
    const baseDelay = 1000;
    const timeout = 30000;
    const modes = this.getModes(opts?.structuredOutput);
    let lastError: Error | null = null;

    if (opts?.structuredOutput && modes.length < 3) {
      console.log(`📝 跳过已确认不支持的 structured output 模式: [${Array.from(this.unsupportedModes).join(', ')}]`);
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (opts?.systemPrompt) {
      messages.push({ role: 'system', content: opts.systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    for (const mode of modes) {
      const maxRetries = defaultMaxRetries;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        console.log(`🚀 调用 AI API [mode=${mode}] (尝试 ${attempt + 1}/${maxRetries + 1})`);

        const url = `${this.config.baseUrl}/v1/chat/completions`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(this.buildRequestBody(messages, opts, mode)),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          let errText = '';
          try {
            const d = await res.json();
            errText = d.error?.message || JSON.stringify(d.error || d);
          } catch { /* ignore */ }

          console.warn(`❌ AI API [mode=${mode}] HTTP ${res.status}: ${errText || '(无详情)'}`);

          if (opts?.structuredOutput && this.isStructuredOutputUnsupported(res.status, errText, mode)) {
            console.warn(`   → 结构化输出模式 "${mode}" 不受支持，切换到下一模式`);
            this.unsupportedModes.add(mode);
            lastError = new Error(this.statusMessage(res.status, errText));
            break;
          }

          if (this.shouldRetry(res.status) && attempt < maxRetries) {
            const delay = this.retryDelay(res.status, attempt, baseDelay);
            console.log(`⏳ ${res.status} 错误，${delay}ms后重试...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw new Error(this.statusMessage(res.status, errText));
        }

        const data = await res.json();
        const text = this.extractResponseText(data, mode);
        if (!text) throw new Error('AI返回空结果');

        console.log(`✅ AI API调用成功 [mode=${mode}]`);
        return text;
      } catch (error) {
        clearTimeout(timer);

        const msg = (error as Error).message || '';
        lastError = error as Error;
        const isNetwork = msg.includes('Failed to fetch') || msg.includes('NetworkError') || (error as Error).name === 'AbortError';

        console.warn(`❌ AI API [mode=${mode}] 异常: ${msg}`);

        // 返回 HTML = 该端点不支持此模式，直接切换不重试
        const isHtmlResponse = msg.toLowerCase().includes('is not valid json') && msg.includes('<');
        if (opts?.structuredOutput && (isHtmlResponse || this.isStructuredOutputUnsupported(400, msg, mode))) {
          console.warn(`   → 结构化输出模式 "${mode}" 不受支持，切换到下一模式`);
          this.unsupportedModes.add(mode);
          break;
        }

        if (isNetwork && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`⏳ 网络错误，${delay}ms后重试...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (this.isNonRetryableErrorMessage(msg)) {
          throw new Error(this.friendlyError(error as Error));
        }

        if (attempt < maxRetries && !msg.includes('API密钥') && !msg.includes('权限')) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`⏳ 一般错误，${delay}ms后重试...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (mode !== modes[modes.length - 1]) {
          console.warn(`   → 模式 "${mode}" 最终失败，切换到下一模式`);
          break;
        }

        throw new Error(this.friendlyError(error as Error));
      }
      }
    }
    throw new Error(lastError ? this.friendlyError(lastError) : 'AI request failed after all retries');
  }

  /** 深度清理 schema 中 strict 模式不支持的属性（DeepSeek 等） */
  private sanitizeSchemaForStrict(schema: JSONSchema): JSONSchema {
    const UNSUPPORTED_KEYS = new Set(['minItems', 'maxItems', 'minLength', 'maxLength']);
    const clone = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(clone);
      if (obj && typeof obj === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (!UNSUPPORTED_KEYS.has(k)) out[k] = clone(v);
        }
        return out;
      }
      return obj;
    };
    return clone(schema) as JSONSchema;
  }

  private buildRequestBody(
    messages: Array<{ role: string; content: string }>,
    opts: { temperature?: number; maxTokens?: number; structuredOutput?: StructuredOutputConfig } | undefined,
    mode: StructuredMode
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.config!.model,
      messages,
      temperature: opts?.temperature ?? 0.5,
      max_tokens: opts?.maxTokens ?? 8192,
    };

    const structured = opts?.structuredOutput;
    if (structured && this.shouldDisableDeepSeekThinkingForStructuredOutput()) {
      body.thinking = { type: 'disabled' };
    }

    if (!structured || mode === 'prompt') return body;

    const sanitizedSchema = this.sanitizeSchemaForStrict(structured.schema);

    if (mode === 'tool') {
      const functionDefinition: Record<string, unknown> = {
        name: structured.name,
        description: structured.description,
        parameters: sanitizedSchema,
      };

      if (!this.isDeepSeekCompatibleEndpoint() || this.isDeepSeekStrictBetaEndpoint()) {
        functionDefinition.strict = true;
      }

      body.tools = [{
        type: 'function',
        function: functionDefinition,
      }];
      body.tool_choice = {
        type: 'function',
        function: { name: structured.name },
      };
      return body;
    }

    if (mode === 'json_object') {
      body.response_format = { type: 'json_object' };
      return body;
    }

    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: structured.name,
        strict: true,
        schema: sanitizedSchema,
      },
    };
    return body;
  }

  private extractResponseText(data: any, mode: StructuredMode): string {
    const message = data.choices?.[0]?.message;
    if (mode === 'tool') {
      const args = message?.tool_calls?.[0]?.function?.arguments;
      if (typeof args === 'string' && args.trim()) return args;
      if (args && typeof args === 'object') return JSON.stringify(args);
    }

    const text = message?.content;
    if (typeof text === 'string') return text;
    if (Array.isArray(text)) {
      return text
        .map(part => typeof part?.text === 'string' ? part.text : '')
        .join('')
        .trim();
    }
    return '';
  }

  private isStructuredOutputUnsupported(status: number, detail: string, mode: StructuredMode): boolean {
    if (mode === 'prompt') return false;
    if (status !== 400 && status !== 404 && status !== 422) return false;
    const message = detail.toLowerCase();
    // 返回 HTML 而非 JSON = 该端点不支持此模式
    if (message.includes('is not valid json') && (message.includes('<') || message.includes('doctype'))) return true;
    return (
      message.includes('tool') ||
      message.includes('function') ||
      message.includes('response_format') ||
      message.includes('json_schema') ||
      message.includes('schema') ||
      message.includes('unsupported') ||
      message.includes('not support') ||
      message.includes('unknown parameter') ||
      message.includes('unrecognized')
    );
  }

  private shouldRetry(status: number): boolean {
    return status >= 500 || status === 429 || status === 408;
  }

  private isDeepSeekCompatibleEndpoint(): boolean {
    const baseUrl = this.config?.baseUrl.toLowerCase() || '';
    const model = this.config?.model.toLowerCase() || '';
    return (
      baseUrl.includes('deepseek') ||
      baseUrl.includes('micuapi') ||
      model.includes('deepseek')
    );
  }

  private isDeepSeekStrictBetaEndpoint(): boolean {
    const baseUrl = this.config?.baseUrl.toLowerCase() || '';
    return baseUrl.includes('/beta');
  }

  private shouldDisableDeepSeekThinkingForStructuredOutput(): boolean {
    const model = this.config?.model.toLowerCase() || '';
    return this.isDeepSeekCompatibleEndpoint() && model.startsWith('deepseek-v4-');
  }

  private isNonRetryableErrorMessage(message: string): boolean {
    const m = message.toLowerCase();
    return (
      m.includes('(400)') ||
      m.includes('(401)') ||
      m.includes('(402)') ||
      m.includes('(403)') ||
      m.includes('(404)') ||
      m.includes('insufficient balance') ||
      m.includes('payment required') ||
      m.includes('api密钥') ||
      m.includes('权限')
    );
  }

  private retryDelay(status: number, attempt: number, base: number): number {
    const mult = status === 503 ? 2 : status === 429 ? 1.5 : 1;
    return base * Math.pow(2, attempt) * mult;
  }

  private statusMessage(status: number, detail: string): string {
    switch (status) {
      case 400: return `请求参数错误 (400): ${detail}`;
      case 401: return 'API密钥无效或已过期 (401)，请检查AI API配置';
      case 402: return `API余额不足或需要付费 (402)${detail ? `：${detail}` : ''}`;
      case 403: return 'API访问被拒绝 (403)，请检查权限';
      case 404: return 'API端点不存在 (404)，请检查Base URL和模型名称';
      case 429: return '请求频率过高 (429)，请稍后重试';
      case 503: return '服务暂时不可用 (503)，请稍后重试';
      default: return `请求失败 (${status}): ${detail || '未知错误'}`;
    }
  }

  private friendlyError(error: Error): string {
    const m = error.message.toLowerCase();
    if (m.includes('failed to fetch') || m.includes('networkerror')) return '网络连接失败，请检查网络';
    if (m.includes('timeout') || m.includes('abort')) return '请求超时，请稍后重试';
    if (m.includes('401') || m.includes('api key')) return 'API密钥配置错误，请检查设置';
    if (m.includes('402') || m.includes('insufficient balance') || m.includes('payment required')) return 'API余额不足或需要付费，请检查供应商账户余额';
    if (m.includes('429') || m.includes('rate')) return '请求过于频繁，请稍后重试';
    return `AI分析失败: ${error.message}`;
  }

  // ─── Prompt 构建 ───

  private formatTagTreeForAI(tags: Tag[], tagCounts?: Map<string, number>): string {
    const tagMap = new Map(tags.map(t => [t.id, t]));

    function buildPath(tagId: string): string[] {
      const path: string[] = [];
      let current = tagMap.get(tagId);
      let safety = 0;
      while (current && safety < 50) {
        path.unshift(current.name);
        if (!current.parentId) break;
        current = tagMap.get(current.parentId);
        safety++;
      }
      return path;
    }

    const roots = tags.filter(t => !t.parentId);
    function render(nodes: Tag[], indent: string): string {
      return nodes
        .map(node => {
          const path = buildPath(node.id).join('/');
          const count = tagCounts?.get(node.id) || 0;
          const suffix = count > 0 ? ` [${count}个书签使用]` : '';
          const line = `${indent}- ${path}${suffix}`;
          const children = tags.filter(t => t.parentId === node.id);
          if (children.length > 0) {
            return line + '\n' + render(children, indent + '  ');
          }
          return line;
        })
        .join('\n');
    }

    return roots.length > 0 ? render(roots, '') : '（暂无标签）';
  }

  private resolveOutputLanguage(): OutputLanguage {
    const locale = tryGetUiLanguage()?.trim();
    return locale || 'en';
  }

  private buildOutputLanguageInstruction(outputLanguage: OutputLanguage): string {
    if (this.isChineseLocale(outputLanguage)) {
      return `# 输出语言要求
- 所有可读文本字段必须使用简体中文输出
- 包括 simulated_persona、tags、category、categoryReason、keywords、summary
- 除专有名词、产品名、URL、代码标识符外，不要输出英文句子
- 当前 Chrome UI locale: ${outputLanguage}`;
    }

    if (this.isEnglishLocale(outputLanguage)) {
      return `# Output Language Requirements
- Every user-facing text field MUST be written in English
- This includes simulated_persona, tags, category, categoryReason, keywords, and summary
- Do not output other languages unless a proper noun, brand name, URL, or code identifier must stay as-is
- Current Chrome UI locale: ${outputLanguage}`;
    }

    return `# Output Language Requirements
- Every user-facing text field MUST be written in the Chrome UI language locale: ${outputLanguage}
- This includes simulated_persona, tags, category, categoryReason, keywords, and summary
- Use natural, fluent wording for locale ${outputLanguage}; do not default to English or Simplified Chinese
- Keep only proper nouns, brand names, URLs, and code identifiers in their original form when necessary`;
  }

  private buildAnalysisPrompt(
    content: string,
    url: string,
    categoryContext?: CategoryArchiveContext,
    existingTags?: Tag[],
    tagCounts?: Map<string, number>,
    outputLanguage: OutputLanguage = 'zh-CN'
  ): { system: string; user: string } {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const isHomePage = urlObj.pathname === '/' || urlObj.pathname === '' || urlObj.pathname === '/index.html';

    const isChineseOutput = this.isChineseLocale(outputLanguage);
    const existingTree = categoryContext
      ? formatCategoryTreeForAI(categoryContext.categories, categoryContext.bookmarkCountByCategoryId)
      : isChineseOutput
        ? '（未加载分类数据）'
        : '(no category tree loaded)';

    const existingTagTree = existingTags?.length
      ? this.formatTagTreeForAI(existingTags, tagCounts)
      : isChineseOutput
        ? '（暂无现有标签）'
        : '(no existing tags)';

    const taxonomyRules = formatTaxonomyRulesForAI();
    const outputLanguageInstruction = this.buildOutputLanguageInstruction(outputLanguage);
    const outputFormatIntro =
      isChineseOutput
        ? '必须返回严格 JSON，格式如下：'
        : `Return strict JSON in the following format. Replace every placeholder with natural output in locale ${outputLanguage}:`;
    const outputExample =
      isChineseOutput
        ? `{
  "simulated_persona": "用户画像描述（禁止超过30字）",
  "tags": ["视频/B站", "视频/B站/弹幕", "二次元/ACG", "Coser/enako", "动画/新番", "动画/作品/鬼灭之刃", "漫画/日系", "漫画/风格/热血", "声优/花江夏樹", "漫画/奇幻/魔法", "动画/制作/ufotable", "社区/讨论"],
  "category": "一级/二级/三级/四级",
  "categoryDecision": "reuse|extend|create",
  "categoryReason": "说明选择此路径及决策类型（禁止超过40字）",
  "keywords": ["关键词1", "关键词2"],
  "summary": "用户视角的摘要，100-200字"
}`
        : `{
  "simulated_persona": "<persona in locale ${outputLanguage}, must not exceed ${PERSONA_TARGET_LENGTH} characters>",
  "tags": ["<localized/tag/path/1>", "<localized/tag/path/2>"],
  "category": "<localized/category/path>",
  "categoryDecision": "reuse|extend|create",
  "categoryReason": "<reason in locale ${outputLanguage}, must not exceed ${CATEGORY_REASON_TARGET_LENGTH} characters>",
  "keywords": ["<keyword1 in locale ${outputLanguage}>", "<keyword2 in locale ${outputLanguage}>"],
  "summary": "<objective summary in locale ${outputLanguage}>"
}`;

    const system = `${outputLanguageInstruction}

# Role
你是一名经验丰富、思想成熟的网站内容策略师与信息架构师。

# Workflow
1. 全面审查用户提供的网页内容。
2. 识别核心实体，区分主要实体和次要实体。
3. 识别网站性格并模拟用户角色，输出用户画像；simulated_persona 禁止超过 ${PERSONA_TARGET_LENGTH} 字。
4. 多维度标签提取：生成 12-22 条**层级标签路径**（每条为 tag tree 上的一条完整路径，见 Tag Rules）。
5. **分类决策**（参考 Category Taxonomy Rules 与用户消息中的已有分类树）：
   - 先扫描用户消息中的 <existing_category_tree>，判断内容能否归入已有路径
   - 决策 reuse（完全复用已有路径）/ extend（复用前缀、补全新末级）/ create（新建完整路径）
   - 路径最多4级，书签应归入最深层级（优先L4，至少L3）
   - **L4 实体例外**：页面核心围绕某位作者、特定人名或特定角色时，第4级直接用其人名/角色名（不要加「漫画家·」「导演·」「角色·」等类型前缀），单条书签也可建 L4；一般技术/主题子题仍遵守「3+ 相似书签再建 L4」
6. 核心关键词提炼（4-5个）。
7. categoryReason 只说明路径选择与决策类型，不要展开成长段解释，禁止超过 ${CATEGORY_REASON_TARGET_LENGTH} 字。
8. 撰写摘要（用户视角，围绕主要实体）：你需要代入目标用户来理解内容，但摘要本身必须是客观描述，禁止出现"作为...""身为..."等角色扮演前缀，禁止第一人称。
9. 格式化为严格 JSON。

# Category Taxonomy Rules
${taxonomyRules}

# Tag Rules（tags 字段 = 多条「完整路径」，不是扁平词表）
- tags 是 **tag tree 路径数组**：每条字符串表示从根到叶的一条路径，用 "/" 连接（如 "漫画/奇幻/魔法"、"视频/B站/弹幕"）
- 输出 12-22 条，覆盖内容各侧面；**不要**与 category 整段路径重复，但可共享 category 的前缀（如 category 为 "娱乐/漫画/在线" 时，标签可用 "漫画/奇幻"）
- **硬性约束**：除最多 2 条「领域根节点」（仅 1 段、无 "/"，如 "漫画"、"编程"）外，**其余每一条必须含 "/"**。禁止 "魔法"、"日系"、"弹幕" 等无父级的孤立词
- **禁止直接抄录**网页原始 tag 列表；须重组为层级路径
- 构建顺序：先定领域根 → 再写 "领域/主题" → 需要时写 "领域/主题/实体"（2-3 级为主，少数 4 级）
- 示例映射：React→编程/React，enako→Coser/enako，魔法→漫画/奇幻/魔法，B站→视频/B站，日系→漫画/日系（禁止单独 "日系"）
- 不要用 "平台/"、"人物/"、"风格/" 作人为维度前缀；领域名本身即父级（用 "视频/B站" 而非 "平台/B站"）
- **优先复用** <existing_tag_tree> 中已有路径；禁止为已有 "编程/TypeScript" 再输出扁平 "TypeScript"
- **禁止跨父级同名（最高优先级）**：如果 <existing_tag_tree> 中已存在某叶子名（如 "编程/TypeScript"），禁止在其他父级下再建同名叶子（如 "前端/TypeScript"）。已有叶子名只能复用其完整路径，不得在新父级下重复创建
- **近义词合并（最高优先级）**：语义相同或高度相近的概念必须合并到同一条路径，不要拆成多条。合并时保留**更通用、覆盖面更广**的那个词，淘汰窄词。例如"视频/3D动画"和"动画/3D动画"→保留"动画/3D动画"（动画是更通用的上位概念）；"编程/AI"和"技术/人工智能"→保留"编程/AI"（AI 更通用简短）。先扫描 <existing_tag_tree> 中是否已有语义等价的路径，有则直接复用，不要新建变体。标签数量有限（12-22条），每条都应覆盖一个独立维度，近义词拆开 = 浪费名额

# Output Format
${outputFormatIntro}
${outputExample}`;

    const user = `# Existing Category Tree
<existing_category_tree>
${existingTree}
</existing_category_tree>

# Existing Tag Tree
<existing_tag_tree>
${existingTagTree}
</existing_tag_tree>

# Tag Output Constraint（最高优先级，覆盖其他宽松理解）
- tags 数组中：至少 10 条必须包含 "/"
- 自检：若超过 2 条不含 "/"，必须改写为层级路径后再输出

# Input Data
<url>${url}</url>
<domain>${domain}</domain>
<page_type>${isHomePage ? '主页/首页' : '内容页面'}</page_type>
<web_content>
${content.substring(0, 8000)}
</web_content>`;

    return { system, user };
  }

  private buildTagSuggestionPrompt(tags: Tag[], tagCounts: Map<string, number>): { system: string; user: string } {
    const outputLanguage = this.resolveOutputLanguage();
    const tagMap = new Map(tags.map(t => [t.id, t]));

    function buildPath(tagId: string): string[] {
      const path: string[] = [];
      let current = tagMap.get(tagId);
      let safety = 0;
      while (current && safety < 50) {
        path.unshift(current.name);
        if (!current.parentId) break;
        current = tagMap.get(current.parentId);
        safety++;
      }
      return path;
    }

    const tagLines = tags
      .map(tag => {
        const path = buildPath(tag.id).join('/');
        const count = tagCounts.get(tag.id) || 0;
        return `  - ${path} (使用 ${count} 次)`;
      })
      .join('\n');

    const system = this.isChineseLocale(outputLanguage)
      ? `你是专业数据分析师。请分析用户提供的标签层级结构及使用频率，识别可合并的相似/同义标签、可提升层级的扁平标签、以及冗余标签，返回严格 JSON 数组格式。

# 分析原则
- 标签层级应从独立维度展开（内容类型、技术主题、技术栈、难度等），不要和分类维度重叠
- **优先建议扁平标签归入层级**。大量使用频率高但没有父级的扁平标签是最大问题，应优先建议为其建立层级归属（如 "魔法" → "漫画/魔法"，"TypeScript" → "编程/TypeScript"）
- 同维度下的叶子节点若语义相近，可建议合并
- 孤立的热门标签可考虑建议为其建立层级归属
- 父子标签如果经常同时出现在同一书签上，可能层级设计有问题`
      : `You are a data analyst. Review the tag hierarchy and usage frequency, identify duplicate or redundant tags, flat tags that should be moved into a hierarchy, and return a strict JSON array.

# Rules
- Keep hierarchy dimensions independent (content type, topic, tech stack, difficulty, etc.) and avoid duplicating category semantics
- Prioritize moving flat high-frequency tags into hierarchical paths
- Merge semantically similar leaf nodes under the same dimension
- Popular isolated tags should usually be assigned a parent path
- If parent and child tags often appear together on the same bookmark, the hierarchy may need cleanup
- Write every reason, sourceTag, targetTag, and newName in the Chrome UI language locale ${outputLanguage}, unless a proper noun must stay as-is`;

    const user = this.isChineseLocale(outputLanguage)
      ? `标签层级列表:
${tagLines}

请以JSON数组格式返回清理建议：
[
  { "action": "merge", "sourceTag": "原始标签路径", "targetTag": "目标标签路径", "newName": null, "reason": "原因" },
  { "action": "rename", "sourceTag": "原始标签路径", "targetTag": null, "newName": "新标签路径", "reason": "原因" },
  { "action": "delete", "sourceTag": "冗余标签路径", "targetTag": null, "newName": null, "reason": "原因" }
]`
      : `Tag hierarchy list:
${tagLines}

Return cleanup suggestions as a JSON array:
[
  { "action": "merge", "sourceTag": "<source tag path in locale ${outputLanguage}>", "targetTag": "<target tag path in locale ${outputLanguage}>", "newName": null, "reason": "<reason in locale ${outputLanguage}>" },
  { "action": "rename", "sourceTag": "<source tag path in locale ${outputLanguage}>", "targetTag": null, "newName": "<new tag path in locale ${outputLanguage}>", "reason": "<reason in locale ${outputLanguage}>" },
  { "action": "delete", "sourceTag": "<redundant tag path in locale ${outputLanguage}>", "targetTag": null, "newName": null, "reason": "<reason in locale ${outputLanguage}>" }
]`;

    return { system, user };
  }

  // ─── 响应解析 ───

  /**
   * 将扁平 tag 尽量挂到 category 或同批已有层级路径下，避免落库为孤立根节点。
   */
  private normalizeHierarchicalTags(tags: string[], category: string): string[] {
    const trimmed = tags.map(t => t.trim()).filter(Boolean);
    const hierarchical = trimmed.filter(t => t.includes('/'));
    const catParts = category.split('/').map(p => p.trim()).filter(Boolean);
    const defaultParent =
      catParts.length >= 2 ? `${catParts[0]}/${catParts[1]}` : catParts[0] || '通用';

    let rootCount = 0;
    const maxRoots = 2;

    return trimmed.map(tag => {
      if (tag.includes('/')) return tag;

      const existingPath = hierarchical.find(
        h => h === tag || h.endsWith(`/${tag}`) || h.split('/').pop() === tag
      );
      if (existingPath) return existingPath;

      if (rootCount < maxRoots && !catParts.includes(tag)) {
        rootCount++;
        return tag;
      }

      return `${defaultParent}/${tag}`;
    });
  }

  private parseJSON(response: string): any {
    // 尝试 markdown 代码块
    const mdMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (mdMatch) {
      try { return JSON.parse(mdMatch[1].trim()); } catch { /* fall through */ }
    }
    // 尝试花括号/方括号范围
    const startBrace = response.indexOf('{');
    const startBracket = response.indexOf('[');
    if (startBrace !== -1 || startBracket !== -1) {
      const first = Math.min(
        startBrace === -1 ? Infinity : startBrace,
        startBracket === -1 ? Infinity : startBracket
      );
      const char = response[first];
      const closer = char === '{' ? '}' : ']';
      const last = response.lastIndexOf(closer);
      if (last > first) {
        try { return JSON.parse(response.substring(first, last + 1)); } catch { /* fall through */ }
      }
    }
    throw new Error('AI返回格式错误，无法解析JSON');
  }

  private parseAnalysisResult(response: string, url?: string): AIAnalysisResult {
    try {
      const result = this.parseJSON(response);
      const rawCategory = typeof result.category === 'string' && result.category.trim()
        ? result.category.trim()
        : '其他';
      const decision = ['reuse', 'extend', 'create'].includes(result.categoryDecision)
        ? result.categoryDecision
        : undefined;

      const rawTags = Array.isArray(result.tags)
        ? result.tags.slice(0, 22).filter((t: any) => typeof t === 'string' && t.trim())
        : [];
      const normalizedCategory = normalizeCategoryPath(rawCategory);
      const normalizedTags = this.normalizeHierarchicalTags(rawTags, normalizedCategory);
      const slashCount = normalizedTags.filter(t => t.includes('/')).length;
      if (rawTags.length > 0 && slashCount < Math.min(10, normalizedTags.length - 2)) {
        console.warn(
          `[AIService] 层级标签占比偏低: ${slashCount}/${normalizedTags.length} 含 "/"，已尝试 normalize`,
          { raw: rawTags.slice(0, 8) }
        );
      }

      const final: AIAnalysisResult = {
        simulated_persona:
          typeof result.simulated_persona === 'string' && result.simulated_persona.trim()
            ? result.simulated_persona.trim()
            : '未知用户',
        tags: normalizedTags,
        category: normalizedCategory,
        categoryDecision: decision,
        categoryReason: typeof result.categoryReason === 'string' ? result.categoryReason : undefined,
        keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 5).filter((k: any) => typeof k === 'string' && k.trim()) : [],
        summary: typeof result.summary === 'string' && result.summary.trim() ? result.summary.substring(0, 200) : '暂无摘要',
      };
      if (final.tags.length === 0) final.tags = ['通用/网页内容'];
      return final;
    } catch {
      return this.parseTextResponse(response);
    }
  }

  private parseTextResponse(response: string): AIAnalysisResult {
    const result: AIAnalysisResult = { tags: [], category: '其他', keywords: [], summary: '' };

    const tagMatch = response.match(/标签[：:]?\s*([^\n]+)/i) || response.match(/tags[：:]?\s*([^\n]+)/i);
    if (tagMatch) result.tags = tagMatch[1].split(/[,，、]/).map(t => t.trim()).filter(Boolean);

    const catMatch = response.match(/分类[：:]?\s*([^\n]+)/i) || response.match(/category[：:]?\s*([^\n]+)/i);
    if (catMatch) result.category = catMatch[1].trim();

    const kwMatch = response.match(/关键词[：:]?\s*([^\n]+)/i) || response.match(/keywords[：:]?\s*([^\n]+)/i);
    if (kwMatch) result.keywords = kwMatch[1].split(/[,，、]/).map(k => k.trim()).filter(Boolean);

    const sumMatch = response.match(/摘要[：:]?\s*([^\n]+)/i) || response.match(/summary[：:]?\s*([^\n]+)/i);
    result.summary = sumMatch ? sumMatch[1].trim() : response.substring(0, 100).replace(/[\n\r]/g, ' ').trim();

    if (result.tags.length === 0) result.tags = ['通用/文本解析', '通用/需要优化'];
    if (!result.summary) result.summary = '文本解析模式，建议检查AI响应格式';
    result.simulated_persona = '文本解析用户';
    return result;
  }

  private parseTagSuggestionResult(response: string): TagSuggestion[] {
    try {
      const parsed = this.parseJSON(response);
      if (!Array.isArray(parsed) && Array.isArray(parsed?.suggestions)) {
        return parsed.suggestions.map((suggestion: any) => ({
          ...suggestion,
          sourceTag: suggestion.sourceTag ?? undefined,
          targetTag: suggestion.targetTag ?? undefined,
          newName: suggestion.newName ?? undefined,
        })) as TagSuggestion[];
      }
      if (!Array.isArray(parsed)) throw new Error('非数组');
      const suggestions = parsed;
      if (!Array.isArray(suggestions)) throw new Error('Invalid tag suggestions payload');
      return suggestions.map((suggestion: any) => ({
        ...suggestion,
        sourceTag: suggestion.sourceTag ?? undefined,
        targetTag: suggestion.targetTag ?? undefined,
        newName: suggestion.newName ?? undefined,
      })) as TagSuggestion[];
    } catch (error) {
      console.error('解析标签建议失败:', error);
      throw new Error('无法解析AI返回的标签建议');
    }
  }
}

// ─── Agent / 多轮对话 + 工具调用 ───

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  /** DeepSeek 等 thinking 模式返回的推理内容，多轮对话必须回传 */
  reasoning_content?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionMessage {
  content: string | null;
  toolCalls: ToolCall[];
  /** DeepSeek thinking 模式的 reasoning_content */
  reasoningContent?: string;
}

export class AIChatService {
  private static instance: AIChatService;
  private config: AIConfig | null = null;

  public static getInstance(): AIChatService {
    if (!AIChatService.instance) {
      AIChatService.instance = new AIChatService();
    }
    return AIChatService.instance;
  }

  async initialize(settings: Settings): Promise<void> {
    this.config = {
      apiKey: settings.aiApiKey || '',
      baseUrl: (settings.aiApiBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ''),
      model: settings.aiModel || DEFAULT_MODEL,
    };
  }

  resetConfig(): void {
    this.config = null;
  }

  /**
   * 多轮对话 + 工具调用
   * 返回 AI 的回复文本，以及请求调用的工具列表
   */
  async chatWithTools(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    opts?: { temperature?: number; maxTokens?: number; systemPrompt?: string }
  ): Promise<ChatCompletionMessage> {
    if (!this.config) throw new Error('AI服务未初始化');

    const defaultMaxRetries = 2;
    const baseDelay = 1000;
    const timeout = 60000;

    const bodyMessages = messages.map(m => {
      const base: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.role === 'tool') {
        base.tool_call_id = m.tool_call_id;
        base.name = m.name;
      }
      if (m.role === 'assistant' && m.tool_calls) {
        base.tool_calls = m.tool_calls;
        base.content = m.content || null;
      }
      // DeepSeek thinking 模式：必须回传 reasoning_content
      if (m.role === 'assistant' && m.reasoning_content) {
        base.reasoning_content = m.reasoning_content;
      }
      return base;
    });

    if (opts?.systemPrompt && bodyMessages[0]?.role !== 'system') {
      bodyMessages.unshift({ role: 'system', content: opts.systemPrompt });
    }

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: bodyMessages,
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.maxTokens ?? 4096,
    };

    if (tools.length > 0) {
      body.tools = tools;
    }

    for (let attempt = 0; attempt <= defaultMaxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const url = `${this.config.baseUrl}/v1/chat/completions`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          let errText = '';
          try {
            const d = await res.json();
            errText = d.error?.message || JSON.stringify(d.error || d);
          } catch { /* ignore */ }

          if (this.shouldRetry(res.status) && attempt < defaultMaxRetries) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`⏳ AI Agent ${res.status} 错误，${delay}ms后重试...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw new Error(`AI Agent 请求失败 (${res.status}): ${errText || '未知错误'}`);
        }

        const data = await res.json();
        const message = data.choices?.[0]?.message;
        const content = message?.content ?? null;
        const reasoningContent = message?.reasoning_content ?? undefined;
        const rawToolCalls = message?.tool_calls || [];
        const toolCalls: ToolCall[] = rawToolCalls.map((tc: any) => ({
          id: tc.id || `call_${Date.now()}`,
          type: tc.type || 'function',
          function: {
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || '{}',
          },
        }));

        return { content, toolCalls, reasoningContent };
      } catch (error) {
        clearTimeout(timer);
        const msg = (error as Error).message || '';
        const isNetwork = msg.includes('Failed to fetch') || msg.includes('NetworkError') || (error as Error).name === 'AbortError';

        if (isNetwork && attempt < defaultMaxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`⏳ AI Agent 网络错误，${delay}ms后重试...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        throw new Error(`AI Agent 调用失败: ${msg}`);
      }
    }

    throw new Error('AI Agent 请求在所有重试后失败');
  }

  private shouldRetry(status: number): boolean {
    return status >= 500 || status === 429 || status === 408 || status === 402;
  }
}

export const aiChatService = AIChatService.getInstance();

// 保持向后兼容
export const aiService = AIService.getInstance();
