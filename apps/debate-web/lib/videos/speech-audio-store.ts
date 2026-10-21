/**
 * @fileoverview Where a round's per-speech MP3 clips are kept: the
 * `SPEECH_AUDIO` R2 bucket, one folder per video.
 *
 * The clips are cut in the editor's browser by the "Split speeches from
 * audio" button (`@debate/videos`' `split-speech-audio.ts` says why the
 * Worker doesn't do it) and uploaded one by one through
 * `/api/admin/videos/library/[id]/speech-audio`. Keys are
 * `speech-audio/<videoId>/<nn>-<speech>.mp3`, numbered so a listing comes
 * back in speaking order.
 *
 * The bucket is bound without a `bucket_name` in `wrangler.jsonc`, so
 * wrangler provisions it on the first deploy, as it does `DB_BACKUPS_KV`.
 * Without the binding (local dev, a preview) every call reports that it is
 * not configured rather than throwing.
 * @module lib/videos/speech-audio-store
 */

import { getCloudflareContext } from "@/lib/database/context";

/** The slice of the R2 binding this module uses. */
export interface SpeechAudioBucket {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size: number } | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    objects: Array<{ key: string; size: number; uploaded?: Date }>;
    truncated: boolean;
    cursor?: string;
  }>;
}

const PREFIX = "speech-audio";

/** The biggest clip accepted — a nine-minute speech at 320 kbps is ~22 MB. */
export const MAX_SPEECH_CLIP_BYTES = 40 * 1024 * 1024;

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
/** `01-1AC.mp3`, `09-Grand-Crossfire.mp3` — what `cutSpeechClips` names them. */
const CLIP_NAME_RE = /^\d{2}-[A-Za-z0-9-]{1,40}\.mp3$/;

export function isVideoId(value: string): boolean {
  return VIDEO_ID_RE.test(value);
}

export function isSpeechClipName(value: string): boolean {
  return CLIP_NAME_RE.test(value);
}

/** The bound bucket, or `null` when this deployment has none. */
export function getSpeechAudioBucket(): SpeechAudioBucket | null {
  const bucket = getCloudflareContext()?.env?.SPEECH_AUDIO as SpeechAudioBucket | undefined;
  return bucket && typeof bucket.put === "function" && typeof bucket.list === "function" ? bucket : null;
}

export function speechClipKey(videoId: string, fileName: string): string {
  return `${PREFIX}/${videoId}/${fileName}`;
}

/** One stored clip, as the admin dialog lists it. */
export interface StoredSpeechClip {
  fileName: string;
  size: number;
  /** The admin-only link that streams it. */
  url: string;
}

export function speechClipUrl(videoId: string, fileName: string): string {
  return `/api/admin/videos/library/${videoId}/speech-audio?file=${encodeURIComponent(fileName)}`;
}

/** Every clip stored for one video, in speaking order. */
export async function listSpeechClips(bucket: SpeechAudioBucket, videoId: string): Promise<StoredSpeechClip[]> {
  const clips: StoredSpeechClip[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: `${PREFIX}/${videoId}/`, cursor });
    for (const object of page.objects) {
      const fileName = object.key.slice(object.key.lastIndexOf("/") + 1);
      if (isSpeechClipName(fileName)) {
        clips.push({ fileName, size: object.size, url: speechClipUrl(videoId, fileName) });
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return clips.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

/** Removes every clip of one video — a new split replaces the old one whole. */
export async function deleteSpeechClips(bucket: SpeechAudioBucket, videoId: string): Promise<number> {
  const clips = await listSpeechClips(bucket, videoId);
  if (clips.length > 0) await bucket.delete(clips.map((clip) => speechClipKey(videoId, clip.fileName)));
  return clips.length;
}
