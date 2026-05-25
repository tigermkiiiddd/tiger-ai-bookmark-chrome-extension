// Chrome书签同步功能测试
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChromeBookmarkService } from '../services/chromeBookmarks';
import type { ChromeBookmarkNode, Bookmark, SyncOptions } from '../types/index';
import { mockChromeBookmarks, mockChromeStorage } from './chrome-mocks';

describe('Chrome书签同步功能', () => {
  let chromeBookmarkService: ChromeBookmarkService;
  
  const mockChromeBookmarkTree: ChromeBookmarkNode[] = [
    {
      id: '1',
      title: '书签栏',
      children: [
        {
          id: '2',
          title: '工作',
          children: [
            {
              id: '3',
              title: 'GitHub',
              url: 'https://github.com',
              dateAdded: 1234567890000
            },
            {
              id: '4',
              title: 'Stack Overflow',
              url: 'https://stackoverflow.com',
              dateAdded: 1234567891000
            }
          ]
        },
        {
          id: '5',
          title: 'Google',
          url: 'https://google.com',
          dateAdded: 1234567892000
        }
      ]
    }
  ];

  const mockExistingBookmarks: Bookmark[] = [
    {
      id: 'bookmark_1',
      url: 'https://github.com',
      title: 'GitHub - 代码托管',
      description: '开源代码托管平台',
      tagIds: ['开发', '工具'],
      categoryId: '技术',
      createdAt: 1234567880000,
      updatedAt: 1234567880000,
      status: 'active'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    chromeBookmarkService = ChromeBookmarkService.getInstance();
    
    // 设置模拟的Chrome书签树
    mockChromeBookmarks.getTree.mockResolvedValue(mockChromeBookmarkTree);
    
    // 设置模拟的存储返回
    mockChromeStorage.local.get.mockResolvedValue({ bookmarks: [...mockExistingBookmarks] });
    mockChromeStorage.local.set.mockResolvedValue(undefined);
  });

  describe('获取Chrome书签', () => {
    it('应该能够获取Chrome书签树', async () => {
      const result = await chromeBookmarkService.getChromeBookmarks();

      expect(result).toEqual(mockChromeBookmarkTree);
      expect(mockChromeBookmarks.getTree).toHaveBeenCalledTimes(1);
    });

    it('应该能够提取所有书签URL', async () => {
      const bookmarks = await chromeBookmarkService.getAllChromeBookmarkUrls();

      expect(bookmarks).toHaveLength(3);
      expect(bookmarks[0]).toMatchObject({
        id: '3',
        title: 'GitHub',
        url: 'https://github.com'
      });
      expect(bookmarks[1]).toMatchObject({
        id: '4',
        title: 'Stack Overflow',
        url: 'https://stackoverflow.com'
      });
      expect(bookmarks[2]).toMatchObject({
        id: '5',
        title: 'Google',
        url: 'https://google.com'
      });
    });

    it('应该能够获取书签文件夹结构', async () => {
      const folders = await chromeBookmarkService.getBookmarkFolders();

      expect(folders).toHaveLength(2);
      expect(folders[0]).toMatchObject({
        id: '1',
        title: '书签栏'
      });
      expect(folders[1]).toMatchObject({
        id: '2',
        title: '  工作' // 带缩进
      });
    });
  });

  describe('书签格式转换', () => {
    it('应该正确转换Chrome书签为TIGERMARK格式', () => {
      const chromeBookmark: ChromeBookmarkNode = {
        id: '3',
        title: 'GitHub',
        url: 'https://github.com',
        dateAdded: 1234567890000
      };

      const tigermarkBookmark = chromeBookmarkService.convertChromeBookmarkToTigermark(chromeBookmark);

      expect(tigermarkBookmark).toMatchObject({
        url: 'https://github.com',
        title: 'GitHub',
        description: '',
        tags: [],
        category: undefined,
        createdAt: 1234567890000,
        status: 'active',
        chromeBookmarkId: '3',
        isSyncedFromChrome: true
      });
      expect(tigermarkBookmark.lastSyncAt).toBeDefined();
      expect(tigermarkBookmark.updatedAt).toBeDefined();
    });
  });

  describe('冲突检测', () => {
    it('应该检测URL冲突', async () => {
      const chromeBookmarks: ChromeBookmarkNode[] = [
        {
          id: '3',
          title: 'GitHub',
          url: 'https://github.com'
        }
      ];

      const conflicts = await chromeBookmarkService.detectConflicts(chromeBookmarks, mockExistingBookmarks);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        chromeBookmark: chromeBookmarks[0],
        existingBookmark: mockExistingBookmarks[0],
        reason: 'url-exists'
      });
    });

    it('应该检测标题相似冲突', async () => {
      const chromeBookmarks: ChromeBookmarkNode[] = [
        {
          id: '6',
          title: 'GitHub - 代码托管',
          url: 'https://github.io'
        }
      ];

      const conflicts = await chromeBookmarkService.detectConflicts(chromeBookmarks, mockExistingBookmarks);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        chromeBookmark: chromeBookmarks[0],
        existingBookmark: mockExistingBookmarks[0],
        reason: 'title-similar'
      });
    });

    it('应该不检测无冲突的书签', async () => {
      const chromeBookmarks: ChromeBookmarkNode[] = [
        {
          id: '7',
          title: 'New Site',
          url: 'https://newsite.com'
        }
      ];

      const conflicts = await chromeBookmarkService.detectConflicts(chromeBookmarks, mockExistingBookmarks);

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('书签导入', () => {
    const syncOptions: SyncOptions = {
      mergeStrategy: 'merge',
      includeSubfolders: true,
      selectedFolders: [],
      conflictResolution: 'auto-merge',
      enableAIAnalysis: false,
      batchSize: 10
    };

    it('应该成功导入不冲突的书签', async () => {
      // 设置空的现有书签
      mockChromeStorage.local.get.mockResolvedValue({ bookmarks: [] });
      
      const chromeBookmarks: ChromeBookmarkNode[] = [
        {
          id: '5',
          title: 'Google',
          url: 'https://google.com',
          dateAdded: 1234567892000
        }
      ];

      const result = await chromeBookmarkService.importChromeBookmarks(
        chromeBookmarks,
        syncOptions
      );

      expect(result.imported).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('应该正确处理冲突合并', async () => {
      const chromeBookmarks: ChromeBookmarkNode[] = [
        {
          id: '3',
          title: 'GitHub - Updated',
          url: 'https://github.com',  // 这个 URL 已经存在于 mockExistingBookmarks 中
          dateAdded: 1234567890000
        }
      ];

      const result = await chromeBookmarkService.importChromeBookmarks(
        chromeBookmarks,
        syncOptions
      );

      expect(result.imported).toBe(0);
      expect(result.updated).toBe(1); // 应该是更新现有书签
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('应该跳过冲突当设置为skip-conflicts', async () => {
      const chromeBookmarks: ChromeBookmarkNode[] = [
        {
          id: '3',
          title: 'GitHub',
          url: 'https://github.com',  // 这个 URL 已经存在于 mockExistingBookmarks 中
          dateAdded: 1234567890000
        }
      ];

      const skipOptions: SyncOptions = {
        ...syncOptions,
        conflictResolution: 'skip'
      };

      const result = await chromeBookmarkService.importChromeBookmarks(
        chromeBookmarks,
        skipOptions
      );

      expect(result.imported).toBe(0);
      expect(result.updated).toBe(0); // skip-conflicts 不会更新
      expect(result.skipped).toBe(1); // 应该被跳过
      expect(result.errors).toBe(0);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('书签导出', () => {
    beforeEach(() => {
      mockChromeBookmarks.create.mockImplementation((createInfo) => 
        Promise.resolve({
          id: 'new_' + Date.now(),
          ...createInfo
        })
      );
      
      // 设置模拟的书签数据
      const bookmarksToExport = [
        {
          id: 'bookmark_2',
          url: 'https://example.com',
          title: 'Example Site',
          description: 'Test site',
          tags: ['test'],
          category: '其他',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'active'
        }
      ];
      mockChromeStorage.local.get.mockResolvedValue({ bookmarks: bookmarksToExport });
    });

    it('应该成功导出书签到Chrome', async () => {
      const result = await chromeBookmarkService.exportToChrome(['bookmark_2'], '1');

      expect(result.exported).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockChromeBookmarks.create).toHaveBeenCalledTimes(1);
      expect(mockChromeBookmarks.create).toHaveBeenCalledWith({
        title: 'Example Site',
        url: 'https://example.com',
        parentId: '1'
      });
    });

    it('应该跳过已存在的Chrome书签', async () => {
      const bookmarksWithChrome = [
        {
          id: 'bookmark_3',
          url: 'https://existing.com',
          title: 'Existing Site',
          description: 'Already exists',
          tags: ['test'],
          category: '其他',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'active',
          chromeBookmarkId: 'existing_123'
        }
      ];
      
      mockChromeStorage.local.get.mockResolvedValue({ bookmarks: bookmarksWithChrome });
      mockChromeBookmarks.get.mockResolvedValue([{ id: 'existing_123' }]);

      const result = await chromeBookmarkService.exportToChrome(['bookmark_3'], '1');

      expect(result.exported).toBe(0);
      expect(result.errors).toBe(0);
      expect(mockChromeBookmarks.create).not.toHaveBeenCalled();
    });
  });

  describe('双向同步', () => {
    it('应该执行完整的双向同步', async () => {
      const syncOptions: SyncOptions = {
        mergeStrategy: 'merge',
        includeSubfolders: true,
        selectedFolders: [],
        conflictResolution: 'auto-merge',
        enableAIAnalysis: false,
        batchSize: 10
      };

      // Mock Chrome书签
      const tigermarkBookmarks = [
        {
          id: 'bookmark_1',
          url: 'https://newsite.com',
          title: 'New Site',
          description: 'A new site to export',
          tags: ['new'],
          category: 'test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'active'
        }
      ];
      
      mockChromeStorage.local.get.mockResolvedValue({ 
        bookmarks: tigermarkBookmarks
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      mockChromeBookmarks.create.mockResolvedValue({ id: 'new_bookmark' });

      const result = await chromeBookmarkService.syncBookmarks(syncOptions);

      expect(result.importResult).toBeDefined();
      expect(result.exportResult).toBeDefined();
      expect(result.importResult.imported).toBeGreaterThanOrEqual(0);
      expect(result.exportResult.exported).toBeGreaterThanOrEqual(0);
    });
  });

  describe('错误处理', () => {
    it('应该处理Chrome API错误', async () => {
      // 临时覆盖mock为错误状态
      const originalMock = mockChromeBookmarks.getTree;
      mockChromeBookmarks.getTree.mockRejectedValueOnce(new Error('Chrome API Error'));

      await expect(chromeBookmarkService.getChromeBookmarks()).rejects.toThrow('无法获取Chrome书签');
      
      // 恢复原始 mock
      mockChromeBookmarks.getTree = originalMock;
    });

    it('应该处理存储错误', async () => {
      const chromeBookmarks: ChromeBookmarkNode[] = [
        {
          id: '5',
          title: 'Google',
          url: 'https://google.com'
        }
      ];

      const originalMock = mockChromeStorage.local.get;
      mockChromeStorage.local.get.mockRejectedValueOnce(new Error('Storage Error'));

      const syncOptions: SyncOptions = {
        mergeStrategy: 'merge',
        includeSubfolders: true,
        selectedFolders: [],
        conflictResolution: 'auto-merge',
        enableAIAnalysis: false,
        batchSize: 10
      };

      await expect(chromeBookmarkService.importChromeBookmarks(chromeBookmarks, syncOptions))
        .rejects.toThrow();
        
      // 恢复原始 mock
      mockChromeStorage.local.get = originalMock;
    });
  });
});

describe('Chrome书签服务集成测试', () => {
  it('应该是单例模式', () => {
    const instance1 = ChromeBookmarkService.getInstance();
    const instance2 = ChromeBookmarkService.getInstance();
    
    expect(instance1).toBe(instance2);
  });
});