import type {
  Bookmark,
  EnhancedLinkCheckResult,
  UpdateBookmarkData
} from '../../types/index';
import { LinkStatus } from '../../types/index';
import { bookmarkStorage } from '../../core/storage/bookmarks';
import { chromeStorage } from '../../core/storage/chrome';
import type { ProgressSnapshot } from './types';
import { createEmptyDetailedProgress } from './types';
import { linkCheckStatusPatch, resolveBookmarkUrlRewrite } from './urlRewrite';

const STORAGE_KEY = 'linkCheckProgress';

async function buildCheckPersistencePatch(
  existing: Bookmark,
  result: EnhancedLinkCheckResult,
  statusPatch: UpdateBookmarkData
): Promise<UpdateBookmarkData> {
  const checkedAt = Date.now();
  const patch: UpdateBookmarkData = {
    ...statusPatch,
    lastLinkCheckedAt: checkedAt,
    linkCheckRecorded: true
  };

  const rewrittenUrl = await resolveBookmarkUrlRewrite(existing, result);
  if (rewrittenUrl) {
    patch.url = rewrittenUrl;
    console.log(
      `[linkCheck] 书签 URL 已更新为跳转后地址: ${existing.url} → ${rewrittenUrl}`
    );
  }

  return patch;
}

function isCheckMetaOnlyUpdate(
  existing: Bookmark,
  patch: UpdateBookmarkData
): boolean {
  return (
    existing.status === 'active' &&
    !existing.linkFailureType &&
    !patch.status &&
    !patch.linkFailureType &&
    !patch.url
  );
}

function isSameDeadState(
  existing: Bookmark,
  result: EnhancedLinkCheckResult,
  patch: UpdateBookmarkData
): boolean {
  return (
    existing.status === 'dead' &&
    existing.linkFailureType === result.failureType &&
    !patch.url
  );
}

export async function saveCheckResultToBookmarks(
  result: EnhancedLinkCheckResult
): Promise<void> {
  try {
    if (!result.bookmarkId) return;

    const existing = await bookmarkStorage.getBookmarkById(result.bookmarkId);
    if (!existing) return;

    if (result.status === LinkStatus.ACTIVE) {
      const patch = await buildCheckPersistencePatch(
        existing,
        result,
        linkCheckStatusPatch()
      );
      if (isCheckMetaOnlyUpdate(existing, patch)) {
        await bookmarkStorage.updateBookmark(result.bookmarkId, {
          lastLinkCheckedAt: patch.lastLinkCheckedAt,
          linkCheckRecorded: true
        });
        return;
      }
      await bookmarkStorage.updateBookmark(result.bookmarkId, patch);
      return;
    }

    if (result.status !== LinkStatus.DEAD || !result.failureType) {
      const patch = await buildCheckPersistencePatch(existing, result, {});
      await bookmarkStorage.updateBookmark(result.bookmarkId, patch);
      return;
    }

    const patch = await buildCheckPersistencePatch(existing, result, {
      status: 'dead',
      linkFailureType: result.failureType
    });

    if (isSameDeadState(existing, result, patch)) {
      await bookmarkStorage.updateBookmark(result.bookmarkId, {
        lastLinkCheckedAt: patch.lastLinkCheckedAt,
        linkCheckRecorded: true
      });
      return;
    }

    await bookmarkStorage.updateBookmark(result.bookmarkId, patch);
    console.log(
      `书签 ${result.url} 已标记为失效 (${result.failureType === 'site_dead' ? '站点' : '页面'})`
    );
  } catch (error) {
    console.error('保存检查结果失败:', error);
  }
}

export async function saveProgressSnapshot(
  snapshot: Omit<ProgressSnapshot, 'lastSavedAt'>
): Promise<void> {
  try {
    await chromeStorage.set({
      [STORAGE_KEY]: {
        ...snapshot,
        lastSavedAt: Date.now()
      }
    });
  } catch (error) {
    console.error('保存检测进度失败:', error);
  }
}

function normalizeProgressSnapshot(
  snapshot: ProgressSnapshot
): ProgressSnapshot {
  const emptyDetailed = createEmptyDetailedProgress();
  const detailed = snapshot.detailedProgress;

  return {
    ...snapshot,
    checkResults: Array.isArray(snapshot.checkResults)
      ? snapshot.checkResults
      : [],
    detailedProgress: {
      ...emptyDetailed,
      ...detailed,
      recentResults: Array.isArray(detailed?.recentResults)
        ? detailed.recentResults
        : [],
      statusDistribution: {
        ...emptyDetailed.statusDistribution,
        ...(detailed?.statusDistribution ?? {})
      }
    }
  };
}

export async function restoreProgressSnapshot(): Promise<ProgressSnapshot | null> {
  try {
    const data = await chromeStorage.get([STORAGE_KEY]);
    const snapshot = data[STORAGE_KEY] as ProgressSnapshot | undefined;

    if (snapshot?.currentProgress) {
      console.log(
        `已恢复检测进度: ${snapshot.processedCount}/${snapshot.totalCount}`
      );
      return normalizeProgressSnapshot(snapshot);
    }

    return null;
  } catch (error) {
    console.error('恢复检测进度失败:', error);
    return null;
  }
}

export async function clearProgressSnapshot(): Promise<void> {
  try {
    await chromeStorage.remove([STORAGE_KEY]);
    console.log('已清除持久化检测进度');
  } catch (error) {
    console.error('清除检测进度失败:', error);
  }
}
