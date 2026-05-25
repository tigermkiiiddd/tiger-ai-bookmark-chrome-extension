import {
  applyBookmarkUrlRewriteFromFinalUrl,
  normalizeUrlForCompare
} from '../../services/linkChecker/urlRewrite.js';

const STABLE_MS = 900;
const MAX_WATCH_MS = 45_000;

interface TabWatch {
  bookmarkId: string;
  initialUrl: string;
  lastSeenUrl: string;
  stableTimer?: ReturnType<typeof setTimeout>;
  maxTimer: ReturnType<typeof setTimeout>;
}

const watches = new Map<number, TabWatch>();

function isWatchablePageUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function clearWatch(tabId: number): void {
  const watch = watches.get(tabId);
  if (!watch) return;
  if (watch.stableTimer) clearTimeout(watch.stableTimer);
  clearTimeout(watch.maxTimer);
  watches.delete(tabId);
}

function scheduleStableFinalize(tabId: number): void {
  const watch = watches.get(tabId);
  if (!watch) return;

  if (watch.stableTimer) clearTimeout(watch.stableTimer);
  watch.stableTimer = setTimeout(() => {
    void finalizeWatch(tabId);
  }, STABLE_MS);
}

async function finalizeWatch(tabId: number): Promise<void> {
  const watch = watches.get(tabId);
  if (!watch) return;
  clearWatch(tabId);

  const finalUrl = watch.lastSeenUrl;
  if (!isWatchablePageUrl(finalUrl)) return;

  if (normalizeUrlForCompare(finalUrl) === normalizeUrlForCompare(watch.initialUrl)) {
    return;
  }

  await applyBookmarkUrlRewriteFromFinalUrl(
    watch.bookmarkId,
    watch.initialUrl,
    finalUrl
  );
}

export function startWatchingBookmarkTab(
  tabId: number,
  bookmarkId: string,
  initialUrl: string
): void {
  clearWatch(tabId);

  const maxTimer = setTimeout(() => {
    void finalizeWatch(tabId);
  }, MAX_WATCH_MS);

  watches.set(tabId, {
    bookmarkId,
    initialUrl,
    lastSeenUrl: initialUrl,
    maxTimer
  });

  scheduleStableFinalize(tabId);
}

function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): void {
  const watch = watches.get(tabId);
  if (!watch) return;

  if (changeInfo.url && isWatchablePageUrl(changeInfo.url)) {
    watch.lastSeenUrl = changeInfo.url;
    scheduleStableFinalize(tabId);
    return;
  }

  if (changeInfo.status === 'complete' && isWatchablePageUrl(tab.url)) {
    watch.lastSeenUrl = tab.url;
    scheduleStableFinalize(tabId);
  }
}

let listenersRegistered = false;

export function registerBookmarkTabRedirectWatcher(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  chrome.tabs.onUpdated.addListener(handleTabUpdated);
  chrome.tabs.onRemoved.addListener(tabId => {
    clearWatch(tabId);
  });
}
