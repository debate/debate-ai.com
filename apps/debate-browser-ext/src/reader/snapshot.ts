/**
 * Reading the page out of the tab the reader is on.
 *
 * The page's own HTML is taken from the tab rather than re-fetching its URL
 * from a server, because the tab already holds the article as the reader sees
 * it: past the paywall they are subscribed to, past the cookie wall, and with
 * a client-rendered body that a fetch of the same URL would come back without.
 * That is what makes "works on any page" true rather than "works on pages a
 * crawler can read".
 *
 * Injection is allowed by `activeTab`, which the browser grants for the tab
 * the reader just acted on — clicking the toolbar icon, or the context-menu
 * item. The extension therefore never needs permission to read every site,
 * and can only ever see a page the reader explicitly opened it on.
 */
import { browser } from 'wxt/browser';

import type { PageSnapshot } from '@/src/article/types';

/**
 * Runs in the page. Deliberately self-contained — it is serialized into the
 * tab, so it can close over nothing, and every value it returns must survive
 * structured cloning.
 */
function collectPageSnapshot() {
  return {
    url: window.location.href,
    title: document.title || '',
    html: document.documentElement ? document.documentElement.outerHTML : '',
    selectionText: String(window.getSelection() || ''),
  };
}

/** The MV2 form of the same call, which takes code rather than a function. */
const SNAPSHOT_CODE = `(${collectPageSnapshot.toString()})()`;

function looksLikeSnapshot(value: unknown): value is PageSnapshot {
  return Boolean(value && typeof (value as PageSnapshot).html === 'string');
}

export class PageNotReadableError extends Error {}

/**
 * The snapshot of `tabId`, or a {@link PageNotReadableError} explaining why
 * there isn't one — a browser-internal page, the web store, a PDF viewer, or
 * any other tab an extension is not allowed to read.
 */
export async function capturePageSnapshot(tabId: number): Promise<PageSnapshot> {
  let result: unknown;
  try {
    if (browser.scripting?.executeScript) {
      const frames = await browser.scripting.executeScript({
        target: { tabId },
        func: collectPageSnapshot,
      });
      result = frames?.[0]?.result;
    } else {
      // MV2 (the Firefox build) has no scripting API.
      const frames = await browser.tabs.executeScript(tabId, { code: SNAPSHOT_CODE });
      result = frames?.[0];
    }
  } catch (error) {
    throw new PageNotReadableError(
      error instanceof Error && /cannot access|Missing host permission|Extension manifest/i.test(error.message)
        ? 'This page cannot be read by extensions. Try it on an ordinary web page.'
        : `Could not read this page: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!looksLikeSnapshot(result)) {
    throw new PageNotReadableError('This page returned nothing to read.');
  }
  return result;
}
