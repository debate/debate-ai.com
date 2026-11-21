/**
 * The background worker's side of "Open in Debate AI editor" on a `.docx`
 * link: ask for the link's site, fetch the file, park it, open the receiver.
 * The protocol is described in `./handoff.ts`.
 */
import { browser } from 'wxt/browser';

import { getSettings } from '@/src/settings/settings';
import {
  MAX_DOCX_BYTES,
  docxNameFromUrl,
  ensureDocxName,
  filenameFromContentDisposition,
  parkDocx,
  receiverUrl,
} from './handoff';

/** The host-permission pattern for `url`'s site, or `null` for a non-web URL. */
export function originPattern(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'http:' && protocol !== 'https:') return null;
    return `${protocol}//${hostname}/*`;
  } catch {
    return null;
  }
}

/**
 * Asks for permission to fetch from the link's site. Must be called straight
 * from the menu click, before any `await`: the browser only shows the prompt
 * during the user gesture. Resolves without a prompt when it was granted
 * before. A refusal is not fatal — the receiver can still try the link.
 */
export function requestLinkPermission(linkUrl: string): Promise<boolean> {
  const origin = originPattern(linkUrl);
  if (!origin) return Promise.resolve(false);
  try {
    return browser.permissions.request({ origins: [origin] }).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

/** A `.docx` is a zip: it starts with `PK`. A sign-in page in its place doesn't. */
function looksLikeDocx(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/** Fetches the link with the reader's cookies for its site. */
async function fetchDocx(linkUrl: string): Promise<{ name: string; bytes: Uint8Array } | null> {
  try {
    const res = await fetch(linkUrl, { credentials: 'include' });
    if (!res.ok) return null;
    const length = Number(res.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_DOCX_BYTES) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_DOCX_BYTES || !looksLikeDocx(bytes)) return null;
    const header = filenameFromContentDisposition(res.headers.get('content-disposition'));
    // A redirect (a share link → its storage URL) names the file better.
    const name = header ? ensureDocxName(header) : docxNameFromUrl(res.url || linkUrl);
    return { name, bytes };
  } catch (error) {
    console.warn('Could not fetch the .docx for Debate AI:', error);
    return null;
  }
}

/**
 * Fetches `linkUrl`, parks it, and opens the web app's receiver in a new tab
 * beside `openerTabId`. Without the file (no permission, a failed fetch) the
 * receiver still opens, with just the link, and takes it from there.
 */
export async function openDocxInEditor(
  linkUrl: string,
  permission: Promise<boolean>,
  openerTab?: { id?: number; index?: number },
): Promise<void> {
  const { apiBase } = await getSettings();
  await permission;
  const fetched = await fetchDocx(linkUrl);
  let handoff: string | null = null;
  if (fetched) {
    try {
      handoff = await parkDocx(browser.storage.local, fetched.name, fetched.bytes);
    } catch (error) {
      console.warn('Could not hand the .docx to Debate AI:', error);
    }
  }
  const url = receiverUrl(apiBase, {
    url: linkUrl,
    name: fetched?.name ?? docxNameFromUrl(linkUrl),
    handoff,
  });
  await browser.tabs.create({
    url,
    active: true,
    ...(openerTab?.index != null ? { index: openerTab.index + 1 } : {}),
    ...(openerTab?.id != null ? { openerTabId: openerTab.id } : {}),
  });
}
