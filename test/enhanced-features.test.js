/**
 * 测试增强功能和向后兼容性
 */

// 模拟Chrome扩展环境
global.chrome = {
  tabs: {
    captureVisibleTab: jest.fn(),
    query: jest.fn()
  },
  debugger: {
    attach: jest.fn(),
    detach: jest.fn(),
    sendCommand: jest.fn()
  },
  runtime: {
    sendMessage: jest.fn()
  }
};

// 导入测试模块
import { screenshotService } from '../src/services/screenshot';
const { LinkCheckEngine } = require('../src/services/linkChecker');
const { MultiStrategyDetectionEngine } = require('../src/services/linkDetectionStrategies');

describe('增强功能测试', () => {
  describe('截图服务增强功能', () => {
    let screenshotService;

    beforeEach(() => {
      screenshotService = ScreenshotService.getInstance();
      jest.clearAllMocks();
    });

    test('应该支持DevTools Protocol策略', async () => {
      const mockTab = { id: 1, url: 'https://example.com' };
      
      // 模拟成功的DevTools响应
      chrome.debugger.sendCommand.mockResolvedValue({
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      });

      const result = await screenshotService.captureTab(mockTab.id, {
        strategy: 'devtools',
        enableRetry: true
      });

      expect(result.success).toBe(true);
      expect(result.dataUrl).toContain('data:image/png;base64');
      expect(chrome.debugger.attach).toHaveBeenCalledWith({ tabId: mockTab.id }, '1.3');
    });

    test('应该支持智能重试机制', async () => {
      const mockTab = { id: 1, url: 'https://example.com' };
      
      // 第一次失败，第二次成功
      chrome.debugger.sendCommand
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: 'data:image/png;base64,success'
        });

      const result = await screenshotService.captureTab(mockTab.id, {
        strategy: 'devtools',
        enableRetry: true,
        maxRetries: 2
      });

      expect(result.success).toBe(true);
      expect(chrome.debugger.sendCommand).toHaveBeenCalledTimes(2);
    });

    test('应该支持内存优化', async () => {
      const mockTab = { id: 1, url: 'https://example.com' };
      
      // 模拟大图片
      const largeImageData = 'data:image/png;base64,' + 'A'.repeat(10000);
      chrome.debugger.sendCommand.mockResolvedValue({ data: largeImageData });

      const result = await screenshotService.captureTab(mockTab.id, {
        strategy: 'devtools',
        optimizeMemory: true,
        maxImageSize: 5000
      });

      expect(result.success).toBe(true);
      // 优化后的图片应该更小
      expect(result.dataUrl.length).toBeLessThan(largeImageData.length);
    });
  });

  describe('链接检测增强功能', () => {
    let linkChecker;

    beforeEach(() => {
      linkChecker = LinkCheckEngine.getInstance();
      jest.clearAllMocks();
    });

    test('应该支持多策略检测', async () => {
      const detectionEngine = new MultiStrategyDetectionEngine();
      
      const mockBookmark = {
        id: '1',
        url: 'https://example.com',
        title: 'Test'
      };

      // 模拟HTTP检测成功
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']])
      });

      const result = await detectionEngine.detectWithStrategies(mockBookmark, {
        strategies: ['http', 'head'],
        timeout: 5000
      });

      expect(result.status).toBe('accessible');
      expect(result.strategiesUsed).toContain('http');
      expect(result.detectionDetails).toBeDefined();
    });

    test('应该提供详细进度跟踪', async () => {
      const mockBookmarks = [
        { id: '1', url: 'https://example1.com', title: 'Test 1' },
        { id: '2', url: 'https://example2.com', title: 'Test 2' }
      ];

      // 模拟检测过程
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      linkChecker.startBatchCheck(mockBookmarks, {
        maxConcurrent: 1,
        timeout: 1000
      });

      // 等待一些处理
      await new Promise(resolve => setTimeout(resolve, 100));

      const detailedProgress = linkChecker.getDetailedProgress();
      expect(detailedProgress).toHaveProperty('currentBatch');
      expect(detailedProgress).toHaveProperty('totalBatches');
      expect(detailedProgress).toHaveProperty('throughput');
      expect(detailedProgress).toHaveProperty('averageResponseTime');
    });

    test('应该支持状态分类系统', async () => {
      const mockBookmarks = [
        { id: '1', url: 'https://accessible.com', title: 'Accessible' },
        { id: '2', url: 'https://broken.com', title: 'Broken' },
        { id: '3', url: 'https://timeout.com', title: 'Timeout' }
      ];

      // 模拟不同的响应
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockRejectedValueOnce(new Error('Not found'))
        .mockImplementationOnce(() => new Promise(() => {})); // 永不解决，模拟超时

      linkChecker.startBatchCheck(mockBookmarks, {
        maxConcurrent: 3,
        timeout: 100
      });

      // 等待检测完成
      await new Promise(resolve => setTimeout(resolve, 200));

      const results = linkChecker.getEnhancedResults();
      expect(results).toHaveLength(3);
      
      const statuses = results.map(r => r.status);
      expect(statuses).toContain('accessible');
      expect(statuses).toContain('broken');
      expect(statuses).toContain('timeout');
    });
  });

  describe('向后兼容性测试', () => {
    test('截图服务应该保持旧API兼容', async () => {
          const screenshotService = screenshotService;
      const mockTab = { id: 1, url: 'https://example.com' };
      
      chrome.tabs.captureVisibleTab.mockResolvedValue(
        'data:image/png;base64,oldapi'
      );

      // 使用旧的API调用方式
      const result = await screenshotService.captureTab(mockTab.id);
      
      expect(result.success).toBe(true);
      expect(result.dataUrl).toContain('data:image/png;base64');
    });

    test('链接检测应该保持旧结果格式', async () => {
      const linkChecker = LinkCheckEngine.getInstance();
      const mockBookmarks = [
        { id: '1', url: 'https://example.com', title: 'Test' }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      linkChecker.startBatchCheck(mockBookmarks);
      await new Promise(resolve => setTimeout(resolve, 100));

      // 旧的getResults方法应该返回兼容格式
      const oldResults = linkChecker.getResults();
      const newResults = linkChecker.getEnhancedResults();

      expect(oldResults).toHaveLength(newResults.length);
      expect(oldResults[0]).toHaveProperty('bookmarkId');
      expect(oldResults[0]).toHaveProperty('status');
      expect(oldResults[0]).toHaveProperty('responseTime');
      
      // 新结果应该有额外字段
      expect(newResults[0]).toHaveProperty('strategiesUsed');
      expect(newResults[0]).toHaveProperty('detectionDetails');
    });
  });
});

// 性能测试
describe('性能测试', () => {
  test('批量截图应该在合理时间内完成', async () => {
    const screenshotService = ScreenshotService.getInstance();
    const startTime = Date.now();
    
    chrome.debugger.sendCommand.mockResolvedValue({
      data: 'data:image/png;base64,test'
    });

    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(screenshotService.captureTab(i, {
        strategy: 'devtools',
        enableRetry: false
      }));
    }

    await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    // 10个截图应该在5秒内完成
    expect(duration).toBeLessThan(5000);
  });

  test('大量链接检测应该有合理的内存使用', async () => {
    const linkChecker = LinkCheckEngine.getInstance();
    const mockBookmarks = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      url: `https://example${i}.com`,
      title: `Test ${i}`
    }));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200
    });

    const initialMemory = process.memoryUsage().heapUsed;
    
    linkChecker.startBatchCheck(mockBookmarks, {
      maxConcurrent: 10,
      timeout: 100
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // 内存增长应该在合理范围内（小于100MB）
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
  });
});