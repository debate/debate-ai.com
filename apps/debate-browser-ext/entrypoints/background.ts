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
  openReaderPanel,
} from '@/src/reader/panel';
import { getSettings, type ToolbarAction } from '@/src/settings/settings';
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

/**
 * The toolbar mode, cached so the click handler can act on it without an
 * await. Opening the article panel only works while the browser still sees the
 * click as a user action, and awaiting a settings read first loses that — see
 * src/reader/panel.ts. The cache is filled whenever the mode is applied, which
 * includes every time this worker starts, so it is populated before any click
 * can arrive; the handler still falls back to reading storage if it is not.
 */
let cachedToolbarAction: ToolbarAction | null = null;

async function applyToolbarMode(): Promise<void> {
  const { toolbarAction } = await getSettings();
  cachedToolbarAction = toolbarAction;
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

/** The tab the reader is looking at, which is the one the panel reads. */
async function getActiveTab(): Promise<{ id?: number; url?: string } | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** What the article panel gets back when it asks for the current page. */
interface SnapshotResponse {
  ok: boolean;
  snapshot?: Awaited<ReturnType<typeof capturePageSnapshot>>;
  error?: string;
}

async function handleSnapshotRequest(): Promise<SnapshotResponse> {
  const tab = await getActiveTab();
  if (tab?.id == null) return { ok: false, error: 'No page is open to read.' };
  try {
    return { ok: true, snapshot: await capturePageSnapshot(tab.id) };
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
 * Tells an open article panel that the reader has moved to another page, so it
 * can offer to read that one. Sent, not acted on: re-extracting under the
 * reader mid-sentence would be worse than a button.
 */
function notifyPanelOfTabChange(): void {
  // Nothing is listening when the panel is closed, and that rejection is not
  // a problem worth reporting.
  void browser.runtime.sendMessage({ type: READER_TAB_CHANGED_MESSAGE }).catch(() => {});
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
  // open the timer or the article panel. The panel is opened straight from
  // this handler, with no await in front of it, because that click is the user
  // action the browser checks for.
  toolbarButton.onClicked.addListener((tab) => {
    if (cachedToolbarAction === 'reader') {
      void openReaderPanel(tab?.windowId).then((opened) => {
        if (!opened) return openTimerWindow();
      });
      return;
    }
    if (cachedToolbarAction === 'timer') {
      void openTimerWindow();
      return;
    }
    // The worker was started by this very click and has not read the setting
    // yet. Opening the panel is no longer possible on this click, so fall back
    // to the timer and let the next click do the right thing.
    void (async () => {
      await applyToolbarMode();
      await openTimerWindow();
    })();
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    const type = (message as { type?: string } | undefined)?.type;
    switch (type) {
      case OPEN_TIMER_MESSAGE:
        void openTimerWindow();
        return;
      case READER_SNAPSHOT_MESSAGE:
        return handleSnapshotRequest();
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
      void openReaderPanel(tab?.windowId);
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

  browser.tabs.onActivated.addListener(() => notifyPanelOfTabChange());
  browser.tabs.onUpdated.addListener((_tabId, change, tab) => {
    if (change.status === 'complete' && tab.active) notifyPanelOfTabChange();
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
