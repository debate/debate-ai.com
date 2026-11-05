/**
 * @fileoverview Where Kokoro read-aloud paragraphs are shared: the
 * `SPEECH_AUDIO` R2 bucket, under `tts-cache/kokoro/<key>.wav`.
 *
 * A reader's browser makes each paragraph with Kokoro on their own device
 * (`@debate-ai/editor/kokoro-paragraphs`), and a signed-in reader's browser
 * uploads it through `/api/tts/cache`. After that every reader, signed in or
 * not, gets that paragraph from here instead of running the model.
 *
 * The key is `kokoroAudioCacheKey(text, voice)` (the hash of the model
 * version, voice and text), computed here from the text the upload sends,
 * never taken from the client. So the files are content-addressed and
 * immutable: the first upload for a key is kept and later ones are ignored.
 *
 * It shares the per-speech clip bucket rather than adding one, so no new
 * bucket has to exist before the next deploy. Without the binding (local
 * dev, a preview) the route answers 503 and the browser stops asking.
 * @module lib/tts/kokoro-audio-cache-store
 */

import { getCloudflareContext } from "@/lib/database/context"

/** The slice of the R2 binding this module uses. */
export interface KokoroAudioBucket {
  head(key: string): Promise<unknown | null>
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size: number } | null>
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<unknown>
}

const PREFIX = "tts-cache/kokoro"

/** The bound bucket, or `null` when this deployment has none. */
export function getKokoroAudioBucket(): KokoroAudioBucket | null {
  const bucket = getCloudflareContext()?.env?.SPEECH_AUDIO as KokoroAudioBucket | undefined
  return bucket && typeof bucket.get === "function" && typeof bucket.put === "function" && typeof bucket.head === "function"
    ? bucket
    : null
}

/** The object key for a cache key (64 hex characters, already checked). */
export function kokoroAudioObjectKey(key: string): string {
  return `${PREFIX}/${key}.wav`
}
