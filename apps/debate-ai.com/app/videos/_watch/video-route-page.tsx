import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound, permanentRedirect } from "next/navigation"
import {
  SlowSpreadButton,
  VideoWatchPage,
  stackKeyOf,
  videoRouteHref,
  type VideoType,
} from "debate-videos"
import { CategoryDock } from "@/components/layout/CategoryDock"
import { VideoStaffControls } from "@/components/videos/VideoStaffControls"
import {
  getRelatedVideos,
  getVideoByRouteSegments,
  getVideoStacks,
} from "@/lib/videos/video-repository"
import { getVideoSidePanelContent } from "@/lib/videos/video-content"

/**
 * One video at its canonical address, shared by the three route shapes:
 *
 * - `/videos/<season>/<tournament>/<round>/<teams>` for a tagged round, e.g.
 *   `/videos/2022/ndt/finals/dartmouth-sv-michigan-pr`
 *   (`app/videos/[category]/[event]/[matchup]/[teams]/page.tsx`);
 * - `.../<teams>/<variant>` for a video made from that round — its analysis,
 *   one part of a split upload — e.g. `.../dartmouth-sv-michigan-pr/analysis`
 *   (`app/videos/[category]/[event]/[matchup]/[teams]/[variant]/page.tsx`);
 * - `/videos/<season>/<event>/<matchup>` for everything else, and for round
 *   links shared before rounds got their own shape
 *   (`app/videos/[category]/[event]/[matchup]/page.tsx`).
 *
 * The path is re-derived on every request, so a stale one — the older
 * three-segment round path, a corrected team name, a re-tagged tournament —
 * redirects to the current address instead of leaving two indexable URLs for
 * one video.
 *
 * ## Why the segments are named `category`, `event` and `matchup`
 *
 * Next.js requires one slug name per path position, and `/videos/[category]`
 * — the library's own category pages — already claims the first. The names
 * are the router's; what each segment holds depends on the route shape.
 */

/** How many videos the "Related videos" row under the player asks for. */
const RELATED_VIDEO_COUNT = 12

/** Resolves the video these path segments name, or `null`. */
async function videoForSegments(segments: string[]): Promise<VideoType | null> {
  return (await getVideoByRouteSegments(segments)) as VideoType | null
}

/** Page metadata for the video at these path segments. */
export async function videoRouteMetadata(segments: string[]): Promise<Metadata> {
  const video = await videoForSegments(segments)

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

/** Renders the watch page for these path segments, or redirects to the canonical ones. */
export async function VideoRoutePage({ segments }: { segments: string[] }) {
  const video = await videoForSegments(segments)
  if (!video) notFound()

  // One address per video: a link built before a retitle, a tournament fix or
  // a team-name correction still resolves, and is sent on to the current one.
  const canonical = videoRouteHref(video)
  const requested = `/videos/${segments.join("/")}`
  if (requested !== canonical) {
    permanentRedirect(canonical)
  }

  const stackKey = stackKeyOf(video)
  const [related, sidePanel, stacks] = await Promise.all([
    getRelatedVideos(video, RELATED_VIDEO_COUNT) as Promise<VideoType[]>,
    getVideoSidePanelContent(video[0] as string),
    stackKey ? getVideoStacks([stackKey]) : null,
  ])
  const stack = stackKey ? ((stacks?.stacks[stackKey] ?? []) as VideoType[]) : []

  return (
    <Suspense>
      <VideoWatchPage
        video={video}
        related={related}
        stack={stack}
        documents={sidePanel.documents}
        links={sidePanel.links.map((link) => ({
          video: link.video as VideoType,
          relation: link.relation,
          note: link.note,
        }))}
        dockSlot={<CategoryDock embedded />}
        extraControls={
          <>
            <SlowSpreadButton size="md" />
            {/* Renders nothing unless the viewer is an admin or moderator. */}
            <VideoStaffControls videoId={video[0] as string} />
          </>
        }
      />
    </Suspense>
  )
}
