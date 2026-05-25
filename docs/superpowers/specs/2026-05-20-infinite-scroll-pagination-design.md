# Infinite Scroll Pagination Design

## Problem
MainPage renders all filtered bookmarks at once. With 1000+ bookmarks, DOM is heavy and the "load more" button at the bottom is a non-functional placeholder.

## Approach: Store-layer virtual pagination

Filtering/sorting stays in memory (chrome.storage doesn't support complex queries). Pagination is purely a render concern — only `displayedCount` items are rendered to DOM.

## Store changes (`store/index.ts`)

New state:
- `pageSize: number` = 50
- `displayedCount: number` = 50

New actions:
- `loadMore()` → `displayedCount += pageSize`
- `resetPagination()` → `displayedCount = pageSize`

`getFilteredBookmarks()` is unchanged — still returns full filtered array.

## Filter actions (`store/actions/filterActions.ts`)

`setSearchQuery` and `setActiveFilters` call `resetPagination()` after setting filters so the view resets to page 1.

## MainPage changes (`components/MainPage.tsx`)

- Remove placeholder "load more" button
- Add `useRef` sentinel div at the bottom of the bookmark list
- `IntersectionObserver` watches sentinel; on intersection calls `loadMore()`
- Render: `filteredBookmarks.slice(0, displayedCount).map(...)`
- When `displayedCount >= filteredBookmarks.length`, hide sentinel
- Observer disconnects on unmount

## Data flow

```
scroll → IO triggers → loadMore()
  → displayedCount += 50 → re-render
  → slice(0, displayedCount) renders more cards

filter/search change → resetPagination()
  → displayedCount = 50 → view resets to page 1
```

## Files touched

1. `src/store/index.ts` — add displayedCount, pageSize, loadMore, resetPagination
2. `src/store/actions/filterActions.ts` — reset pagination on filter changes
3. `src/components/MainPage.tsx` — IntersectionObserver + slice rendering
