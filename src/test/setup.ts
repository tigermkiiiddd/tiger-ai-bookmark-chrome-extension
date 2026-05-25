import '@testing-library/jest-dom'
import { beforeAll, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupChromeMocks } from './chrome-mocks'

// 在所有测试之前运行
beforeAll(() => {
  // 设置 Chrome API mocks
  setupChromeMocks()
  
  // 设置全局配置
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  })
})

// 每个测试后清理
afterEach(() => {
  cleanup()
})