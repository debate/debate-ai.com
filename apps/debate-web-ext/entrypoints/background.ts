import { browser } from 'wxt/browser';

import { getSettings } from '@/src/settings/settings';
import { OPEN_TIMER_MESSAGE, forgetTimerWindow, openTimerWindow } from '@/src/timer/window';

/**
 * Toolbar clicks are routed here rather than straight into a dropdown: the
 * timer must live in its own window (see src/timer/window.ts), and the Options
 * page lets a user make that window the toolbar icon's default instead of the
 * card-reuse popup.
 *
 * Chrome only fires `action.onClicked` when no popup is registered, so the
 * chosen mode is applied by clearing or restoring `default_popup`.
 */
const POPUP_PAGE = 'popup.html';

/** Right-click → check this page, so the reuse check stays reachable in either toolbar mode. */
const CHECK_PAGE_MENU_ID = 'check-page-for-existing-cards';

/** Standalone reuse-check window: the same popup, told which URL to check. */
const CHECK_WINDOW = { width: 380, height: 460 } as const;

async function applyToolbarMode(): Promise<void> {
  const { toolbarAction } = await getSettings();
  await browser.action.setPopup({
    popup: toolbarAction === 'timer' ? '' : POPUP_PAGE,
  });
}

async function createContextMenu(): Promise<void> {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: CHECK_PAGE_MENU_ID,
    title: 'Check this page for existing cards',
    contexts: ['page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
}

export default defineBackground(() => {
  void applyToolbarMode();
  browser.runtime.onInstalled.addListener(() => {
    void applyToolbarMode();
    void createContextMenu();
  });
  browser.runtime.onStartup.addListener(() => void applyToolbarMode());

  // Re-apply as soon as the Options page saves a different toolbar mode.
  browser.storage.sync.onChanged.addListener((changes) => {
    if ('toolbarAction' in changes) void applyToolbarMode();
  });

  // Only reached in "open the timer" mode, where no popup is registered.
  browser.action.onClicked.addListener(() => void openTimerWindow());

  browser.runtime.onMessage.addListener((message: unknown) => {
    if ((message as { type?: string } | undefined)?.type === OPEN_TIMER_MESSAGE) {
      void openTimerWindow();
    }
  });

  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== CHECK_PAGE_MENU_ID || !info.pageUrl) return;
    // The popup can't read another window's active tab, so the URL to check is
    // handed to it explicitly.
    void browser.windows.create({
      url: browser.runtime.getURL(`/${POPUP_PAGE}?url=${encodeURIComponent(info.pageUrl)}`),
      type: 'popup',
      ...CHECK_WINDOW,
    });
  });

  browser.windows.onRemoved.addListener((windowId) => void forgetTimerWindow(windowId));
});
