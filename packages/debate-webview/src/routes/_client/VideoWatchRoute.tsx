"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useParams, usePathname } from "next/navigation"
import {
  SlowSpreadButton,
  VideoWatchPage,
  getVideoIndexRows,
  parseSpeechRouteSuffix,
  queryVideoIndexStacks,
  refreshVideoIndex,
  stackKeyOf,
  videoRouteHref,
  type VideoType,
} from "@debate-ai/videos"
import { videoRowToTuple } from "@debate-ai/videos/src/data/video-rows"
import { featuredSpeechDocsTabs } from "@debate-ai/round/src/panels/featuredSpeechDocsTabs"

import { CategoryDock } from "../../components/layout/CategoryDock"
import { SidebarAccount } from "../../components/layout/app-sidebar/sidebar-account"
import { VideoStaffControls } from "@debate-ai/videos-admin/src/components/VideoStaffControls"

/**
 * A video's watch page outside Next.
 *
 * The web app resolves the video on the server, straight from D1
 * (`app/videos/_watch/video-route-page.tsx`). A host without the Worker
 * resolves it from the video library cached in this browser (fetched from
 * `/api/videos/index` if it isn't cached yet), matching the path the same
 * way: a video's canonical `videoRouteHref`. The related-videos row and the
 * side panel's documents are server lookups and are left out here.
 */
/** Whether `pathname` is `href` followed by a speech and view (`…/2ar/outcomes`). */
function isUnderVideoPath(pathname: string, href: string): boolean {
  if (!pathname.startsWith(`${href}/`)) return false
  return parseSpeechRouteSuffix(pathname.slice(href.length + 1).split("/")) !== null
}

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
    // A video whose address this is wins over one it reads as a speech under.
    let underAddress: VideoType | null = null
    for (const row of rows) {
      const tuple = videoRowToTuple(row) as VideoType
      const href = videoRouteHref(tuple)
      // The same address from before the format segment.
      const unformatted = videoRouteHref(tuple, "season", false)
      if (pathname === href || pathname === unformatted) return tuple
      if (!underAddress && (isUnderVideoPath(pathname, href) || isUnderVideoPath(pathname, unformatted))) {
        underAddress = tuple
      }
      // The legacy `/videos/watch/<slug>-<id>` address ends in the id.
      if (params.slug && params.slug.endsWith(String(tuple[0]))) return tuple
    }
    return underAddress
  }, [rows, pathname, params.slug])
  const videoId = video ? (video[0] as string) : null
  const sideTabs = useMemo(() => featuredSpeechDocsTabs(videoId), [videoId])

  if (!rows) return <p className="p-8 text-center text-sm text-muted-foreground">Loading video…</p>
  if (!video) return <p className="p-8 text-center text-sm text-muted-foreground">Video not found.</p>

  const key = stackKeyOf(video)
  const stack = key ? (queryVideoIndexStacks([key])?.[key] ?? []) : []

  return (
    <Suspense>
      <VideoWatchPage
        video={video}
        stack={stack}
        sideTabs={sideTabs}
        dockSlot={<CategoryDock embedded />}
        accountSlot={<SidebarAccount />}
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
