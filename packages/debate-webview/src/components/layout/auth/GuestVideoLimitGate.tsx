"use client"

/**
 * @fileoverview Asks a signed-out visitor to sign in once they have opened
 * {@link GUEST_VIDEO_LIMIT} distinct videos.
 *
 * Both players report what they are playing through the shared player store —
 * the floating popout as `activeVideoId`, the full-page watch player as
 * `theaterVideoId` — so watching the store here covers every way a video is
 * opened without touching either player. A video past the limit is paused
 * while the sign-in dialog is up; dismissing the dialog closes the popout or
 * leaves the watch page. Signing in returns to the same page, where the video
 * plays as usual.
 *
 * @module components/layout/auth/GuestVideoLimitGate
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { sendYouTubeCommand, useVideoPlayerStore } from "@debate-ai/videos"

import { LoginDialog } from "./LoginDialog"
import { useSession } from "../../../lib/hooks/useSession"
import { GUEST_VIDEO_LIMIT, admitGuestVideo } from "../../../lib/videos/guest-video-limit"

/** How often a blocked embed is told to pause again, in ms (it may still be loading, or autoplay). */
const PAUSE_INTERVAL_MS = 500

export function GuestVideoLimitGate() {
  const { isAuthenticated, isLoading } = useSession()
  const router = useRouter()
  const activeVideoId = useVideoPlayerStore((state) => state.activeVideoId)
  const theaterVideoId = useVideoPlayerStore((state) => state.theaterVideoId)
  const clearActiveVideo = useVideoPlayerStore((state) => state.clearActiveVideo)
  const [blockedVideoId, setBlockedVideoId] = useState<string | null>(null)

  useEffect(() => {
    // Wait for the session: a signed-in user's views never count.
    if (isLoading) return
    if (isAuthenticated) {
      setBlockedVideoId(null)
      return
    }
    for (const videoId of [theaterVideoId, activeVideoId]) {
      if (videoId && !admitGuestVideo(videoId)) {
        setBlockedVideoId(videoId)
        return
      }
    }
  }, [activeVideoId, theaterVideoId, isAuthenticated, isLoading])

  useEffect(() => {
    if (!blockedVideoId) return
    sendYouTubeCommand("pauseVideo")
    const timer = setInterval(() => sendYouTubeCommand("pauseVideo"), PAUSE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [blockedVideoId])

  if (!blockedVideoId) return null

  return (
    <LoginDialog
      open
      onOpenChange={(open) => {
        if (open) return
        // `LoginDialog` closes itself once a session lands; that is the
        // guest signing in, not declining, so the video keeps playing.
        if (isAuthenticated) {
          setBlockedVideoId(null)
          return
        }
        const onWatchPage = useVideoPlayerStore.getState().theaterVideoId === blockedVideoId
        setBlockedVideoId(null)
        clearActiveVideo()
        if (onWatchPage) router.push("/videos")
      }}
      title="Sign in to keep watching"
      description={`You've watched ${GUEST_VIDEO_LIMIT} videos as a guest. Sign in for free to keep watching rounds and lectures.`}
    />
  )
}

export default GuestVideoLimitGate
