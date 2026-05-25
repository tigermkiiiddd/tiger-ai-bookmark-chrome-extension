import { describe, it, expect, vi, beforeEach } from 'vitest'

// 简单的集成测试
describe('Chrome Extension 集成测试', () => {
  beforeEach(() => {
    // 确保Chrome API mocks已设置
    expect(global.chrome).toBeDefined()
    expect(global.chrome.storage).toBeDefined()
    expect(global.chrome.bookmarks).toBeDefined()
  })

  it('Chrome Storage API 应该被正确 mock', async () => {
    const testData = { key: 'value' }
    
    // 测试 storage.local.set
    await global.chrome.storage.local.set(testData)
    
    // 测试 storage.local.get
    const result = await global.chrome.storage.local.get(['key'])
    
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith(testData)
    expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['key'])
  })

  it('Chrome Bookmarks API 应该被正确 mock', async () => {
    const bookmarks = await global.chrome.bookmarks.getTree()
    
    expect(global.chrome.bookmarks.getTree).toHaveBeenCalled()
    expect(bookmarks).toBeDefined()
    expect(Array.isArray(bookmarks)).toBe(true)
  })

  it('Chrome Runtime API 应该被正确 mock', async () => {
    const message = { action: 'test' }
    const response = await global.chrome.runtime.sendMessage(message)
    
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(message)
    expect(response).toEqual({ success: true })
  })

  it('Chrome Tabs API 应该被正确 mock', async () => {
    const tabs = await global.chrome.tabs.query({ active: true })
    
    expect(global.chrome.tabs.query).toHaveBeenCalledWith({ active: true })
    expect(Array.isArray(tabs)).toBe(true)
    expect(tabs[0]).toHaveProperty('id')
    expect(tabs[0]).toHaveProperty('url')
  })
})