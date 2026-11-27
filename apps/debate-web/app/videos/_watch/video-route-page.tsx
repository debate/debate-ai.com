import type { Metadata } from "next"
import { Suspense, type ReactNode } from "react"
import { notFound, permanentRedirect, redirect } from "next/navigation"
import {
  SlowSpreadButton,
  VideoWatchPage,
  loadVideoTeamRanks,
  videoComputedTitle,
  stackKeyOf,
  videoPageTitle,
  videoRouteHref,
  type VideoType,
} from "@debate-ai/videos"
import { CategoryDock } from "@debate-ai/webview/components/layout/CategoryDock"
import { SidebarAccount } from "@debate-ai/webview/components/layout/app-sidebar/sidebar-account"
import { VideoStaffControls } from "@debate-ai/videos-admin/src/components/VideoStaffControls"
import { isDemoTuple } from "@debate-ai/videos/src/data/demo-style"
import { featuredSpeechDocsTabs } from "@debate-ai/round/src/panels/featuredSpeechDocsTabs"
import {
  getRelatedVideos,
  getVideoByRouteSegments,
  getVideoStacks,
  resolveVideoRoute,
} from "@/lib/videos/video-repository"
import { getVideoSidePanelContent } from "@/lib/videos/video-content"
import { videoListingPath } from "@/lib/redirects/video-listing"
import { videoRedirectTarget } from "@/lib/videos/video-redirect"

/**
 * One video at its canonical address, shared by every route shape:
 *
 * - `/<topic code>/<tournament>/<round>/<teams>` for a tagged round in a
 *   format that has topic codes, e.g. `/cpd22/ndt/finals/dartmouth-sv-michigan-pr`
 *   (`app/videos/code`, which hands the page the `/videos/…` segments it
 *   stands for, and the path that was actually requested);
 * - `/videos/<season>/<format>/<tournament>/<round>/<teams>` for the same
 *   round before topic codes, and for a round in any other format, e.g.
 *   `/videos/21-22/cpd/ndt/finals/dartmouth-sv-michigan-pr`; the first
 *   redirects to the short address;
 * - `.../<teams>/<variant>` for a video made from that round — its analysis,
 *   one part of a split upload — e.g. `.../dartmouth-sv-michigan-pr/part-2`;
 * - `/videos/<season>/<event>/<matchup>` for everything else (the event is
 *   `<format>/<tournament>` when the video has a format), and for round links
 *   shared before rounds got their own shape;
 * - any of those followed by the open speech and its view, e.g.
 *   `.../dartmouth-sv-michigan-pr/2ar/outcomes` (see `lib/speech-url` in
 *   `@debate-ai/videos`). Links that carried them as `?speech=2ar&tab=outcomes`
 *   redirect to that form.
 *
 * The router has a page for each depth from three segments
 * (`app/videos/[category]/[event]/[matchup]/page.tsx`) to five, and a
 * catch-all below that for the deeper ones; all of them land here.
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

/**
 * Page metadata for the video at these path segments.
 *
 * @param whenMissing - Metadata to use, in place of the noindex "not found"
 *   ones, when no video has the address.
 */
export async function videoRouteMetadata(segments: string[], whenMissing?: Metadata): Promise<Metadata> {
  const video = await videoForSegments(segments)

  if (!video) {
    return whenMissing ?? { title: "Video not found", robots: { index: false, follow: false } }
  }

  const [id, title, , channel, , description] = video
  const summary =
    description?.split("\n").filter(Boolean).slice(0, 2).join(" ").slice(0, 300) ||
    `Watch "${title}" from ${channel} with a synced transcript.`
  // A round is named by its stored computed title, else by its year,
  // tournament, level and teams (see `videoPageTitle`); anything else keeps
  // its own title.
  const pageTitle = videoComputedTitle(video) ?? videoPageTitle(video, await loadVideoTeamRanks(video))

  return {
    title: pageTitle === title ? `${title} — Watch with transcript` : pageTitle,
    description: summary,
    alternates: { canonical: videoRouteHref(video) },
    openGraph: {
      title: pageTitle,
      description: summary,
      type: "video.other",
      images: [`https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
    },
  }
}

/** A page's query string, as Next.js hands it over. */
export type VideoRouteSearchParams = Promise<Record<string, string | string[] | undefined>>

/** Renders the watch page for these path segments, or redirects to the canonical ones. */
export async function VideoRoutePage({
  segments,
  searchParams,
  requestedPath = `/videos/${segments.join("/")}`,
  onMissing,
}: {
  segments: string[]
  searchParams?: VideoRouteSearchParams
  /** The path the reader asked for, when it is not `/videos/<segments>`. */
  requestedPath?: string
  /** Rendered, instead of the not-found handling, when no video has the address. */
  onMissing?: () => ReactNode | Promise<ReactNode>
}) {
  const query = (await searchParams) ?? {}
  const match = await resolveVideoRoute(segments)
  if (!match) {
    if (onMissing) return onMissing()
    // `/videos/24-25/ld/<tournament>` reads as a video's address until no
    // video has it; then it was a trimmed one, asking for that listing.
    const listing = videoListingPath(`/videos/${segments.join("/")}`, "", { allowFormatTournament: true })
    if (listing) redirect(listing)
    notFound()
  }
  const video = match.video as unknown as VideoType

  // One address per video: a link built before a retitle, a tournament fix, a
  // team-name correction or topic codes still resolves, and is sent on to the
  // current one, carrying the speech and view it opened (from the path, or the
  // query string older links used) along.
  const redirectTo = videoRedirectTarget(video, match.suffix, query, requestedPath)
  if (redirectTo) permanentRedirect(redirectTo)

  const stackKey = stackKeyOf(video)
  const [related, sidePanel, stacks, titleRanks] = await Promise.all([
    getRelatedVideos(video, RELATED_VIDEO_COUNT) as Promise<VideoType[]>,
    getVideoSidePanelContent(video[0] as string),
    stackKey ? getVideoStacks([stackKey]) : null,
    loadVideoTeamRanks(video),
  ])
  const stack = stackKey ? ((stacks?.stacks[stackKey] ?? []) as VideoType[]) : []

  return (
    <Suspense>
      <VideoWatchPage
        video={video}
        titleRanks={titleRanks}
        related={related}
        stack={stack}
        documents={sidePanel.documents}
        links={sidePanel.links.map((link) => ({
          video: link.video as VideoType,
          relation: link.relation,
          note: link.note,
        }))}
        sideTabs={featuredSpeechDocsTabs(video[0] as string)}
        dockSlot={<CategoryDock embedded />}
        accountSlot={<SidebarAccount />}
        extraControls={
          <>
            <SlowSpreadButton size="md" />
            {/* Renders nothing unless the viewer is an admin or moderator. */}
            <VideoStaffControls videoId={video[0] as string} isDemo={isDemoTuple(video)} />
          </>
        }
      />
    </Suspense>
  )
}
