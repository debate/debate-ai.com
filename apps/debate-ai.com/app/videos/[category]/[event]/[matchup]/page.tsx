import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound, permanentRedirect } from "next/navigation"
import {
  SlowSpreadButton,
  VideoWatchPage,
  isCanonicalVideoRoute,
  parseVideoRouteMatchup,
  videoRouteHref,
  videoRouteParts,
  type VideoType,
} from "debate-videos"
import { CategoryDock } from "@/components/layout/CategoryDock"
import { getRelatedVideos, getVideoById } from "@/lib/videos/video-repository"
import { getVideoSidePanelContent } from "@/lib/videos/video-content"

/**
 * One video at its canonical address:
 * `/videos/<season>/<format-tournament>/<matchup>-<videoId>`, e.g.
 * `/videos/2006/college-ndt/northwestern-vs-michigan-state-finals-dQw4w9WgXcQ`.
 *
 * The three segments are coarse-to-fine, which is what the old flat
 * `/videos/watch/<title-slug>` could never be: the season, then the format
 * and tournament, then who debated and which round. Only the trailing
 * 11-character id resolves the video — everything before it is for readers
 * and for search engines, and is re-derived on every request so a corrected
 * team name or a re-tagged tournament redirects to the current address
 * instead of leaving two indexable URLs for one video.
 *
 * ## Why the first segment is called `category`
 *
 * Next.js requires one slug name per path position, and `/videos/[category]`
 * — the library's own category pages — already claims it. The segment here
 * holds a season (`2006`), not a category; the name is the router's, not
 * this page's.
 */

interface PageProps {
  params: Promise<{ category: string; event: string; matchup: string }>
}

/** How many videos the "Related videos" row under the player asks for. */
const RELATED_VIDEO_COUNT = 12

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { matchup } = await params
  const videoId = parseVideoRouteMatchup(matchup)
  const video = videoId ? ((await getVideoById(videoId)) as VideoType | null) : null

  if (!video) {
    return { title: "Video not found", robots: { index: false, follow: false } }
  }

  const [id, title, , channel, , description] = video
  const summary =
    description?.split("\n").filter(Boolean).slice(0, 2).join(" ").slice(0, 300) ||
    `Watch "${title}" from ${channel} with a synced transcript.`

  return {
    title: `${title} — Watch with transcript`,
    description: summary,
    alternates: { canonical: videoRouteHref(video) },
    openGraph: {
      title,
      description: summary,
      type: "video.other",
      images: [`https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
    },
  }
}

export default async function WatchVideoPage({ params }: PageProps) {
  const { category: season, event, matchup } = await params

  const videoId = parseVideoRouteMatchup(matchup)
  if (!videoId) notFound()

  const video = (await getVideoById(videoId)) as VideoType | null
  if (!video) notFound()

  // One address per video: a link built before a retitle, a tournament fix or
  // a team-name correction still resolves, and is sent on to the current one.
  if (!isCanonicalVideoRoute(videoRouteParts(video), { season, event, matchup })) {
    permanentRedirect(videoRouteHref(video))
  }

  const [related, sidePanel] = await Promise.all([
    getRelatedVideos(video, RELATED_VIDEO_COUNT) as Promise<VideoType[]>,
    getVideoSidePanelContent(videoId),
  ])

  return (
    <Suspense>
      <VideoWatchPage
        video={video}
        related={related}
        documents={sidePanel.documents}
        links={sidePanel.links.map((link) => ({
          video: link.video as VideoType,
          relation: link.relation,
          note: link.note,
        }))}
        dockSlot={<CategoryDock embedded />}
        extraControls={<SlowSpreadButton size="md" />}
      />
    </Suspense>
  )
}
