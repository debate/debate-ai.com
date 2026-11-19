import { browser } from 'wxt/browser';

import {
  SIGN_IN_MESSAGE,
  SIGN_OUT_MESSAGE,
  authorizedFetch,
  getActiveSession,
  refreshSession,
  runSignInFlow,
  signOut,
  type StoredSession,
} from '@/src/auth/session';
import { runSignInFlow } from '@/src/auth/sign-in-flow';
import { QWKSEARCH_CONNECT_MESSAGE, runQwkSearchConnectFlow } from '@/src/auth/qwksearch-connect';
import { PageNotReadableError, capturePageSnapshot } from '@/src/reader/snapshot';
import {
  READER_SNAPSHOT_MESSAGE,
  READER_TAB_CHANGED_MESSAGE,
  openReaderForTab,
} from '@/src/reader/panel';
import { getSettings } from '@/src/settings/settings';
import { handleBulkStorageMessage, isBulkStorageMessage } from '@/src/storage/bulk-storage-bridge';
import {
  DOCX_LINK_PATTERNS,
  OPEN_DOCX_MENU_ID,
  handleDocxHandoffMessage,
  isDocxHandoffMessage,
} from '@/src/docx-import/handoff';
import { openDocxInEditor, requestLinkPermission } from '@/src/docx-import/open-in-editor';
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

/** Right-click → read this page, the article panel's other way in. */
const READ_PAGE_MENU_ID = 'read-page-in-article-panel';

/** Right-click → open a linked .docx in the Debate AI editor. */
const OPEN_DOCX_MENU_ID = 'open-docx-in-debate-ai';

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
    id: OPEN_DOCX_MENU_ID,
    title: 'Open in Debate AI editor',
    contexts: ['link'],
    // Limit the menu to links whose URL looks like a .docx file. A query string
    // on the download URL is fine — the match is on the path, and the handler
    // re-checks the extension before downloading.
    targetUrlPatterns: ['http://*/*/*.docx', 'https://*/*/*.docx'],
  });
}

/** The tab the reader is looking at. */
async function getActiveTab(): Promise<{ id?: number; url?: string } | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Shows or hides the article panel over `tab` — or opens it as its own tab for
 * a PDF or a page it can't sit on (src/reader/panel.ts) — falling back to the
 * timer window on pages with no web URL at all (browser-internal pages, the
 * web store), so the click still does something.
 */
async function toggleReaderOrFallBack(tab: { id?: number; url?: string } | undefined): Promise<void> {
  try {
    await openReaderForTab(tab ?? {});
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
      if (toolbarAction === 'reader') await toggleReaderOrFallBack(tab);
      else await openTimerWindow();
    })();
  });

  browser.runtime.onMessage.addListener(
    (
      message: unknown,
      sender: { tab?: { id?: number } },
      sendResponse: (response?: unknown) => void,
    ) => {
      // WXT's `browser` is Chrome's own API, not webextension-polyfill, and
      // Chrome does not take a returned promise as the reply: answer through
      // `sendResponse` and return `true` to keep the channel open.
      const reply = (work: Promise<unknown>) => {
        work.then(sendResponse, (error: unknown) =>
          sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
        );
        return true;
      };
      const type = (message as { type?: string } | undefined)?.type;
      switch (type) {
        case OPEN_TIMER_MESSAGE:
          void openTimerWindow();
          return;
        case READER_SNAPSHOT_MESSAGE:
          return reply(handleSnapshotRequest(sender.tab?.id));
        case SIGN_IN_MESSAGE:
          return reply(runSignInFlow());
        case SIGN_OUT_MESSAGE:
          return reply(signOut());
        case QWKSEARCH_CONNECT_MESSAGE:
          return reply(runQwkSearchConnectFlow());
        default:
          return;
      }
    },
  );

  // debate-ai.com mirroring its flows, rounds and history into this
  // extension's unlimited storage (src/storage/bulk-storage-bridge.ts). The
  // manifest's `externally_connectable` is what limits who can send these.
  // Chromium only; Firefox has no `onMessageExternal` for web pages.
  const onMessageExternal = (
    browser.runtime as unknown as {
      onMessageExternal?: typeof browser.runtime.onMessage;
    }
  ).onMessageExternal;
  onMessageExternal?.addListener(
    (message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
      // The `.docx` the "Open in Debate AI editor" menu item fetched, taken
      // once by debate-ai.com's /import/docx (src/docx-import/handoff.ts).
      // Answered through `sendResponse`, as above.
      if (isDocxHandoffMessage(message)) {
        handleDocxHandoffMessage(message, browser.storage.local).then(sendResponse, (error: unknown) =>
          sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
        );
        return true;
      }
      if (!isBulkStorageMessage(message)) return;
      return handleBulkStorageMessage(message, browser.storage.local);
    },
  );

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === READ_PAGE_MENU_ID) void toggleReaderOrFallBack(tab);
    else if (info.menuItemId === OPEN_DOCX_MENU_ID) void openDocxInEditor(info.linkUrl, tab);
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

