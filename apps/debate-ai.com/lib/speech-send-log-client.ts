/**
 * @fileoverview Network calls for the Speech Documents send-log account
 * sync (see `lib/database/schema.ts`'s `savedSpeechSendLog` comment and
 * `/api/speech-send-log`). Kept separate from `hooks/useSpeechSendLogSync.ts`
 * so the fetch calls stay easy to mock, mirroring `debate-round`'s
 * `round/judge-decisions-client.ts` split. Lives in the app rather than a
 * shared package because `SpeechSendLogEntry` itself is defined in
 * `debate-editor-cardmirror`, not `debate-round`.
 *
 * `listSavedSpeechSendLog` resolves to `null` (rather than throwing) on a
 * `401`, letting the caller fall back to local-only history instead of
 * showing an error. The write calls throw on failure since the caller
 * already has the entry in local state either way — a failed cloud sync is
 * reported but never blocks the local speech-send log.
 *
 * @module lib/speech-send-log-client
 */

import type { SpeechSendLogEntry } from "debate-editor-cardmirror/engine"

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string }
    return payload?.error ?? fallback
  } catch {
    return fallback
  }
}

/** Lists every speech-send-log entry synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedSpeechSendLog(
  endpoint = "/api/speech-send-log",
): Promise<SpeechSendLogEntry[] | null> {
  const res = await fetch(endpoint)
  if (res.status === 401) return null
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced speech-document history."))
  }
  return (await res.json()) as SpeechSendLogEntry[]
}

/** Saves (upserts, keyed by `entry.id`) a speech-send-log entry to the current user's account. Throws on failure, `401` included. */
export async function saveSpeechSendLogEntryToAccount(
  entry: SpeechSendLogEntry,
  endpoint = "/api/speech-send-log",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(entry.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entry }),
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to sync this entry to your account."))
  }
}

/** Deletes a synced speech-send-log entry from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedSpeechSendLogEntryFromAccount(
  id: string,
  endpoint = "/api/speech-send-log",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced entry."))
  }
}
