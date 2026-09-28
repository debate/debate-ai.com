"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useParams, usePathname } from "next/navigation"
import {
  SlowSpreadButton,
  VideoWatchPage,
  getVideoIndexRows,
  queryVideoIndexStacks,
  refreshVideoIndex,
  stackKeyOf,
  videoRouteHref,
  type VideoType,
} from "debate-videos"
import { videoRowToTuple } from "debate-data-sync/src/videos/video-rows"

import { CategoryDock } from "../../components/layout/CategoryDock"
import { VideoStaffControls } from "../../components/videos/VideoStaffControls"

/**
 * A video's watch page outside Next.
 *
 * The web app resolves the video on the server, straight from D1
 * (`app/videos/_watch/video-route-page.tsx`). A host without the Worker
 * resolves it from the library the shell already keeps in this browser
 * (`VideoIndexPrefetcher` → `/api/videos/index`), matching the path the same
 * way: a video's canonical `videoRouteHref`. The related-videos row and the
 * side panel's documents are server lookups and are left out here.
 */
export default function VideoWatchRoute() {
  const pathname = usePathname()
  const params = useParams<{ slug?: string }>()
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
    if (!rows) return null
    for (const row of rows) {
      const tuple = videoRowToTuple(row) as VideoType
      if (videoRouteHref(tuple) === pathname) return tuple
      // The legacy `/videos/watch/<slug>-<id>` address ends in the id.
      if (params.slug && params.slug.endsWith(String(tuple[0]))) return tuple
    }
    return null
  }, [rows, pathname, params.slug])

  if (!rows) return <p className="p-8 text-center text-sm text-muted-foreground">Loading video…</p>
  if (!video) return <p className="p-8 text-center text-sm text-muted-foreground">Video not found.</p>

  const key = stackKeyOf(video)
  const stack = key ? (queryVideoIndexStacks([key])?.[key] ?? []) : []

  return (
    <Suspense>
      <VideoWatchPage
        video={video}
        stack={stack}
        dockSlot={<CategoryDock embedded />}
        extraControls={
          <>
            <SlowSpreadButton size="md" />
            <VideoStaffControls videoId={video[0] as string} />
          </>
        }
      />
    </Suspense>
  )
}
