import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BookmarkCard from './BookmarkCard'
import { useBookmarkStore } from '../store/index'
import type { Bookmark } from '../types/index'

// Mock store
vi.mock('../store/index', () => ({
  useBookmarkStore: vi.fn()
}))

vi.mock('../utils/openBookmark', () => ({
  openBookmarkUrl: vi.fn()
}))

import { openBookmarkUrl } from '../utils/openBookmark'

// Mock confirm
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: vi.fn()
})

const mockActions = {
  updateBookmark: vi.fn(),
  deleteBookmark: vi.fn(),
  toggleBookmarkSelection: vi.fn(),
  aiArchiveBookmark: vi.fn(),
  openEditModal: vi.fn(),
  refreshBookmarkThumbnail: vi.fn(),
}

function mockStoreSelector(selector: any) {
  const state = {
    ...mockActions,
    categories: [],
    tags: [],
    selectedBookmarks: [] as string[],
  }
  return selector(state)
}

const defaultTagNames = ['javascript', 'frontend', 'react']
const defaultCategoryPath = ''

describe('BookmarkCard 组件测试', () => {
  const mockBookmark: Bookmark = {
    id: 'test-bookmark-1',
    title: '测试书签标题',
    url: 'https://example.com',
    description: '这是一个测试书签的描述',
    tagIds: ['javascript', 'frontend', 'react'],
    categoryId: '开发',
    status: 'active',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    imagePreviewUrl: 'https://example.com/preview.jpg'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useBookmarkStore as any).mockImplementation(mockStoreSelector)
  })

  it('应该正确渲染书签信息', () => {
    render(<BookmarkCard bookmark={mockBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    expect(screen.getByText('测试书签标题')).toBeInTheDocument()
    expect(screen.getByText('这是一个测试书签的描述')).toBeInTheDocument()
    expect(screen.getByText('javascript')).toBeInTheDocument()
    expect(screen.getByText('frontend')).toBeInTheDocument()
    expect(screen.getByText('react')).toBeInTheDocument()
  })

  it('应该显示预览图片', () => {
    render(<BookmarkCard bookmark={mockBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    const previewImage = screen.getByAltText('测试书签标题')
    expect(previewImage).toBeInTheDocument()
    expect(previewImage).toHaveAttribute('src', 'https://example.com/preview.jpg')
  })

  it('当没有预览图片时应该显示favicon', () => {
    const bookmarkWithoutPreview = { ...mockBookmark, imagePreviewUrl: undefined }

    render(<BookmarkCard bookmark={bookmarkWithoutPreview} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    const faviconImage = screen.getByAltText('example.com')
    expect(faviconImage).toBeInTheDocument()
    expect(faviconImage.getAttribute('src')).toContain('google.com/s2/favicons')
  })

  it('应该处理选择状态', async () => {
    const user = userEvent.setup()

    render(<BookmarkCard bookmark={mockBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)

    expect(mockActions.toggleBookmarkSelection).toHaveBeenCalledWith('test-bookmark-1')
  })

  it('当书签被选中时应该显示选中状态', () => {
    render(<BookmarkCard bookmark={mockBookmark} isSelected={true} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })

  it('应该显示和隐藏操作菜单', async () => {
    const user = userEvent.setup()

    render(<BookmarkCard bookmark={mockBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    expect(screen.queryByText('在新标签页打开')).not.toBeInTheDocument()

    const menuButton = screen.getByRole('button', { name: '' })
    await user.click(menuButton)

    expect(screen.getByText('在新标签页打开')).toBeInTheDocument()
    expect(screen.getByText('编辑书签')).toBeInTheDocument()
    expect(screen.getByText('归档')).toBeInTheDocument()
    expect(screen.getByText('删除书签')).toBeInTheDocument()
  })

  it('应该在新标签页打开链接', async () => {
    const user = userEvent.setup()

    render(<BookmarkCard bookmark={mockBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    const cardContent = screen.getByText('测试书签标题').closest('.cursor-pointer')
    await user.click(cardContent!)

    expect(openBookmarkUrl).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com' })
    )
  })

  it('应该通过菜单打开链接', async () => {
    const user = userEvent.setup()

    render(<BookmarkCard bookmark={mockBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    const menuButton = screen.getByRole('button', { name: '' })
    await user.click(menuButton)

    const openButton = screen.getByText('在新标签页打开')
    await user.click(openButton)

    expect(openBookmarkUrl).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com' })
    )
  })

  it('应该归档书签', async () => {
    const user = userEvent.setup()

    render(<BookmarkCard bookmark={mockBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    const menuButton = screen.getByRole('button', { name: '' })
    await user.click(menuButton)

    const archiveButton = screen.getByText('归档')
    await user.click(archiveButton)

    await waitFor(() => {
      expect(mockActions.updateBookmark).toHaveBeenCalledWith('test-bookmark-1', {
        isArchived: true,
        archivedAt: expect.any(Number)
      })
    })
  })

  it('应该取消归档已归档的书签', async () => {
    const user = userEvent.setup()
    const archivedBookmark = { ...mockBookmark, isArchived: true, archivedAt: Date.now() }

    render(<BookmarkCard bookmark={archivedBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    const menuButton = screen.getByRole('button', { name: '' })
    await user.click(menuButton)

    const unarchiveButton = screen.getByText('取消归档')
    await user.click(unarchiveButton)

    await waitFor(() => {
      expect(mockActions.updateBookmark).toHaveBeenCalledWith('test-bookmark-1', {
        isArchived: false,
        archivedAt: undefined
      })
    })
  })

  it('应该删除书签', async () => {
    const user = userEvent.setup()

    ;(window.confirm as any).mockReturnValue(true)

    render(<BookmarkCard bookmark={mockBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    const menuButton = screen.getByRole('button', { name: '' })
    await user.click(menuButton)

    const deleteButton = screen.getByText('删除书签')
    await user.click(deleteButton)

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('确定要删除这个书签吗？此操作无法撤销。')
      expect(mockActions.deleteBookmark).toHaveBeenCalledWith('test-bookmark-1')
    })
  })

  it('取消确认时不应该删除书签', async () => {
    const user = userEvent.setup()

    ;(window.confirm as any).mockReturnValue(false)

    render(<BookmarkCard bookmark={mockBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    const menuButton = screen.getByRole('button', { name: '' })
    await user.click(menuButton)

    const deleteButton = screen.getByText('删除书签')
    await user.click(deleteButton)

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled()
      expect(mockActions.deleteBookmark).not.toHaveBeenCalled()
    })
  })

  it('应该根据状态显示不同的样式', () => {
    const { rerender } = render(<BookmarkCard bookmark={mockBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    expect(document.querySelector('.border-green-200')).toBeInTheDocument()

    const archivedBookmark = { ...mockBookmark, isArchived: true, archivedAt: Date.now() }
    rerender(<BookmarkCard bookmark={archivedBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)
    expect(document.querySelector('.border-yellow-200')).toBeInTheDocument()

    const deadBookmark = { ...mockBookmark, status: 'dead' as const }
    rerender(<BookmarkCard bookmark={deadBookmark} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)
    expect(document.querySelector('.border-red-200')).toBeInTheDocument()
  })

  it('应该限制显示的标签数量', () => {
    const tagNames5 = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']

    render(<BookmarkCard bookmark={{ ...mockBookmark, tagIds: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'] }} isSelected={false} tagNames={tagNames5} categoryPath={defaultCategoryPath} />)

    expect(screen.getByText('tag1')).toBeInTheDocument()
    expect(screen.getByText('tag2')).toBeInTheDocument()
    expect(screen.getByText('tag3')).toBeInTheDocument()

    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('应该显示AI生成的摘要', () => {
    const bookmarkWithAI = {
      ...mockBookmark,
      aiGenerated: {
        summary: 'AI生成的摘要内容',
        keywords: ['ai', 'summary'],
        tags: ['ai'],
        category: 'AI',
        simulated_persona: 'AI助手'
      }
    }

    render(<BookmarkCard bookmark={bookmarkWithAI} isSelected={false} tagNames={defaultTagNames} categoryPath={defaultCategoryPath} />)

    expect(screen.getByText('AI生成的摘要内容')).toBeInTheDocument()
  })
})
