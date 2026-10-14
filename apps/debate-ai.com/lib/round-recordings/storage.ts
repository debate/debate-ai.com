/**
 * @fileoverview Where joined round recordings live in R2: the MP3 of every
 * speech joined, its captions, each debater's webcam clips, and the manifest
 * tying them together (built in the browser by `@debate/timer`'s
 * `RoundRecordingDialog`).
 *
 * Bound as `ROUND_RECORDINGS` in wrangler.jsonc. Keys are
 * `round-recordings/<userId>/<roundId>/<file>`: a recording is a student's
 * voice and face, so it is readable only by the account that uploaded it
 * (see `app/api/round-recordings`).
 *
 * @module lib/round-recordings/storage
 */

import { getCloudflareContext } from "@/lib/database/context"

export const ROUND_RECORDINGS_PREFIX = "round-recordings/"

/**
 * The largest file accepted. Workers take request bodies up to 100 MB on the
 * Free and Pro plans; an hour of joined MP3 is ~30 MB and an 8-minute webcam
 * clip ~30 MB at the recorder's bitrate.
 */
export const MAX_UPLOAD_BYTES = 95 * 1024 * 1024

/** Content types a round file may have. */
const ALLOWED_TYPES = /^(audio\/(mpeg|webm|ogg|mp4)|video\/(webm|mp4)|text\/vtt|application\/json)(;.*)?$/i

/** The slice of the R2 binding this feature uses. */
export interface RoundRecordingsBucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
  get(key: string): Promise<{ body: ReadableStream; size: number; httpMetadata?: { contentType?: string } } | null>
  list(options: { prefix: string; cursor?: string }): Promise<{
    objects: Array<{ key: string; size: number; uploaded: Date }>
    truncated: boolean
    cursor?: string
  }>
}

/** The `ROUND_RECORDINGS` binding of the current request, or null when it is not bound. */
export function getRoundRecordingsBucket(): RoundRecordingsBucket | null {
  const bucket = getCloudflareContext()?.env?.ROUND_RECORDINGS as RoundRecordingsBucket | undefined
  return bucket && typeof bucket.put === "function" ? bucket : null
}

/** A round id the client may use: the round's local id, or "practice". */
export function isRoundId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value)
}

/** A file name inside a round's folder. */
export function isRoundFileName(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value) && !value.includes("..")
}

export function isAllowedContentType(value: string | null): boolean {
  return !!value && ALLOWED_TYPES.test(value)
}

/** The folder holding one user's files for one round. */
export function roundFolder(userId: string, roundId: string): string {
  return `${ROUND_RECORDINGS_PREFIX}${userId}/${roundId}/`
}

/** The key of one file, or null when the round id or name isn't acceptable. */
export function roundFileKey(userId: string, roundId: string, name: string): string | null {
  if (!isRoundId(roundId) || !isRoundFileName(name)) return null
  return `${roundFolder(userId, roundId)}${name}`
}

/** Whether `key` is a round file belonging to `userId` — the only keys the file route serves. */
export function isOwnRoundFileKey(key: string, userId: string): boolean {
  const prefix = `${ROUND_RECORDINGS_PREFIX}${userId}/`
  if (!key.startsWith(prefix)) return false
  const [roundId, name, ...rest] = key.slice(prefix.length).split("/")
  return rest.length === 0 && isRoundId(roundId ?? "") && isRoundFileName(name ?? "")
}
