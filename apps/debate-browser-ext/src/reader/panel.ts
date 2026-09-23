/**
 * Opening the article panel.
 *
 * It is a real browser side panel — Chrome's `sidePanel`, Firefox's
 * `sidebarAction` — rather than something injected into the page, for the same
 * reason the round timer is its own window: a panel that is part of the
 * browser keeps the article and its Q&A open while the reader clicks around
 * the page, and it is an extension page, so it renders the ported UI with the
 * extension's own styles rather than fighting whatever CSS the site ships.
 *
 * Both APIs insist on being called while handling a user action, so every
 * caller here is one: a toolbar click, a popup button, a context-menu item.
 */
import { browser } from 'wxt/browser';

/** Message asking the background worker for the active tab's article snapshot. */
export const READER_SNAPSHOT_MESSAGE = 'debate-reader-snapshot';

/** Message the background worker sends the panel when the reader switches tabs. */
export const READER_TAB_CHANGED_MESSAGE = 'debate-reader-tab-changed';

type ChromeSidePanel = {
  open?: (options: { tabId?: number; windowId?: number }) => Promise<void>;
};

/** Chrome's side panel API, when this browser has one. */
function chromeSidePanel(): ChromeSidePanel | undefined {
  return (browser as unknown as { sidePanel?: ChromeSidePanel }).sidePanel;
}

type FirefoxSidebarAction = { open?: () => Promise<void> };

function firefoxSidebar(): FirefoxSidebarAction | undefined {
  return (browser as unknown as { sidebarAction?: FirefoxSidebarAction }).sidebarAction;
}

/** Whether this browser can show the panel at all. */
export function supportsReaderPanel(): boolean {
  return Boolean(chromeSidePanel()?.open || firefoxSidebar()?.open);
}

/**
 * Opens the article panel, for the whole window when `windowId` is known.
 *
 * Must be called from a user-action handler, and — this is the part that is
 * easy to get wrong — it must be the *first* thing that handler does. Both
 * browsers check the gesture against the call stack, and awaiting any other
 * extension API first (reading a setting, querying the active tab) resolves on
 * a later task, by which time the gesture is gone and the call is rejected. So
 * this awaits nothing before opening: callers resolve whatever they need
 * beforehand and pass it in.
 *
 * The panel is opened per window rather than per tab so it stays put as the
 * reader moves between tabs; the panel itself offers to re-read when they do.
 *
 * Returns `false` when the browser offers no panel to open, so the caller can
 * fall back rather than fail silently.
 */
export function openReaderPanel(windowId?: number): Promise<boolean> {
  const sidePanel = chromeSidePanel();
  if (sidePanel?.open) {
    // The path comes from the manifest's `side_panel.default_path`, so there
    // is nothing to configure first.
    return sidePanel
      .open(windowId != null ? { windowId } : { windowId: browser.windows.WINDOW_ID_CURRENT })
      .then(() => true);
  }

  const sidebar = firefoxSidebar();
  if (sidebar?.open) return sidebar.open().then(() => true);

  return Promise.resolve(false);
}
