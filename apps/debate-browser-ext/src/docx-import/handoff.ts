/**
 * Right-click a link to a `.docx` → "Open in Debate AI editor".
 *
 * The background worker fetches the file with this extension's permission for
 * the link's site (asked for on the click, see `entrypoints/background.ts`)
 * and the reader's cookies there — which is what opens a file behind a
 * sign-in the web app could never fetch — parks the bytes under a one-time id
 * in `storage.local`, and opens debate-ai.com's receiver,
 * `/import/docx?handoff=<id>&url=<link>&name=<file name>`. That page takes the
 * bytes back over `externally_connectable` (Chromium only), imports them into
 * My Files › Imported and opens the editor
 * (`packages/debate-reason-docs/src/lib/my-files/docx-handoff.ts`).
 *
 * When the fetch fails, or in the Firefox build where a web page cannot
 * message the extension, the receiver is opened without a handoff and fetches
 * `url` itself, then falls back to asking the reader for the downloaded file.
 *
 * The parts here take their storage as an argument so they are unit tested
 * without a browser.
 */

/** Must match `DOCX_HANDOFF_MESSAGE` in the web app's `lib/my-files/docx-handoff.ts`. */
export const DOCX_HANDOFF_MESSAGE = 'debate-ai:docx-handoff';

/** The context-menu item's id. */
export const OPEN_DOCX_MENU_ID = 'open-docx-in-debate-ai-editor';

/** The web app's receiver route. */
export const DOCX_IMPORT_ROUTE = '/import/docx';

/** Larger files are not fetched; the web app refuses the same size. */
export const MAX_DOCX_BYTES = 25 * 1024 * 1024;

/** A parked file not taken within this long is dropped. */
export const HANDOFF_TTL_MS = 10 * 60 * 1000;

const KEY_PREFIX = 'docx-handoff:';

/**
 * Links the menu item shows on: any http(s) URL whose path ends in `.docx`,
 * with or without a query string. Match patterns are case-sensitive, so the
 * upper-case spelling Word sometimes writes is listed too.
 */
export const DOCX_LINK_PATTERNS: string[] = [
  '*://*/*.docx',
  '*://*/*.docx?*',
  '*://*/*.DOCX',
  '*://*/*.DOCX?*',
];

/** The part of `chrome.storage.local` a handoff needs. */
export interface HandoffStorageArea {
  get(keys?: string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

interface ParkedFile {
  name: string;
  base64: string;
  createdAt: number;
}

export interface HandoffResponse {
  ok: boolean;
  name?: string;
  base64?: string;
  error?: string;
}

/** `name` made safe to store: no path separators, never empty, ends in `.docx`. */
export function ensureDocxName(name: string | null | undefined): string {
  const safe = (name ?? '').replace(/[\\/]/g, '-').trim();
  if (!safe || safe === '.docx') return 'Imported.docx';
  return /\.docx$/i.test(safe) ? safe : `${safe}.docx`;
}

/**
 * The file name a `Content-Disposition` header gives, preferring the RFC 5987
 * `filename*=UTF-8''…` form, or `null` when it gives none.
 */
export function filenameFromContentDisposition(header: string | null | undefined): string | null {
  if (!header) return null;
  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)?''([^;]+)/i.exec(header);
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^"|"$/g, ''));
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
  const value = plain?.[2] ?? plain?.[1];
  return value ? value.trim() : null;
}

/** The last path segment of `url`, decoded — `"Imported.docx"` when there is none. */
export function docxNameFromUrl(url: string): string {
  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
    return ensureDocxName(decodeURIComponent(segment));
  } catch {
    return ensureDocxName('');
  }
}

/** The receiver URL on `apiBase` for a link, with the handoff id when there is one. */
export function receiverUrl(
  apiBase: string,
  { url, name, handoff }: { url: string; name: string; handoff?: string | null },
): string {
  const params = new URLSearchParams();
  if (handoff) params.set('handoff', handoff);
  params.set('url', url);
  params.set('name', name);
  return `${apiBase.replace(/\/$/, '')}${DOCX_IMPORT_ROUTE}?${params.toString()}`;
}

/** Bytes → base64, in chunks so a large file doesn't overflow the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Drops parked files older than {@link HANDOFF_TTL_MS}. */
export async function pruneHandoffs(area: HandoffStorageArea, now = Date.now()): Promise<void> {
  const all = await area.get(null);
  const stale = Object.entries(all)
    .filter(([key, value]) => {
      if (!key.startsWith(KEY_PREFIX)) return false;
      const createdAt = (value as Partial<ParkedFile> | undefined)?.createdAt;
      return typeof createdAt !== 'number' || now - createdAt > HANDOFF_TTL_MS;
    })
    .map(([key]) => key);
  if (stale.length > 0) await area.remove(stale);
}

/** Parks `bytes` under a new one-time id, and returns the id. */
export async function parkDocx(
  area: HandoffStorageArea,
  name: string,
  bytes: Uint8Array,
  { now = Date.now(), id = crypto.randomUUID() }: { now?: number; id?: string } = {},
): Promise<string> {
  await pruneHandoffs(area, now);
  const parked: ParkedFile = { name: ensureDocxName(name), base64: bytesToBase64(bytes), createdAt: now };
  await area.set({ [KEY_PREFIX + id]: parked });
  return id;
}

/** Whether a message from the web app is a handoff request. */
export function isDocxHandoffMessage(message: unknown): boolean {
  return (message as { type?: unknown } | undefined)?.type === DOCX_HANDOFF_MESSAGE;
}

/**
 * Answers the web app's `{ op: 'take', id }`: the parked file, which is then
 * forgotten — a handoff id is good for one take.
 */
export async function handleDocxHandoffMessage(
  message: unknown,
  area: HandoffStorageArea,
  now = Date.now(),
): Promise<HandoffResponse> {
  const request = message as { op?: unknown; id?: unknown };
  if (request.op !== 'take' || typeof request.id !== 'string' || !/^[\w-]{8,64}$/.test(request.id)) {
    return { ok: false, error: 'Bad request' };
  }
  const key = KEY_PREFIX + request.id;
  const stored = (await area.get([key]))[key] as ParkedFile | undefined;
  if (!stored) return { ok: false, error: 'The Debate AI extension no longer has that file.' };
  await area.remove([key]);
  if (now - stored.createdAt > HANDOFF_TTL_MS) {
    return { ok: false, error: 'That file was fetched too long ago. Right-click the link again.' };
  }
  return { ok: true, name: stored.name, base64: stored.base64 };
}
