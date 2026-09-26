/**
 * The timer runs in its own `popup`-type browser window (timer.html), not in
 * the toolbar dropdown — a dropdown closes the moment the debater clicks back
 * into the page or another tab, which is exactly what you can't have happen
 * mid-speech. This restores the original extension's floating-window behavior
 * on top of the current WXT build.
 *
 * Only the background service worker calls `openTimerWindow`; extension pages
 * ask for it with `requestTimerWindow()`, which messages the worker so the
 * "focus the window that's already open" bookkeeping stays in one place.
 */
import { browser } from 'wxt/browser';

import { getSettings } from '@/src/settings/settings';

/** Message pages send to the background worker to raise the timer window. */
export const OPEN_TIMER_MESSAGE = 'open-timer';

/** Where the id of the currently-open timer window is remembered. */
const TIMER_WINDOW_ID_KEY = 'timerWindowId';

/** Asks the background worker to open (or focus) the timer window. */
export async function requestTimerWindow(): Promise<void> {
  await browser.runtime.sendMessage({ type: OPEN_TIMER_MESSAGE });
}

async function getRememberedWindowId(): Promise<number | null> {
  const stored = await browser.storage.local.get(TIMER_WINDOW_ID_KEY);
  const id = stored[TIMER_WINDOW_ID_KEY];
  return typeof id === 'number' ? id : null;
}

/** The timer page's full URL, as its window's tab reports it. */
function timerPageUrl(): string {
  return browser.runtime.getURL('/timer.html');
}

/**
 * Whether `windowId` is still the timer's window. Window ids are only unique
 * within one browser session — after a restart the remembered id can name an
 * ordinary browser window (`windows.onRemoved` doesn't fire at shutdown), and
 * focusing that instead of opening the timer is what made the timer "not
 * launch". So the window is checked for the timer page itself.
 */
async function isTimerWindow(windowId: number): Promise<boolean> {
  const runtime = browser.runtime as unknown as {
    getContexts?: (filter: {
      contextTypes: string[];
      windowIds: number[];
      documentUrls: string[];
    }) => Promise<unknown[]>;
  };
  try {
    // MV3 (Chrome 116+): the worker has no views, but it can list contexts.
    if (runtime.getContexts) {
      const contexts = await runtime.getContexts({
        contextTypes: ['TAB'],
        windowIds: [windowId],
        documentUrls: [timerPageUrl()],
      });
      return contexts.length > 0;
    }
    // MV2 (the Firefox build): the background page can see the extension's
    // own pages directly.
    const views = browser.extension?.getViews?.({ windowId }) ?? [];
    return views.some((view) => view.location.href.startsWith(timerPageUrl()));
  } catch {
    return false;
  }
}

/**
 * Opens the timer in its own window, or focuses the one already open — the
 * service worker can be torn down between clicks, so the window id is kept in
 * `storage.local` rather than a module variable, and a stale id (the user
 * closed the window while the worker was asleep, or the browser restarted and
 * reused it) just falls through to opening a fresh one.
 */
export async function openTimerWindow(): Promise<void> {
  const existingId = await getRememberedWindowId();
  if (existingId !== null) {
    if (await isTimerWindow(existingId)) {
      try {
        await browser.windows.update(existingId, { focused: true });
        return;
      } catch {
        // Closed between the check and the focus; open a new one below.
      }
    }
    await browser.storage.local.remove(TIMER_WINDOW_ID_KEY);
  }

  const settings = await getSettings();
  const created = await browser.windows.create({
    url: timerPageUrl(),
    type: 'popup',
    width: settings.timerWindowWidth,
    height: settings.timerWindowHeight,
    focused: true,
  });
  if (created?.id != null) {
    await browser.storage.local.set({ [TIMER_WINDOW_ID_KEY]: created.id });
  }
}

/** Forgets the remembered window once the user closes it. */
export async function forgetTimerWindow(windowId: number): Promise<void> {
  if ((await getRememberedWindowId()) === windowId) {
    await browser.storage.local.remove(TIMER_WINDOW_ID_KEY);
  }
}
