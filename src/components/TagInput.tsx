import React, { useState, useRef, useEffect, KeyboardEvent, useMemo } from 'react';
import { X } from 'lucide-react';
import { useBookmarkStore } from '../store/index';
import { tagService } from '../services/tagService';
import { buildTagPathByIdMap } from '../utils/tagPath';

interface TagInputProps {
  tagIds?: string[];
  onTagIdsChange?: (tagIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const TagInput: React.FC<TagInputProps> = ({
  tagIds = [],
  onTagIdsChange,
  placeholder = "添加标签，按回车确认...",
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const { tags, bookmarks, loadTags } = useBookmarkStore();
  const tagPathById = useMemo(() => buildTagPathByIdMap(tags), [tags]);
  const names = useMemo(() => tagIds.map(id => tagPathById.get(id) || id), [tagIds, tagPathById]);

  const allTagPaths = useMemo(() => {
    const seen = new Set<string>();
    const paths: string[] = [];
    for (const tag of tags) {
      const path = tagPathById.get(tag.id) || tag.id;
      if (!seen.has(path)) {
        seen.add(path);
        paths.push(path);
      }
    }
    return paths;
  }, [tags, tagPathById]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of bookmarks) {
      for (const tagId of (b.tagIds || [])) {
        const path = tagPathById.get(tagId) || tagId;
        counts.set(path, (counts.get(path) || 0) + 1);
      }
    }
    return counts;
  }, [bookmarks, tagPathById]);

  // 生成标签建议
  const generateSuggestions = (input: string) => {
    if (!input.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = allTagPaths
      .filter(tag =>
        tag.toLowerCase().includes(input.toLowerCase()) &&
        !names.includes(tag)
      )
      .sort((a, b) => {
        // 按使用频率排序
        const countA = tagCounts.get(a) || 0;
        const countB = tagCounts.get(b) || 0;
        return countB - countA;
      })
      .slice(0, 5);

    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setSelectedSuggestionIndex(-1);
  };

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    generateSuggestions(newValue);
  };

  // 添加标签
  const addTag = async (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !names.includes(trimmedTag)) {
      const newNames = [...names, trimmedTag];
      const newIds = await tagService.ensureTagIds(newNames);
      await loadTags();
      onTagIdsChange?.(newIds);
    }
    setInputValue('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  // 删除标签
  const removeTag = async (tagToRemove: string) => {
    const newNames = names.filter(tag => tag !== tagToRemove);
    const newIds = await tagService.ensureTagIds(newNames);
    await loadTags();
    onTagIdsChange?.(newIds);
  };

  // 处理键盘事件
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
          addTag(suggestions[selectedSuggestionIndex]);
        } else if (inputValue.trim()) {
          addTag(inputValue);
        }
        break;
        
      case ',':
        e.preventDefault();
        if (inputValue.trim()) {
          addTag(inputValue);
        }
        break;
        
      case 'Backspace':
        if (!inputValue && names.length > 0) {
          removeTag(names[names.length - 1]);
        }
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        if (showSuggestions) {
          setSelectedSuggestionIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
        }
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        if (showSuggestions) {
          setSelectedSuggestionIndex(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
        }
        break;
        
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // 处理建议点击
  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion);
    inputRef.current?.focus();
  };

  // 处理输入框焦点
  const handleInputFocus = () => {
    if (inputValue.trim()) {
      generateSuggestions(inputValue);
    }
  };

  const handleInputBlur = () => {
    // 延迟隐藏建议，以便处理点击事件
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }, 200);
  };

  return (
    <div className="relative">
      {/* 标签容器 */}
      <div 
        className={`min-h-[42px] w-full px-3 py-2 border rounded-md transition-colors ${
          disabled 
            ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary'
        } flex flex-wrap items-center gap-1`}
        onClick={() => inputRef.current?.focus()}
      >
        {/* 已添加的标签 */}
        {names.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="ml-1 text-primary/70 hover:text-primary/90 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {/* 输入框 */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          disabled={disabled}
          placeholder={names.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />
      </div>

      {/* 建议下拉框 */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                selectedSuggestionIndex === index
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span className="font-medium">{suggestion}</span>
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                {tagCounts.get(suggestion) || 0} 次使用
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagInput;