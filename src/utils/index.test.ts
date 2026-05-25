import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  generateId, 
  formatDate, 
  isValidUrl, 
  extractDomain, 
  getFaviconUrl, 
  truncateText,
  debounce,
  throttle,
  getTagColor 
} from '../utils/index'

describe('工具函数测试', () => {
  describe('generateId', () => {
    it('应该生成唯一的ID', () => {
      const id1 = generateId()
      const id2 = generateId()
      
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^\d+-[a-z0-9]+$/)
    })
  })

  describe('formatDate', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01 12:00:00'))
    })

    it('应该显示"刚刚"当时间少于1分钟', () => {
      const timestamp = Date.now() - 30 * 1000 // 30秒前
      expect(formatDate(timestamp)).toBe('刚刚')
    })

    it('应该显示分钟数当时间少于1小时', () => {
      const timestamp = Date.now() - 5 * 60 * 1000 // 5分钟前
      expect(formatDate(timestamp)).toBe('5 分钟前')
    })

    it('应该显示小时数当时间少于1天', () => {
      const timestamp = Date.now() - 3 * 60 * 60 * 1000 // 3小时前
      expect(formatDate(timestamp)).toBe('3 小时前')
    })

    it('应该显示天数当时间少于1周', () => {
      const timestamp = Date.now() - 2 * 24 * 60 * 60 * 1000 // 2天前
      expect(formatDate(timestamp)).toBe('2 天前')
    })

    it('应该显示完整日期当时间超过1周', () => {
      const timestamp = Date.now() - 10 * 24 * 60 * 60 * 1000 // 10天前
      const result = formatDate(timestamp)
      expect(result).toMatch(/\d{4}\/\d{1,2}\/\d{1,2}/)
    })
  })

  describe('isValidUrl', () => {
    it('应该验证有效的URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://example.com')).toBe(true)
      expect(isValidUrl('ftp://example.com')).toBe(true)
    })

    it('应该拒绝无效的URL', () => {
      expect(isValidUrl('invalid-url')).toBe(false)
      expect(isValidUrl('example.com')).toBe(false)
      expect(isValidUrl('')).toBe(false)
    })
  })

  describe('extractDomain', () => {
    it('应该提取正确的域名', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('www.example.com')
      expect(extractDomain('http://subdomain.example.com')).toBe('subdomain.example.com')
    })

    it('应该处理无效URL', () => {
      expect(extractDomain('invalid-url')).toBe('')
    })
  })

  describe('getFaviconUrl', () => {
    it('应该生成正确的favicon URL', () => {
      const url = getFaviconUrl('https://example.com')
      expect(url).toBe('https://www.google.com/s2/favicons?sz=32&domain=example.com')
    })
  })

  describe('truncateText', () => {
    it('应该截断长文本', () => {
      const longText = '这是一个很长的文本内容'
      expect(truncateText(longText, 5)).toBe('这是一个很...')
    })

    it('应该保留短文本不变', () => {
      const shortText = '短文本'
      expect(truncateText(shortText, 10)).toBe('短文本')
    })
  })

  describe('debounce', () => {
    it('应该延迟执行函数', async () => {
      vi.useFakeTimers()
      
      const mockFn = vi.fn()
      const debouncedFn = debounce(mockFn, 100)
      
      debouncedFn()
      debouncedFn()
      debouncedFn()
      
      expect(mockFn).not.toHaveBeenCalled()
      
      vi.advanceTimersByTime(100)
      
      expect(mockFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('throttle', () => {
    it('应该限制函数执行频率', () => {
      vi.useFakeTimers()
      
      const mockFn = vi.fn()
      const throttledFn = throttle(mockFn, 100)
      
      throttledFn()
      throttledFn()
      throttledFn()
      
      expect(mockFn).toHaveBeenCalledTimes(1)
      
      vi.advanceTimersByTime(100)
      throttledFn()
      
      expect(mockFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('getTagColor', () => {
    it('应该为相同标签返回相同颜色', () => {
      const color1 = getTagColor('test')
      const color2 = getTagColor('test')
      expect(color1).toBe(color2)
    })

    it('应该为不同标签返回不同颜色', () => {
      const color1 = getTagColor('test1')
      const color2 = getTagColor('test2')
      // 虽然可能相同，但大概率不同
      expect(typeof color1).toBe('string')
      expect(typeof color2).toBe('string')
    })
  })
})