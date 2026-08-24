/**
 * The one clipboard-write path for the whole editor.
 *
 * `navigator.clipboard.write` fails TRANSIENTLY: Win32's clipboard is
 * a global lock briefly held by whichever app copied last (Word,
 * clipboard managers — the exact apps a debate workflow alternates
 * with), and Chromium rejects writes from a document it considers
 * unfocused. A one-shot write therefore fails one-click-in-N and, in
 * the app's history, did so SILENTLY — a field report showed a user
 * had learned Create Reference "needs five clicks".
 *
 * Every writer here follows the same ladder:
 *   1. Desktop: the MAIN-process clipboard (`host.clipboardWriteHtml`
 *      → Electron `clipboard.write`) — native path, no renderer-focus
 *      requirement, shrugs off lock contention. Old packaged shells
 *      without the API fall through.
 *   2. Renderer: `navigator.clipboard`, retried on a short backoff
 *      (`writeClipboardWithRetry`) to ride out a held lock.
 *   3. Text-only: the deprecated-but-sturdy `execCommand('copy')`
 *      textarea trick as the last resort.
 *
 * Both entry points return an honest boolean — callers MUST surface
 * `false` to the user (toast); no copy path in the app is allowed to
 * fail silently again.
 */

import { getElectronHost } from './host/index.js';

/** Run `write`, retrying on rejection after each of `delays` ms.
 *  Exported for tests. */
export async function writeClipboardWithRetry(
  write: () => Promise<void>,
  delays: readonly number[] = [100, 250, 500],
): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      await write();
      return true;
    } catch (err) {
      if (attempt >= delays.length) {
        console.error('clipboard write failed after retries', err);
        return false;
      }
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}

/** Write an html + plain-text pair (rich copies: cards, references,
 *  headings). */
export async function writeClipboardHtml(html: string, text: string): Promise<boolean> {
  const host = getElectronHost();
  return writeClipboardWithRetry(async () => {
    if (host?.clipboardWriteHtml) {
      if (await host.clipboardWriteHtml(html, text)) return;
      // Older shell without the API — fall through to the renderer.
    }
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      // Old Firefox web: no ClipboardItem — degrade to a plain-text
      // copy rather than failing outright (the pre-consolidation
      // behavior of the heading-copy paths).
      await navigator.clipboard.writeText(text);
      return;
    }
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
  });
}

/** Write plain text. */
export async function writeClipboardText(text: string): Promise<boolean> {
  const host = getElectronHost();
  const ok = await writeClipboardWithRetry(async () => {
    if (host?.clipboardWriteHtml) {
      // Empty html deliberately: a text-only copy must not leave a
      // stale rich flavor from a previous copy on the clipboard.
      if (await host.clipboardWriteHtml('', text)) return;
    }
    if (!navigator.clipboard?.writeText) throw new Error('no async clipboard');
    await navigator.clipboard.writeText(text);
  });
  if (ok) return true;
  // Last resort: the legacy textarea + execCommand trick. Deprecated,
  // but it still works where the async API is absent or blocked.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-1000px';
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}

/** The shared "it didn't work" wording, so every copy surface fails
 *  the same way. */
export const CLIPBOARD_BUSY_MESSAGE = "Couldn't copy — the clipboard was busy. Try again.";
