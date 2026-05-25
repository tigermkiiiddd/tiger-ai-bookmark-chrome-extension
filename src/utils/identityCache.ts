import type { Bookmark } from '../types/index';

/**
 * 身份缓存：对内容没变的 item 复用旧对象引用。
 * 让 valueChanged 的 !== 比较能正确短路线，阻断 cascading recomputation。
 */
export function preserveIdentities<T extends { id: string }>(
  oldItems: T[],
  newItems: T[],
  equals?: (a: T, b: T) => boolean
): T[] {
  if (oldItems === newItems) return newItems;
  if (oldItems.length === 0) return newItems;
  if (newItems.length === 0) return newItems;

  const oldMap = new Map<string, T>();
  for (let i = 0; i < oldItems.length; i++) {
    oldMap.set(oldItems[i].id, oldItems[i]);
  }

  let hasChanges = false;
  const result = new Array<T>(newItems.length);
  for (let i = 0; i < newItems.length; i++) {
    const newItem = newItems[i];
    const oldItem = oldMap.get(newItem.id);
    if (oldItem && (equals ? equals(oldItem, newItem) : shallowEqual(oldItem as unknown as Record<string, unknown>, newItem as unknown as Record<string, unknown>))) {
      result[i] = oldItem;
    } else {
      result[i] = newItem;
      hasChanges = true;
    }
  }

  if (!hasChanges && oldItems.length === newItems.length) {
    return oldItems;
  }
  return result;
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (a[key] !== b[key]) return false;
  }
  return true;
}

const BOOKMARK_COMPARE_KEYS: (keyof Bookmark)[] = [
  'id', 'title', 'url', 'description', 'categoryId',
  'createdAt', 'updatedAt', 'status',
  'linkFailureType', 'lastLinkCheckedAt', 'linkCheckRecorded',
  'imagePreviewUrl', 'imagePreviewKind', 'imagePreviewUpdatedAt',
  'isArchived', 'archivedAt', 'rating',
  'chromeBookmarkId', 'isSyncedFromChrome', 'lastSyncAt',
  'notes', 'favicon',
];

export function bookmarkEquals(a: Bookmark, b: Bookmark): boolean {
  for (let i = 0; i < BOOKMARK_COMPARE_KEYS.length; i++) {
    const key = BOOKMARK_COMPARE_KEYS[i];
    if ((a as any)[key] !== (b as any)[key]) return false;
  }
  if (!arrayShallowEqual(a.tagIds, b.tagIds)) return false;
  if (!shallowObjectEqual(a.aiGenerated, b.aiGenerated)) return false;
  return true;
}

function arrayShallowEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function shallowObjectEqual(a: object | undefined | null, b: object | undefined | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if ((a as any)[key] !== (b as any)[key]) return false;
  }
  return true;
}
