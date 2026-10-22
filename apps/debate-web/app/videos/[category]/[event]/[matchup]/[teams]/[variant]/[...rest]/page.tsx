import type { Metadata } from "next"
import { VideoRoutePage, videoRouteMetadata, type VideoRouteSearchParams } from "../../../../../../_watch/video-route-page"

/**
 * Every watch address deeper than five segments: a round's variant
 * (`/videos/<season>/<format>/<tournament>/<round>/<teams>/<variant>`), and
 * any video's address followed by the open speech and its view
 * (`.../<teams>/2ar/outcomes`).
 *
 * The router names the segments by position (see
 * `app/videos/_watch/video-route-page.tsx`).
 */

interface PageProps {
  params: Promise<{
    category: string
    event: string
    matchup: string
    teams: string
    variant: string
    rest: string[]
  }>
  searchParams: VideoRouteSearchParams
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, event, matchup, teams, variant, rest } = await params
  return videoRouteMetadata([category, event, matchup, teams, variant, ...rest])
}

export default async function WatchDeepVideoPage({ params, searchParams }: PageProps) {
  const { category, event, matchup, teams, variant, rest } = await params
  return (
    <VideoRoutePage segments={[category, event, matchup, teams, variant, ...rest]} searchParams={searchParams} />
  )
}
