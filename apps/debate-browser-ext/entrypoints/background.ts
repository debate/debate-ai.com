import { browser } from 'wxt/browser';

import {
  SIGN_IN_MESSAGE,
  SIGN_OUT_MESSAGE,
  refreshSession,
  signOut,
} from '@/src/auth/session';
import { runSignInFlow } from '@/src/auth/sign-in-flow';
import { PageNotReadableError, capturePageSnapshot } from '@/src/reader/snapshot';
import {
  READER_SNAPSHOT_MESSAGE,
  READER_TAB_CHANGED_MESSAGE,
  toggleReaderPanel,
} from '@/src/reader/panel';
import { getSettings } from '@/src/settings/settings';
import { OPEN_TIMER_MESSAGE, forgetTimerWindow, openTimerWindow } from '@/src/timer/window';

/**
 * Toolbar clicks are routed here rather than straight into a dropdown: the
 * timer must live in its own window (see src/timer/window.ts), and the Options
 * page lets a user make that window — or the article panel — the toolbar
 * icon's default instead of the card-reuse popup.
 *
 * Chrome only fires `action.onClicked` when no popup is registered, so the
 * chosen mode is applied by clearing or restoring `default_popup`.
 */
const POPUP_PAGE = 'popup.html';

/** Right-click → check this page, so the reuse check stays reachable in either toolbar mode. */
const CHECK_PAGE_MENU_ID = 'check-page-for-existing-cards';

/** Right-click → read this page, the article panel's other way in. */
const READ_PAGE_MENU_ID = 'read-page-in-article-panel';

/** Standalone reuse-check window: the same popup, told which URL to check. */
const CHECK_WINDOW = { width: 380, height: 460 } as const;

/**
 * How often to ping the server with the stored session.
 *
 * better-auth rolls a session's expiry forward when it is used, so a ping well
 * inside its lifetime is what keeps the reader signed in across days of use
 * without ever asking them again. Six hours is frequent enough to survive a
 * browser that is only open for part of each day, and rare enough to be
 * nothing.
 */
const SESSION_REFRESH_ALARM = 'debate-account-session-refresh';
const SESSION_REFRESH_PERIOD_MINUTES = 6 * 60;

/**
 * The toolbar button, under whichever name this build's manifest version gives
 * it: MV3 calls it `action`, MV2 `browserAction`, and `webextension-polyfill`
 * exposes exactly the one the manifest declares rather than aliasing them. The
 * Firefox build is MV2, so reaching for `browser.action` there is `undefined`.
 */
const toolbarButton = (
  browser as unknown as {
    action?: typeof browser.action;
    browserAction?: typeof browser.action;
  }
).action ?? (browser as unknown as { browserAction: typeof browser.action }).browserAction;

async function applyToolbarMode(): Promise<void> {
  const { toolbarAction } = await getSettings();
  await toolbarButton.setPopup({
    popup: toolbarAction === 'popup' ? POPUP_PAGE : '',
  });
}

async function createContextMenus(): Promise<void> {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: READ_PAGE_MENU_ID,
    title: 'Read this page in Debate AI',
    contexts: ['page', 'selection'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
  browser.contextMenus.create({
    id: CHECK_PAGE_MENU_ID,
    title: 'Check this page for existing cards',
    contexts: ['page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
}

/** The tab the reader is looking at. */
async function getActiveTab(): Promise<{ id?: number; url?: string } | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Shows or hides the article panel over `tabId`, falling back to the timer
 * window on pages the panel can't be put on (browser-internal pages, the web
 * store), so the click still does something.
 */
async function toggleReaderOrFallBack(tabId: number | undefined): Promise<void> {
  if (tabId == null) {
    await openTimerWindow();
    return;
  }
  try {
    await toggleReaderPanel(tabId);
  } catch (error) {
    console.warn('Could not show the article panel on this page:', error);
    await openTimerWindow();
  }
}

/** What the article panel gets back when it asks for the current page. */
interface SnapshotResponse {
  ok: boolean;
  snapshot?: Awaited<ReturnType<typeof capturePageSnapshot>>;
  error?: string;
}

/**
 * The panel is framed into the page it reads, so the tab to read is the one the
 * request came from; the active tab is only a fallback for `reader.html`
 * opened on its own.
 */
async function handleSnapshotRequest(senderTabId: number | undefined): Promise<SnapshotResponse> {
  const tabId = senderTabId ?? (await getActiveTab())?.id;
  if (tabId == null) return { ok: false, error: 'No page is open to read.' };
  try {
    return { ok: true, snapshot: await capturePageSnapshot(tabId) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof PageNotReadableError
          ? error.message
          : `Could not read this page: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Tells an open article panel that its tab has moved to another page without a
 * full load (a single-page app changing route), so it can offer to read that
 * one. A full load takes the overlay down with the old page. Sent, not acted
 * on: re-extracting under the reader mid-sentence would be worse than a button.
 */
function notifyPanelOfTabChange(tabId: number): void {
  // Nothing is listening when no panel is open, and that rejection is not a
  // problem worth reporting.
  void browser.runtime
    .sendMessage({ type: READER_TAB_CHANGED_MESSAGE, tabId })
    .catch(() => {});
}

export default defineBackground(() => {
  void applyToolbarMode();
  browser.runtime.onInstalled.addListener(() => {
    void applyToolbarMode();
    void createContextMenus();
    void scheduleSessionRefresh();
  });
  browser.runtime.onStartup.addListener(() => {
    void applyToolbarMode();
    void scheduleSessionRefresh();
    void refreshSession();
  });

  // Re-apply as soon as the Options page saves a different toolbar mode.
  browser.storage.sync.onChanged.addListener((changes) => {
    if ('toolbarAction' in changes) void applyToolbarMode();
  });

  // Only reached when no popup is registered, i.e. the toolbar icon is set to
  // open the timer or to toggle the article panel over the page. The click
  // grants `activeTab` for the tab, which is all the panel needs.
  toolbarButton.onClicked.addListener((tab) => {
    void (async () => {
      const { toolbarAction } = await getSettings();
      if (toolbarAction === 'reader') await toggleReaderOrFallBack(tab?.id);
      else await openTimerWindow();
    })();
  });

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    const type = (message as { type?: string } | undefined)?.type;
    switch (type) {
      case OPEN_TIMER_MESSAGE:
        void openTimerWindow();
        return;
      case READER_SNAPSHOT_MESSAGE:
        return handleSnapshotRequest(sender.tab?.id);
      case SIGN_IN_MESSAGE:
        return runSignInFlow();
      case SIGN_OUT_MESSAGE:
        return signOut();
      default:
        return;
    }
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === READ_PAGE_MENU_ID) {
      void toggleReaderOrFallBack(tab?.id);
      return;
    }
    if (info.menuItemId !== CHECK_PAGE_MENU_ID || !info.pageUrl) return;
    // The popup can't read another window's active tab, so the URL to check is
    // handed to it explicitly.
    void browser.windows.create({
      url: browser.runtime.getURL(`/${POPUP_PAGE}?url=${encodeURIComponent(info.pageUrl)}`),
      type: 'popup',
      ...CHECK_WINDOW,
    });
  });

  browser.tabs.onUpdated.addListener((tabId, change) => {
    if (change.url) notifyPanelOfTabChange(tabId);
  });

  browser.windows.onRemoved.addListener((windowId) => void forgetTimerWindow(windowId));

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SESSION_REFRESH_ALARM) void refreshSession();
  });
  void scheduleSessionRefresh();
});

/** Keeps the session-refresh alarm registered without stacking duplicates. */
async function scheduleSessionRefresh(): Promise<void> {
  if (await browser.alarms.get(SESSION_REFRESH_ALARM)) return;
  await browser.alarms.create(SESSION_REFRESH_ALARM, {
    periodInMinutes: SESSION_REFRESH_PERIOD_MINUTES,
  });
}
