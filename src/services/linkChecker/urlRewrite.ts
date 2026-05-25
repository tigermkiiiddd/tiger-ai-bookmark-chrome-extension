import { bookmarkStorage } from '../../core/storage/bookmarks';
import type {
  Bookmark,
  EnhancedLinkCheckResult,
  UpdateBookmarkData
} from '../../types/index';
import { LinkStatus } from '../../types/index';

/** 比较两 URL 是否指向同一地址（忽略末尾斜杠与 hash） */
export function normalizeUrlForCompare(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    parsed.pathname = path;
    return parsed.href;
  } catch {
    return url.trim();
  }
}

/** 判断 URL 是否像临时跳转页（登录、验证码、授权等），不应写回书签 */
export function isLikelyTemporaryRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim().toLowerCase());
    const path = parsed.pathname;

    const tempPathPatterns = [
      /^\/login\/?$/,
      /^\/signin\/?$/,
      /^\/sign-in\/?$/,
      /^\/auth\/?$/,
      /^\/oauth\/?$/,
      /^\/sso\/?$/,
      /^\/authorize\/?$/,
      /^\/authentication\/?$/,
      /^\/captcha\/?$/,
      /^\/recaptcha\/?$/,
      /^\/challenge\/?$/,
      /^\/verify\/?$/,
      /^\/verification\/?$/,
      /^\/interstitial\/?$/,
      /^\/consent\/?$/,
      /^\/agegate\/?$/,
      /^\/age-gate\/?$/,
      /^\/gateway\/?$/,
      /^\/rate-limit\/?$/,
      /^\/blocked\/?$/,
      /^\/confirm\/?$/,
      /^\/subscribe\/?$/,
      /^\/paywall\/?$/,
    ];

    if (tempPathPatterns.some((re) => re.test(path))) {
      return true;
    }

    const tempQueryKeys = ['login', 'auth', 'captcha', 'challenge', 'redirect', 'returnurl', 'return_url', 'oauth_token', 'auth_token'];
    for (const key of tempQueryKeys) {
      if (parsed.searchParams.has(key)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/** 从检测结果解析跳转后的最终 URL */
export function resolveFinalUrlFromCheckResult(
  result: EnhancedLinkCheckResult
): string | undefined {
  const candidate =
    result.finalUrl?.trim() ||
    (result.redirectChain?.length
      ? result.redirectChain[result.redirectChain.length - 1]?.trim()
      : undefined);

  if (!candidate) return undefined;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    return parsed.href;
  } catch {
    return undefined;
  }
}

function isReachableStatus(status: LinkStatus): boolean {
  return status === LinkStatus.ACTIVE || status === LinkStatus.REDIRECT;
}

/** 链接可达时写回链接 health（不改动 isArchived） */
export function linkCheckStatusPatch(): UpdateBookmarkData {
  return {
    status: 'active',
    linkFailureType: null
  };
}

/**
 * 检测后若发生 HTTP 跳转，将书签 url 更新为 finalUrl（原地址视为已失效/过时）。
 */
export async function resolveBookmarkUrlRewrite(
  existing: Bookmark,
  result: EnhancedLinkCheckResult
): Promise<string | undefined> {
  if (!isReachableStatus(result.status)) {
    return undefined;
  }

  const finalUrl = resolveFinalUrlFromCheckResult(result);
  if (!finalUrl) {
    return undefined;
  }

  if (normalizeUrlForCompare(finalUrl) === normalizeUrlForCompare(existing.url)) {
    return undefined;
  }

  const conflict = await bookmarkStorage.getBookmarkByUrl(finalUrl);
  if (conflict && conflict.id !== existing.id) {
    console.warn(
      `[linkCheck] 跳转目标 URL 已被其他书签占用，保留原地址: ${existing.url}`
    );
    return undefined;
  }

  return finalUrl;
}

/**
 * 用户从 UI 打开标签页后，根据最终地址更新书签 url（与检测结果写回逻辑一致）。
 */
export async function applyBookmarkUrlRewriteFromFinalUrl(
  bookmarkId: string,
  initialUrl: string,
  finalUrl: string
): Promise<{ updated: boolean; newUrl?: string }> {
  const existing = await bookmarkStorage.getBookmarkById(bookmarkId);
  if (!existing) {
    return { updated: false };
  }

  const syntheticResult: EnhancedLinkCheckResult = {
    bookmarkId,
    url: initialUrl,
    finalUrl,
    redirectChain:
      normalizeUrlForCompare(initialUrl) !== normalizeUrlForCompare(finalUrl)
        ? [initialUrl, finalUrl]
        : undefined,
    status: LinkStatus.ACTIVE,
    checkedAt: Date.now(),
    method: 'tab'
  };

  const rewrittenUrl = await resolveBookmarkUrlRewrite(existing, syntheticResult);
  if (!rewrittenUrl) {
    return { updated: false };
  }

  await bookmarkStorage.updateBookmark(bookmarkId, {
    url: rewrittenUrl,
    lastLinkCheckedAt: Date.now(),
    linkCheckRecorded: true,
    ...linkCheckStatusPatch()
  });

  console.log(
    `[linkCheck] 打开书签后 URL 已更新: ${initialUrl} → ${rewrittenUrl}`
  );

  return { updated: true, newUrl: rewrittenUrl };
}