/** Bytes → base64, so the .docx travels as text in the import request. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/** A one-off toast the reader can't miss, falling back to the console. */
async function notify(message: string): Promise<void> {
  try {
    await browser.notifications.create({
      type: 'basic',
      title: 'Debate AI',
      message,
    });
  } catch {
    console.error(`[debate-ai] ${message}`);
  }
}

/**
 * Right-click → "Open in Debate AI editor" for a linked .docx:
 *
 * 1. Make sure the reader is signed in (otherwise start the sign-in flow).
 * 2. Download the .docx from its URL — extensions fetch cross-origin without a
 *    CORS preflight, which a normal page could not do.
 * 3. POST the bytes to Debate AI's import receiver, which converts the .docx
 *    to Debate Editor's native `.cmir` and files it under My Files.
 * 4. Open the editor on the imported document.
 */
async function openDocxInEditor(linkUrl: string | undefined, tab: { id?: number } | undefined): Promise<void> {
  if (!linkUrl) return;
  const extensionUrl = linkUrl.split('?')[0]!;
  if (!/\.docx$/i.test(extensionUrl)) return;

  let session: StoredSession | null;
  try {
    session = await getActiveSession();
  } catch {
    session = null;
  }
  if (!session) {
    const result = await runSignInFlow();
    if (!result.ok) await notify(`Sign-in did not complete: ${result.error ?? 'unknown error'}.`);
    return;
  }

  const filename = extensionUrl.split('/').pop() || 'document.docx';
  let buffer: ArrayBuffer;
  try {
    const response = await fetch(linkUrl);
    if (!response.ok) {
      await notify(`Could not download "${filename}" (${response.status}).`);
      return;
    }
    buffer = await response.arrayBuffer();
  } catch (error) {
    await notify(`Could not download "${filename}": ${error instanceof Error ? error.message : String(error)}.`);
    return;
  }

  const bytes = new Uint8Array(buffer);
  const apiBase = (await getSettings()).apiBase.replace(/\/$/, '');
  let docId: number;
  try {
    const response = await authorizedFetch('/api/doc/import-extension', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docx: toBase64(bytes), filename }),
    });
    if (!response.ok) {
      await notify(`Debate AI refused the import (${response.status}).`);
      return;
    }
    const row = (await response.json()) as { id: number };
    if (!Number.isFinite(row.id)) throw new Error('The server did not return a document.');
    docId = row.id;
  } catch (error) {
    if (error instanceof Error && error.name === 'NotSignedInError') {
      await runSignInFlow();
      return;
    }
    await notify(`Could not import "${filename}": ${error instanceof Error ? error.message : String(error)}.`);
    return;
  }

  await browser.tabs.create({ url: `${apiBase}/reason-editor?doc=${docId}`, active: true });
}
