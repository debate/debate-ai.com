/**
 * @fileoverview IndexedDB storage for recordings too large for localStorage:
 * the joined round MP3 and its captions, and the webcam clips recorded with
 * each speech. One object store of blobs by key; every call resolves to
 * `null`/no-op where IndexedDB is missing (private windows, tests), so the
 * recorder keeps working without it.
 *
 * Keys: `round-audio:{roundId}`, `round-captions:{roundId}`,
 * `clip:{clipId}`.
 *
 * @module recorder/media-store
 */

const DB_NAME = "debate-recordings"
const STORE = "media"

/** Fired on `window` after a clip is saved, with `{ speechKey }` in `detail`. */
export const VIDEO_CLIP_SAVED_EVENT = "debate-video-clip-saved"

let dbPromise: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null)
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null)
        try {
          const request = act(db.transaction(STORE, mode).objectStore(STORE))
          request.onsuccess = () => resolve(request.result ?? null)
          request.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

export function putMedia(key: string, value: Blob | string): Promise<unknown> {
  return run("readwrite", (store) => store.put(value, key))
}

export function getMedia<T extends Blob | string = Blob>(key: string): Promise<T | null> {
  return run("readonly", (store) => store.get(key) as IDBRequest<T>)
}

export function deleteMedia(key: string): Promise<unknown> {
  return run("readwrite", (store) => store.delete(key))
}

export const roundAudioKey = (roundId: string) => `round-audio:${roundId}`
export const roundCaptionsKey = (roundId: string) => `round-captions:${roundId}`
export const clipKey = (clipId: string) => `clip:${clipId}`

/** A webcam clip recorded during a speech, as listed in localStorage. */
export interface StoredClip {
  id: string
  speechKey: string
  participant: string
  recordedAt: string
}

const CLIP_INDEX_KEY = "debate-video-clips"

/** Every clip this browser has, newest last. */
export function listClips(): StoredClip[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLIP_INDEX_KEY) ?? "[]") as StoredClip[]
    return Array.isArray(parsed) ? parsed.filter((c) => c && typeof c.id === "string" && typeof c.speechKey === "string") : []
  } catch {
    return []
  }
}

/**
 * Saves a clip for a speech. A participant has one clip per speech: a
 * resumed speech replaces the earlier clip rather than stacking them.
 */
export async function saveClip(speechKey: string, participant: string, blob: Blob): Promise<StoredClip> {
  const previous = listClips().filter((c) => c.speechKey === speechKey && c.participant === participant)
  const clip: StoredClip = {
    id: `${speechKey}:${participant}:${Date.now()}`,
    speechKey,
    participant,
    recordedAt: new Date().toISOString(),
  }
  await putMedia(clipKey(clip.id), blob)
  for (const old of previous) await deleteMedia(clipKey(old.id))
  const rest = listClips().filter((c) => !previous.some((p) => p.id === c.id))
  try {
    localStorage.setItem(CLIP_INDEX_KEY, JSON.stringify([...rest, clip]))
  } catch (e) {
    console.warn("Could not index the video clip:", e)
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VIDEO_CLIP_SAVED_EVENT, { detail: { speechKey } }))
  }
  return clip
}

/** Whether "Record webcam video" is on (a per-browser setting, off by default). */
export const RECORD_VIDEO_KEY = "debate-recording-video"
export const RECORD_VIDEO_EVENT = "debate-recording-video-changed"

export function readRecordVideo(): boolean {
  try {
    return localStorage.getItem(RECORD_VIDEO_KEY) === "1"
  } catch {
    return false
  }
}

export function writeRecordVideo(on: boolean): void {
  try {
    localStorage.setItem(RECORD_VIDEO_KEY, on ? "1" : "0")
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(RECORD_VIDEO_EVENT))
}
