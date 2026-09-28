/**
 * Showing and hiding the article panel.
 *
 * The panel is an overlay on the page itself: `reader.html`, framed in an
 * `<iframe>` stacked above everything the site draws — covering the whole tab
 * with the article centered in it, or pinned to the right edge as a narrow
 * side panel, whichever the reader picked (see {@link ReaderLayout}). Each toolbar click (or popup button, or context-menu item)
 * toggles it — shown, hidden, shown again — and hiding keeps the frame alive,
 * so the article and the Q&A are still there when it comes back.
 *
 * It is still an extension page, only framed: it renders with the extension's
 * own styles rather than fighting whatever CSS the site ships, and it talks to
 * the background worker like any other extension page. The one thing the page
 * contributes is the frame element, which is created by a tiny injected
 * function under `activeTab` — the grant the browser gives for the tab the
 * reader just acted on — so the extension still needs no access to every site.
 * Framing an extension page from a web page does require it to be listed in
 * `web_accessible_resources` (wxt.config.ts).
 */
import { browser } from 'wxt/browser';

/** Message asking the background worker for the panel's tab's article snapshot. */
export const READER_SNAPSHOT_MESSAGE = 'debate-reader-snapshot';

/** Message the background worker sends when a tab navigates to another page. */
export const READER_TAB_CHANGED_MESSAGE = 'debate-reader-tab-changed';

/** `postMessage` the framed panel sends its host page to hide itself. */
export const READER_CLOSE_MESSAGE = 'debate-ai-reader-close';

/**
 * `postMessage` the framed panel sends its host page to resize itself:
 * `{ type, layout }`, where `layout` is one of {@link ReaderLayout}.
 */
export const READER_LAYOUT_MESSAGE = 'debate-ai-reader-layout';

/**
 * How the panel sits over the page: `full` covers the whole tab (the article
 * is centered in it, at the reader's chosen width), `side` is the narrow
 * panel pinned to the right edge.
 */
export type ReaderLayout = 'full' | 'side';

/** The panel page, as framed into the tab. */
export const READER_PAGE = 'reader.html';

/**
 * Runs in the page. Deliberately self-contained — it is serialized into the
 * tab, so it can close over nothing; everything it needs arrives as arguments.
 *
 * Returns whether the panel is now showing.
 */
function toggleOverlayInPage(src: string, closeMessage: string, layoutMessage: string): boolean {
  const FRAME_ID = 'debate-ai-reader-overlay';
  const existing = document.getElementById(FRAME_ID) as HTMLIFrameElement | null;
  if (existing) {
    const show = existing.style.getPropertyValue('display') === 'none';
    existing.style.setProperty('display', show ? 'block' : 'none', 'important');
    if (show) existing.focus();
    return show;
  }

  const frame = document.createElement('iframe');
  frame.id = FRAME_ID;
  frame.src = src;
  frame.title = 'Debate AI article panel';
  frame.setAttribute('allow', 'clipboard-write');
  // Every property is `!important` so a site's own `iframe { … }` rules can't
  // resize, hide or restyle the panel.
  const applyStyle = (style: Record<string, string>) => {
    for (const [name, value] of Object.entries(style)) {
      frame.style.setProperty(name, value, 'important');
    }
  };
  // The panel opens full-page (its default layout) and tells us straight away
  // if the reader chose the side panel instead.
  const layouts: Record<string, Record<string, string>> = {
    full: {
      width: '100vw',
      'border-left': '0',
      'box-shadow': 'none',
    },
    side: {
      width: 'min(460px, 100vw)',
      'border-left': '1px solid rgba(0, 0, 0, 0.15)',
      'box-shadow': '-8px 0 24px rgba(0, 0, 0, 0.18)',
    },
  };
  applyStyle({
    all: 'initial',
    display: 'block',
    position: 'fixed',
    top: '0',
    right: '0',
    bottom: '0',
    height: '100vh',
    margin: '0',
    padding: '0',
    border: '0',
    background: 'transparent',
    'color-scheme': 'normal',
    'z-index': '2147483647',
    ...layouts.full,
  });
  (document.body || document.documentElement).appendChild(frame);

  // The panel's own close button and Escape key ask to be hidden. Only the
  // panel's frame is listened to, so the page can't forge it (and hiding is
  // all it could do anyway).
  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data as { type?: string; layout?: string } | null;
    if (data?.type === closeMessage) {
      frame.style.setProperty('display', 'none', 'important');
    } else if (data?.type === layoutMessage && data.layout && layouts[data.layout]) {
      applyStyle(layouts[data.layout]);
    }
  });
  return true;
}

/**
 * Shows the article panel over `tabId`, or hides it if it is already showing.
 *
 * Must follow a user action on that tab — a toolbar click, the popup, a
 * context-menu item — since that is what grants `activeTab` for it. Unlike the
 * browser side panel this replaced, the grant lasts until the tab navigates,
 * so callers are free to await other things first.
 *
 * Resolves to whether the panel is now showing, and rejects on pages
 * extensions may not touch (browser-internal pages, the web store, PDFs).
 */
export async function toggleReaderPanel(tabId: number): Promise<boolean> {
  const src = browser.runtime.getURL(`/${READER_PAGE}`);
  if (browser.scripting?.executeScript) {
    const frames = await browser.scripting.executeScript({
      target: { tabId },
      func: toggleOverlayInPage,
      args: [src, READER_CLOSE_MESSAGE, READER_LAYOUT_MESSAGE],
    });
    return Boolean(frames?.[0]?.result);
  }
  // MV2 (the Firefox build) has no scripting API and takes code, not a function.
  const code = `(${toggleOverlayInPage.toString()})(${[
    src,
    READER_CLOSE_MESSAGE,
    READER_LAYOUT_MESSAGE,
  ]
    .map((arg) => JSON.stringify(arg))
    .join(', ')})`;
  const frames = await browser.tabs.executeScript(tabId, { code });
  return Boolean(frames?.[0]);
}

/** Asks the page framing this panel to take `layout`. Called from inside the panel. */
export function requestReaderPanelLayout(layout: ReaderLayout): void {
  if (window.parent === window) return;
  window.parent.postMessage({ type: READER_LAYOUT_MESSAGE, layout }, '*');
}

/** Asks the page framing this panel to hide it. Called from inside the panel. */
export function requestReaderPanelClose(): void {
  if (window.parent !== window) {
    // The host page's origin is whatever site the reader is on; the message
    // carries nothing but its type.
    window.parent.postMessage({ type: READER_CLOSE_MESSAGE }, '*');
    return;
  }
  // Opened directly as a tab rather than framed.
  window.close();
}
