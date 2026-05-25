// Chrome Extension API Mocks for Testing
import { vi } from 'vitest'

// Mock Chrome Storage API
export const mockChromeStorage = {
  local: {
    get: vi.fn().mockImplementation((keys, callback) => {
      const result = Array.isArray(keys) 
        ? keys.reduce((acc, key) => ({ ...acc, [key]: null }), {})
        : typeof keys === 'string' 
        ? { [keys]: null }
        : {}
      
      if (callback) callback(result)
      return Promise.resolve(result)
    }),
    set: vi.fn().mockImplementation((items, callback) => {
      if (callback) callback()
      return Promise.resolve()
    }),
    remove: vi.fn().mockImplementation((keys, callback) => {
      if (callback) callback()
      return Promise.resolve()
    }),
    clear: vi.fn().mockImplementation((callback) => {
      if (callback) callback()
      return Promise.resolve()
    })
  },
  sync: {
    get: vi.fn().mockImplementation((keys, callback) => {
      const result = Array.isArray(keys) 
        ? keys.reduce((acc, key) => ({ ...acc, [key]: null }), {})
        : typeof keys === 'string' 
        ? { [keys]: null }
        : {}
      
      if (callback) callback(result)
      return Promise.resolve(result)
    }),
    set: vi.fn().mockImplementation((items, callback) => {
      if (callback) callback()
      return Promise.resolve()
    })
  }
}

// Mock Chrome Bookmarks API
export const mockChromeBookmarks = {
  getTree: vi.fn().mockImplementation((callback) => {
    const mockTree = [
      {
        id: '0',
        title: '',
        children: [
          {
            id: '1',
            title: 'Bookmarks Bar',
            children: [
              {
                id: '2',
                title: 'Test Bookmark',
                url: 'https://example.com'
              }
            ]
          }
        ]
      }
    ]
    if (callback) callback(mockTree)
    return Promise.resolve(mockTree)
  }),
  getChildren: vi.fn().mockImplementation((id, callback) => {
    const mockChildren = [
      {
        id: '2',
        title: 'Test Bookmark',
        url: 'https://example.com'
      }
    ]
    if (callback) callback(mockChildren)
    return Promise.resolve(mockChildren)
  }),
  get: vi.fn().mockImplementation((id, callback) => {
    const mockBookmark = [{
      id: id,
      title: 'Test Bookmark',
      url: 'https://example.com'
    }]
    if (callback) callback(mockBookmark)
    return Promise.resolve(mockBookmark)
  }),
  create: vi.fn().mockImplementation((bookmark, callback) => {
    const newBookmark = {
      id: 'new-bookmark-id',
      ...bookmark
    }
    if (callback) callback(newBookmark)
    return Promise.resolve(newBookmark)
  }),
  update: vi.fn().mockImplementation((id, changes, callback) => {
    const updatedBookmark = { id, ...changes }
    if (callback) callback(updatedBookmark)
    return Promise.resolve(updatedBookmark)
  }),
  remove: vi.fn().mockImplementation((id, callback) => {
    if (callback) callback()
    return Promise.resolve()
  }),
  onCreated: {
    addListener: vi.fn()
  },
  onRemoved: {
    addListener: vi.fn()
  },
  onChanged: {
    addListener: vi.fn()
  }
}

// Mock Chrome Runtime API
export const mockChromeRuntime = {
  sendMessage: vi.fn().mockImplementation((message, callback) => {
    if (callback) callback({ success: true })
    return Promise.resolve({ success: true })
  }),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn()
  },
  getURL: vi.fn().mockImplementation((path) => `chrome-extension://test-id/${path}`),
  id: 'test-extension-id'
}

// Mock Chrome Tabs API
export const mockChromeTabs = {
  query: vi.fn().mockImplementation((queryInfo, callback) => {
    const mockTabs = [
      {
        id: 1,
        url: 'https://example.com',
        title: 'Example Page',
        active: true,
        windowId: 1
      }
    ]
    if (callback) callback(mockTabs)
    return Promise.resolve(mockTabs)
  }),
  executeScript: vi.fn().mockImplementation((tabId, details, callback) => {
    if (callback) callback([])
    return Promise.resolve([])
  })
}

// Mock Chrome Scripting API (Manifest V3)
export const mockChromeScripting = {
  executeScript: vi.fn().mockImplementation((injection) => {
    return Promise.resolve([{ result: null }])
  })
}

// Global Chrome API Mock
export const mockChrome = {
  storage: mockChromeStorage,
  bookmarks: mockChromeBookmarks,
  runtime: mockChromeRuntime,
  tabs: mockChromeTabs,
  scripting: mockChromeScripting
}

// 设置全局 chrome 对象
export const setupChromeMocks = () => {
  // @ts-ignore - 这是测试环境的mock对象
  global.chrome = mockChrome
  // @ts-ignore
  global.browser = mockChrome // 某些库可能使用 browser 而不是 chrome
}