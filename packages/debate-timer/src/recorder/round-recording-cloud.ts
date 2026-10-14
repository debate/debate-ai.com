/**
 * @fileoverview Saves a joined round recording to the site's R2 bucket
 * through `/api/round-recordings` (apps/debate-ai.com): the MP3, its
 * captions, every webcam clip, and the manifest that ties them together.
 * Only called from the Join dialog's explicit save — the recorder itself
 * never uploads.
 *
 * @module recorder/round-recording-cloud
 */

import { clipKey, getMedia, listClips } from "./media-store"
import type { RoundRecordingManifest, RoundVideoClip } from "./round-recording"

export const ROUND_RECORDINGS_ENDPOINT = "/api/round-recordings"

/** A file name the API accepts: letters, digits, dot, dash and underscore. */
export function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "file"
}

/** Uploads one file of a round; returns its R2 key. */
export async function uploadRoundFile(
  roundId: string,
  name: string,
  body: Blob | string,
  contentType: string,
  endpoint = ROUND_RECORDINGS_ENDPOINT,
): Promise<string> {
  const url = `${endpoint}?roundId=${encodeURIComponent(roundId)}&name=${encodeURIComponent(safeFileName(name))}`
  const res = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body })
  const data = (await res.json().catch(() => ({}))) as { key?: string; error?: string }
  if (!res.ok || !data.key) throw new Error(data.error ?? `Upload failed (${res.status}).`)
  return data.key
}

/** The link that streams a stored file back (signed-in owner only). */
export function roundFileUrl(key: string, endpoint = ROUND_RECORDINGS_ENDPOINT): string {
  return `${endpoint}/file?key=${encodeURIComponent(key)}`
}

/**
 * Uploads the MP3, captions and this browser's webcam clips for the round's
 * speeches, then the manifest naming them all. Returns the manifest with
 * every remote key filled in.
 */
export async function uploadRoundRecording(
  manifest: RoundRecordingManifest,
  mp3: Blob,
  vtt: string | null,
  onProgress?: (fraction: number) => void,
): Promise<RoundRecordingManifest> {
  const { roundId } = manifest
  const keys = new Set(manifest.speeches.map((s) => s.key))
  const clips = listClips().filter((clip) => keys.has(clip.speechKey))
  const steps = 2 + (vtt ? 1 : 0) + clips.length
  let done = 0
  const tick = () => onProgress?.(++done / steps)

  const audio = await uploadRoundFile(roundId, "round.mp3", mp3, "audio/mpeg")
  tick()
  const captions = vtt ? await uploadRoundFile(roundId, "captions.vtt", vtt, "text/vtt") : undefined
  if (vtt) tick()

  const videos: RoundVideoClip[] = []
  for (const clip of clips) {
    const blob = await getMedia<Blob>(clipKey(clip.id))
    if (blob) {
      const remoteKey = await uploadRoundFile(
        roundId,
        `video-${clip.speechKey}-${clip.participant}.webm`,
        blob,
        blob.type || "video/webm",
      )
      videos.push({ id: clip.id, speechKey: clip.speechKey, participant: clip.participant, remoteKey })
    }
    tick()
  }

  const withRemote: RoundRecordingManifest = { ...manifest, videos, remote: { audio, captions } }
  const manifestKey = await uploadRoundFile(roundId, "manifest.json", JSON.stringify(withRemote), "application/json")
  tick()
  return { ...withRemote, remote: { ...withRemote.remote, manifest: manifestKey } }
}
