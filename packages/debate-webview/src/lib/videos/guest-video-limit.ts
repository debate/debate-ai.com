/**
 * @fileoverview How many videos a signed-out visitor may open before the app
 * asks them to sign in (`components/layout/GuestVideoLimitGate.tsx`).
 *
 * The count is of distinct videos, kept in this browser's `localStorage`:
 * re-opening a video the guest already watched never counts twice and is
 * never blocked, so the limit only stands in front of the eleventh new one.
 * It is a nudge, not access control — the embeds are public YouTube videos,
 * and a cleared cache starts the count over.
 *
 * @module lib/videos/guest-video-limit
 */

/** Distinct videos a guest may open before signing in. */
export const GUEST_VIDEO_LIMIT = 10

/** The `localStorage` key holding the ids of the videos a guest has opened. */
export const GUEST_VIDEOS_KEY = "guestVideosWatched"

/**
 * The video ids this browser has opened while signed out.
 *
 * Empty on a server render, when storage is refused, or when the stored value
 * is not a list of strings — the gate degrades to "let them watch", never to
 * a broken page.
 */
export function readGuestVideos(): string[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(GUEST_VIDEOS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []
  } catch {
    return []
  }
}

function writeGuestVideos(ids: string[]): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(GUEST_VIDEOS_KEY, JSON.stringify(ids))
  } catch {
    // Storage full or refused: the video still plays, it just isn't counted.
  }
}

/**
 * Counts a guest opening `videoId`, unless they are already at the limit.
 *
 * @param videoId - The video being opened.
 * @param limit - Distinct videos allowed; {@link GUEST_VIDEO_LIMIT} by default.
 * @returns `true` when the video may play (already counted, or under the
 *   limit and now counted), `false` when the guest has to sign in first.
 */
export function admitGuestVideo(videoId: string, limit: number = GUEST_VIDEO_LIMIT): boolean {
  const seen = readGuestVideos()
  if (seen.includes(videoId)) return true
  if (seen.length >= limit) return false
  writeGuestVideos([...seen, videoId])
  return true
}
