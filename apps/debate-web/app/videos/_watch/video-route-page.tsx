import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound, permanentRedirect, redirect } from "next/navigation"
import {
  SPEECH_PARAM,
  SPEECH_VIEW_PARAM,
  SlowSpreadButton,
  VideoWatchPage,
  loadVideoTeamRanks,
  parseSpeechRouteSuffix,
  speechRouteSuffix,
  stackKeyOf,
  videoPageTitle,
  videoRouteHref,
  type VideoType,
} from "@debate-ai/videos"
import { CategoryDock } from "@debate-ai/webview/components/layout/CategoryDock"
import { SidebarAccount } from "@debate-ai/webview/components/layout/app-sidebar/sidebar-account"
import { VideoStaffControls } from "@debate-ai/videos-admin/src/components/VideoStaffControls"
import { featuredSpeechDocsTabs } from "@debate-ai/round/src/panels/featuredSpeechDocsTabs"
import {
  getRelatedVideos,
  getVideoByRouteSegments,
  getVideoStacks,
  resolveVideoRoute,
} from "@/lib/videos/video-repository"
import { getVideoSidePanelContent } from "@/lib/videos/video-content"
import { videoListingPath } from "@/lib/redirects/video-listing"

/**
 * One video at its canonical address, shared by every route shape:
 *
 * - `/videos/<season>/<format>/<tournament>/<round>/<teams>` for a tagged
 *   round, e.g. `/videos/21-22/cpd/ndt/finals/dartmouth-sv-michigan-pr`;
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
  // A round is named by its year, tournament, level and teams (see
  // `videoPageTitle`); anything else keeps its own title.
  const pageTitle = videoPageTitle(video, await loadVideoTeamRanks(video))

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

/** The first value of a query parameter. */
function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null
}

/** Renders the watch page for these path segments, or redirects to the canonical ones. */
export async function VideoRoutePage({
  segments,
  searchParams,
}: {
  segments: string[]
  searchParams?: VideoRouteSearchParams
}) {
  const query = (await searchParams) ?? {}
  const match = await resolveVideoRoute(segments)
  if (!match) {
    // `/videos/24-25/ld/<tournament>` reads as a video's address until no
    // video has it; then it was a trimmed one, asking for that listing.
    const listing = videoListingPath(`/videos/${segments.join("/")}`, "", { allowFormatTournament: true })
    if (listing) redirect(listing)
    notFound()
  }
  const video = match.video as unknown as VideoType

  // One address per video: a link built before a retitle, a tournament fix or
  // a team-name correction still resolves, and is sent on to the current one,
  // carrying the speech and view it opened (from the path, or the query
  // string older links used) along.
  const fromPath = parseSpeechRouteSuffix(match.suffix)
  const speech = firstParam(query[SPEECH_PARAM]) ?? fromPath?.speech
  const tab = firstParam(query[SPEECH_VIEW_PARAM]) ?? fromPath?.tab
  const canonical = `${videoRouteHref(video)}${speechRouteSuffix(speech, tab)}`
  const requested = `/videos/${segments.join("/")}`
  const hasLegacyQuery = SPEECH_PARAM in query || SPEECH_VIEW_PARAM in query
  if (requested !== canonical || hasLegacyQuery) {
    const rest = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (key === SPEECH_PARAM || key === SPEECH_VIEW_PARAM || value === undefined) continue
      for (const item of Array.isArray(value) ? value : [value]) rest.append(key, item)
    }
    const search = rest.toString()
    permanentRedirect(search ? `${canonical}?${search}` : canonical)
  }

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
            <VideoStaffControls videoId={video[0] as string} />
          </>
        }
      />
    </Suspense>
  )
}
