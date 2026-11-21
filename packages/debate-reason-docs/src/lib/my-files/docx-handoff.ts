/**
 * @fileoverview The web app's half of the browser extension's "Open in Debate
 * AI editor" link menu: read what the extension left for `/import/docx`, and
 * pick the My Files folder an imported file goes into.
 *
 * The extension (`apps/debate-browser-ext/src/docx-import/`) fetches the
 * `.docx` a link points at with its own host permission and the reader's
 * cookies for that site, parks the bytes under a one-time id, and opens
 * `/import/docx?handoff=<id>&url=<link>&name=<file name>`. The page then asks
 * the extension for those bytes over `externally_connectable` (Chromium only),
 * which the manifest limits to debate-ai.com. When there is no handoff — the
 * Firefox build, or an extension that could not fetch the file — the page
 * fetches `url` itself, which works for a host that allows it (CORS).
 *
 * Everything here is pure or takes its I/O as an argument, so it is unit
 * tested without a browser; `docs/import/DocxImportReceiver.tsx` wires it up.
 *
 * @module lib/my-files/docx-handoff
 */

import type { MyFilesIndexEntry } from "./file-index"

/** The receiver route the extension opens. */
export const DOCX_IMPORT_ROUTE = "/import/docx"

/** The My Files folder (top level) every file opened from a link lands in. */
export const IMPORTED_FOLDER_TITLE = "Imported"

/** Must match `DOCX_HANDOFF_MESSAGE` in the extension's `src/docx-import/handoff.ts`. */
export const DOCX_HANDOFF_MESSAGE = "debate-ai:docx-handoff"

/** Must match the extension's `MAX_DOCX_BYTES`: bigger files are refused there. */
export const MAX_DOCX_BYTES = 25 * 1024 * 1024

/** What `/import/docx` was asked to import. */
export interface DocxImportParams {
  /** The one-time id the extension parked the bytes under, if it fetched them. */
  handoff: string | null
  /** The link the file came from — the fallback fetch, and what is shown. */
  url: string | null
  /** The file name to store it as. */
  name: string
}

/** Only http(s) links are fetched; anything else is dropped. */
function httpUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null
  } catch {
    return null
  }
}

/**
 * The name a `.docx` from `url` is stored under: the last path segment,
 * decoded, with `.docx` added when it is missing. `"Imported.docx"` when the
 * URL names nothing.
 */
export function docxNameFromUrl(url: string | null): string {
  let segment = ""
  if (url) {
    try {
      segment = new URL(url).pathname.split("/").filter(Boolean).pop() ?? ""
      segment = decodeURIComponent(segment)
    } catch {
      segment = ""
    }
  }
  return ensureDocxName(segment)
}

/** `name` made safe to store: no path separators, never empty, ends in `.docx`. */
export function ensureDocxName(name: string | null | undefined): string {
  const safe = (name ?? "").replace(/[\\/]/g, "-").trim()
  if (!safe || safe === ".docx") return `${IMPORTED_FOLDER_TITLE}.docx`
  return /\.docx$/i.test(safe) ? safe : `${safe}.docx`
}

/** Reads `/import/docx`'s query string. */
export function parseDocxImportParams(search: string | URLSearchParams): DocxImportParams {
  const params = typeof search === "string" ? new URLSearchParams(search) : search
  const handoff = params.get("handoff")
  const url = httpUrl(params.get("url"))
  const name = params.get("name")
  return {
    handoff: handoff && /^[\w-]{8,64}$/.test(handoff) ? handoff : null,
    url,
    name: name ? ensureDocxName(name) : docxNameFromUrl(url),
  }
}

/** The top-level "Imported" folder in a My Files index, if there is one. */
export function findImportedFolder(items: readonly Pick<MyFilesIndexEntry, "id" | "title" | "parentId" | "isFolder">[]): number | null {
  const folder = items.find(
    (item) => item.isFolder && (item.parentId ?? null) === null && item.title.trim() === IMPORTED_FOLDER_TITLE,
  )
  return folder ? folder.id : null
}

/** Base64 → bytes. */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** What the extension answers a handoff request with. */
interface HandoffResponse {
  ok?: boolean
  name?: string
  base64?: string
  error?: string
}

type SendMessage = (extensionId: string, message: unknown, callback: (response: unknown) => void) => void

/** `chrome.runtime.sendMessage` when this page may message an extension. */
function defaultSendMessage(): SendMessage | null {
  const chrome = (globalThis as { chrome?: { runtime?: { sendMessage?: unknown; lastError?: unknown } } }).chrome
  const send = chrome?.runtime?.sendMessage
  return typeof send === "function" ? (send.bind(chrome!.runtime) as SendMessage) : null
}

/**
 * Takes the file the extension parked under `handoff`. Resolves to a `File`,
 * or to an error message when the extension is unreachable, has nothing under
 * that id (already taken, or expired), or could not read it.
 */
export function takeDocxFromExtension(
  extensionId: string,
  handoff: string,
  fallbackName: string,
  { sendMessage = defaultSendMessage(), timeoutMs = 5000 }: { sendMessage?: SendMessage | null; timeoutMs?: number } = {},
): Promise<{ ok: true; file: File } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    if (!sendMessage) {
      resolve({ ok: false, error: "The Debate AI extension can't hand files to this browser." })
      return
    }
    let done = false
    const finish = (result: { ok: true; file: File } | { ok: false; error: string }) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(result)
    }
    const timer = setTimeout(() => finish({ ok: false, error: "The Debate AI extension did not answer." }), timeoutMs)
    try {
      sendMessage(extensionId, { type: DOCX_HANDOFF_MESSAGE, op: "take", id: handoff }, (raw) => {
        const response = raw as HandoffResponse | undefined
        if (!response?.ok || typeof response.base64 !== "string") {
          finish({ ok: false, error: response?.error || "The Debate AI extension no longer has that file." })
          return
        }
        try {
          const bytes = base64ToBytes(response.base64)
          const name = ensureDocxName(response.name || fallbackName)
          finish({ ok: true, file: new File([bytes], name, { type: DOCX_MIME }) })
        } catch {
          finish({ ok: false, error: "The file from the extension could not be read." })
        }
      })
    } catch (error) {
      finish({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

/**
 * Fetches `url` from this page — the fallback when the extension did not hand
 * the file over. Only works when the file's host allows it (CORS), which is
 * why the extension fetches first.
 */
export async function fetchDocx(
  url: string,
  name: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; file: File } | { ok: false; error: string }> {
  try {
    const res = await fetchImpl(url, { credentials: "omit" })
    if (!res.ok) return { ok: false, error: `The file's site answered ${res.status}.` }
    const blob = await res.blob()
    if (blob.size > MAX_DOCX_BYTES) return { ok: false, error: "That file is larger than 25 MB." }
    return { ok: true, file: new File([blob], ensureDocxName(name), { type: DOCX_MIME }) }
  } catch {
    return { ok: false, error: "The file's site does not let Debate AI download it directly." }
  }
}
