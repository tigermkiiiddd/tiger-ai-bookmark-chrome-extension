import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StorageService } from '../services/storage'
import type { Bookmark, Tag, Category, Settings } from '../types/index'

// Mock Chrome APIs
vi.mock('../test/chrome-mocks', () => ({}))

describe('StorageService 测试', () => {
  let storageService: StorageService
  
  beforeEach(() => {
    // 清除所有 mock 调用
    vi.clearAllMocks()
    
    // 获取 StorageService 实例
    storageService = StorageService.getInstance()
  })

  describe('书签管理', () => {
    const mockBookmark: Bookmark = {
      id: 'test-id',
      title: '测试书签',
      url: 'https://example.com',
      description: '测试描述',
      tagIds: ['test', 'example'],
      categoryId: '测试分类',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    it('应该获取书签列表', async () => {
      // Mock chrome.storage.local.get
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({
        bookmarks: [mockBookmark]
      })

      const bookmarks = await storageService.getBookmarks()
      
      expect(bookmarks).toEqual([mockBookmark])
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['bookmarks'])
    })

    it('应该添加新书签', async () => {
      // Mock 获取现有书签
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({
        bookmarks: []
      })
      
      // Mock 设置书签
      global.chrome.storage.local.set = vi.fn().mockResolvedValue(undefined)

      await storageService.addBookmark(mockBookmark)

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        bookmarks: [mockBookmark]
      })
    })

    it('应该更新现有书签', async () => {
      const existingBookmarks = [mockBookmark]
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({
        bookmarks: existingBookmarks
      })
      global.chrome.storage.local.set = vi.fn().mockResolvedValue(undefined)

      const updates = { title: '更新后的标题' }
      await storageService.updateBookmark('test-id', updates)

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        bookmarks: [{
          ...mockBookmark,
          ...updates,
          updatedAt: expect.any(Number)
        }]
      })
    })

    it('应该删除书签', async () => {
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({
        bookmarks: [mockBookmark]
      })
      global.chrome.storage.local.set = vi.fn().mockResolvedValue(undefined)

      await storageService.deleteBookmark('test-id')

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        bookmarks: []
      })
    })

    it('应该根据ID获取书签', async () => {
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({
        bookmarks: [mockBookmark]
      })

      const bookmark = await storageService.getBookmarkById('test-id')
      
      expect(bookmark).toEqual(mockBookmark)
    })

    it('应该搜索书签', async () => {
      const bookmarks = [
        { ...mockBookmark, id: 'test-1', title: '测试书签1', tags: ['javascript'] },
        { ...mockBookmark, id: 'test-2', title: '另一个书签', tags: ['python'] }
      ]
      
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({
        bookmarks
      })

      const results = await storageService.searchBookmarks('测试书签1')
      
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('测试书签1')
    })
  })

  describe('标签管理', () => {
    const mockTag: Tag = {
      id: 'tag-id',
      name: '测试标签',
      color: '#blue',
      createdAt: Date.now()
    }

    it('应该获取标签列表', async () => {
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({
        tags: [mockTag]
      })

      const tags = await storageService.getTags()
      
      expect(tags).toEqual([mockTag])
    })

    it('应该添加新标签', async () => {
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({
        tags: []
      })
      global.chrome.storage.local.set = vi.fn().mockResolvedValue(undefined)

      await storageService.addTag(mockTag)

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        tags: [mockTag]
      })
    })

    it('应该获取标签统计', async () => {
      const bookmarks = [
        { tags: ['javascript', 'frontend'] },
        { tags: ['javascript', 'backend'] },
        { tags: ['python'] }
      ]
      
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({
        bookmarks
      })

      const stats = await storageService.getTagStats()
      
      expect(stats).toEqual({
        javascript: 2,
        frontend: 1,
        backend: 1,
        python: 1
      })
    })
  })

  describe('设置管理', () => {
    it('应该获取默认设置', async () => {
      global.chrome.storage.sync.get = vi.fn().mockResolvedValue({})

      const settings = await storageService.getSettings()
      
      expect(settings).toEqual({
        theme: 'system',
        aiAutoTagging: true,
        contentSafetyLevel: 'BLOCK_NONE',
        syncDirection: 'bidirectional'
      })
    })

    it('应该更新设置', async () => {
      const currentSettings: Settings = {
        theme: 'system',
        aiAutoTagging: true,
        contentSafetyLevel: 'BLOCK_NONE',
        syncDirection: 'bidirectional'
      }
      
      global.chrome.storage.sync.get = vi.fn().mockResolvedValue({
        settings: currentSettings
      })
      global.chrome.storage.sync.set = vi.fn().mockResolvedValue(undefined)

      const updates = { theme: 'dark' as const }
      await storageService.updateSettings(updates)

      expect(global.chrome.storage.sync.set).toHaveBeenCalledWith({
        settings: {
          ...currentSettings,
          ...updates
        }
      })
    })
  })

  describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      const instance1 = StorageService.getInstance()
      const instance2 = StorageService.getInstance()
      
      expect(instance1).toBe(instance2)
    })
  })
})