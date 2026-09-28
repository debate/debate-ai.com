import type { Metadata } from "next"
import { VideoRoutePage, videoRouteMetadata } from "../../../../_watch/video-route-page"

/**
 * A debate round at `/videos/<season>/<tournament>/<round>/<teams>`, e.g.
 * `/videos/2022/ndt/finals/dartmouth-sv-vs-michigan-pr`.
 *
 * The router names the segments by position (see
 * `app/videos/_watch/video-route-page.tsx`): `category` is the season,
 * `event` the tournament and `matchup` the round.
 */

interface PageProps {
  params: Promise<{ category: string; event: string; matchup: string; teams: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, event, matchup, teams } = await params
  return videoRouteMetadata([category, event, matchup, teams])
}

export default async function WatchRoundPage({ params }: PageProps) {
  const { category: season, event: tournament, matchup: round, teams } = await params
  return <VideoRoutePage segments={[season, tournament, round, teams]} />
}
