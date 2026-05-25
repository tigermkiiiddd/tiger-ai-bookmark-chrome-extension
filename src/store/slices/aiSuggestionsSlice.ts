import { AIService } from '../../services/ai';
import { screenshotService } from '../../services/screenshotService';
import { StorageService } from '../../services/storage';
import { tagService } from '../../services/tagService';
import { tagStorage } from '../../core/storage/tagStorage';
import { buildCategoryArchiveContext } from '../../utils/buildCategoryArchiveContext';
import { resolveCategoryByName, normalizeCategoryPath } from '../../utils/categoryTreeBuilder';

const aiService = AIService.getInstance();
const storageService = StorageService.getInstance();

export const aiSuggestionsInitialState = {
  tagSuggestions: [] as any[],
  isGeneratingSuggestions: false,
  suggestionError: null as string | null,
  categorySuggestions: [] as any[],
  isGeneratingCategorySuggestions: false,
  categorySuggestionError: null as string | null,
};

export function createAISuggestionsSlice(
  set: (partial: any) => void,
  get: () => any
) {
  return {
    generateTagSuggestions: async () => {
      set({ isGeneratingSuggestions: true, suggestionError: null });
      try {
        const state = get();
        const { settings, bookmarks } = state;

        await aiService.initialize(settings);

        const tagCounts = new Map<string, number>();
        bookmarks.forEach((bookmark: any) => {
          bookmark.tagIds?.forEach((tagId: string) => {
            tagCounts.set(tagId, (tagCounts.get(tagId) || 0) + 1);
          });
        });

        console.log('[标签建议] 收集到的标签统计:', Object.fromEntries(tagCounts));

        const rawSuggestions = await aiService.generateTagSuggestions(state.tags, tagCounts);
        console.log('[标签建议] AI生成的原始建议:', rawSuggestions);

        const allNames = new Set<string>();
        rawSuggestions.forEach((s: any) => {
          if (s.sourceTag) allNames.add(s.sourceTag);
          if (s.targetTag) allNames.add(s.targetTag);
          if (s.newName) allNames.add(s.newName);
        });
        const allResolvedIds = await tagService.ensureTagIds([...allNames]);
        const nameToId = new Map([...allNames].map((name, i) => [name, allResolvedIds[i]]));

        const suggestions = rawSuggestions.map((rawSuggestion: any, index: number) => ({
          id: `suggestion_${Date.now()}_${index}`,
          tagIdsToMerge: rawSuggestion.action === 'merge' && rawSuggestion.sourceTag
            ? [nameToId.get(rawSuggestion.sourceTag)!, nameToId.get(rawSuggestion.targetTag || '')!].filter(Boolean)
            : [nameToId.get(rawSuggestion.sourceTag || '')!].filter(Boolean),
          suggestedName: rawSuggestion.newName || rawSuggestion.targetTag || '',
          reason: rawSuggestion.reason,
          status: 'pending' as const
        }));

        console.log('[标签建议] 转换后的建议:', suggestions);

        set({
          tagSuggestions: suggestions,
          isGeneratingSuggestions: false
        });
      } catch (error) {
        console.error('生成标签建议失败:', error);
        set({
          suggestionError: error instanceof Error ? error.message : '生成建议失败',
          isGeneratingSuggestions: false
        });
      }
    },

    applyTagSuggestion: async (suggestionId: string) => {
      const state = get();
      const suggestion = state.tagSuggestions.find((s: any) => s.id === suggestionId);
      if (!suggestion) return;

      try {
        console.log(`[标签合并] 开始合并标签: ${suggestion.tagIdsToMerge.join(', ')} -> ${suggestion.suggestedName}`);

        const tagIdsToMerge = suggestion.tagIdsToMerge;
        const targetTagName = suggestion.suggestedName;
        const [targetTagId] = await tagService.ensureTagIds([targetTagName]);
        await get().loadTags();

        let updatedBookmarks = 0;
        for (const bookmark of state.bookmarks) {
          const hasTagsToMerge = bookmark.tagIds?.some((tagId: string) => tagIdsToMerge.includes(tagId));
          if (hasTagsToMerge) {
            const newTagIds = (bookmark.tagIds || [])
              .filter((tagId: string) => !tagIdsToMerge.includes(tagId))
              .concat(targetTagId);

            const uniqueTagIds = [...new Set(newTagIds)];

            await get().updateBookmark(bookmark.id, { tagIds: uniqueTagIds });
            updatedBookmarks++;
          }
        }

        console.log(`[标签合并] 成功更新了 ${updatedBookmarks} 个书签的标签`);

        await tagStorage.deleteMany(tagIdsToMerge);
        await get().loadTags();

        set({
          tagSuggestions: state.tagSuggestions.map((s: any) =>
            s.id === suggestionId ? { ...s, status: 'applied' as const } : s
          )
        });

        console.log(`[标签合并] 标签合并完成: ${tagIdsToMerge.join(', ')} -> ${targetTagName}`);
      } catch (error) {
        console.error('应用标签建议失败:', error);
        throw error;
      }
    },

    rejectTagSuggestion: async (suggestionId: string) => {
      const state = get();
      const updatedSuggestions = state.tagSuggestions.map((s: any) =>
        s.id === suggestionId ? { ...s, status: 'rejected' as const } : s
      );
      set({ tagSuggestions: updatedSuggestions });
    },

    generateCategorySuggestions: async () => {
      set({ isGeneratingCategorySuggestions: true, categorySuggestionError: null });
      try {
        const state = get();
        const { settings, bookmarks, categories } = state;

        await aiService.initialize(settings);

        const suggestions: any[] = [];

        for (const bookmark of bookmarks.slice(0, 10)) {
          try {
            const screenshot = await screenshotService.captureUrl(bookmark.url);
            const content = bookmark.title + ' ' + (bookmark.description || '') + ' ' + bookmark.url;
            const categoryContext = buildCategoryArchiveContext({ categories, bookmarks });
            const analysis = await aiService.analyzeContent(content, bookmark.url, undefined, categoryContext, state.tags);

            if (analysis.category) {
              const normalizedPath = normalizeCategoryPath(analysis.category);
              const matched = resolveCategoryByName(normalizedPath, categories);
              if (!matched) {
                suggestions.push({
                  id: `cat_suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  bookmarkIds: [bookmark.id],
                  suggestedCategory: normalizedPath,
                  reason: analysis.categoryReason || '基于页面内容分析建议的分类',
                  status: 'pending'
                });
              }
            }
          } catch (error) {
            console.warn('分析书签分类失败:', bookmark.title, error);
          }
        }

        set({ categorySuggestions: suggestions, isGeneratingCategorySuggestions: false });
      } catch (error) {
        console.error('生成分类建议失败:', error);
        set({
          categorySuggestionError: error instanceof Error ? error.message : '生成建议失败',
          isGeneratingCategorySuggestions: false
        });
      }
    },

    applyCategorySuggestion: async (suggestionId: string) => {
      const state = get();
      const suggestion = state.categorySuggestions.find((s: any) => s.id === suggestionId);
      if (!suggestion) return;

      try {
        let categoryId: string | undefined;
        const normalizedPath = normalizeCategoryPath(suggestion.suggestedCategory);
        const matched = resolveCategoryByName(normalizedPath, state.categories);
        if (matched) {
          categoryId = matched.id;
        } else {
          const category = await storageService.ensureCategoryPath(normalizedPath);
          const categories = await storageService.getCategories();
          set({ categories });
          categoryId = category.id;
        }

        for (const bookmarkId of suggestion.bookmarkIds) {
          await get().updateBookmark(bookmarkId, { categoryId });
        }

        const updatedSuggestions = state.categorySuggestions.map((s: any) =>
          s.id === suggestionId ? { ...s, status: 'applied' as const } : s
        );
        set({ categorySuggestions: updatedSuggestions });
      } catch (error) {
        console.error('应用分类建议失败:', error);
      }
    },

    rejectCategorySuggestion: async (suggestionId: string) => {
      const state = get();
      const updatedSuggestions = state.categorySuggestions.map((s: any) =>
        s.id === suggestionId ? { ...s, status: 'rejected' as const } : s
      );
      set({ categorySuggestions: updatedSuggestions });
    },
  };
}
