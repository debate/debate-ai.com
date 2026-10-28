"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  VideoMiniPlayer,
  getVideoIndexRows,
  parseMiniPlayerStart,
  refreshVideoIndex,
  type VideoType,
} from "@debate-ai/videos"
import { videoRowToTuple } from "@debate-ai/videos/src/data/video-rows"

/**
 * The mini player window's page (`/videos/mini/<videoId>`) outside Next.
 *
 * The web app resolves the video and its documents on the server
 * (`app/videos/mini/[id]/page.tsx`). A host without the Worker finds the
 * video by id in the library cached in this browser, the way
 * `VideoWatchRoute` does; the documents are a server lookup and are left
 * out, so the speech strip shows the format's standard speeches.
 */
export default function VideoMiniRoute() {
  const params = useParams<{ id?: string }>()
  const [rows, setRows] = useState(() => getVideoIndexRows())

  useEffect(() => {
    if (rows) return
    let cancelled = false
    void refreshVideoIndex().then(() => !cancelled && setRows(getVideoIndexRows()))
    return () => {
      cancelled = true
    }
  }, [rows])

  const video = useMemo<VideoType | null>(() => {
    if (!rows || !params.id) return null
    for (const row of rows) {
      const tuple = videoRowToTuple(row) as VideoType
      if (tuple[0] === params.id) return tuple
    }
    return null
  }, [rows, params.id])

  const startSeconds = useMemo(
    () => (typeof window === "undefined" ? 0 : parseMiniPlayerStart(new URLSearchParams(window.location.search).get("t"))),
    [],
  )

  if (!rows) return <p className="p-4 text-center text-sm text-muted-foreground">Loading video…</p>
  if (!video) return <p className="p-4 text-center text-sm text-muted-foreground">Video not found.</p>

  return <VideoMiniPlayer video={video} startSeconds={startSeconds} />
}
