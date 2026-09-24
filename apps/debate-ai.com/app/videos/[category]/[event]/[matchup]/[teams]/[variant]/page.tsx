import type { Metadata } from "next"
import { VideoRoutePage, videoRouteMetadata } from "../../../../../_watch/video-route-page"

/**
 * A video made from a debate round, one segment below the round itself:
 * `/videos/<season>/<tournament>/<round>/<teams>/<variant>`, e.g.
 * `/videos/2022/ndt/finals/dartmouth-sv-michigan-pr/analysis` or
 * `.../emory-gs-kansas-ls/part-2`.
 *
 * The router names the segments by position (see
 * `app/videos/_watch/video-route-page.tsx`).
 */

interface PageProps {
  params: Promise<{ category: string; event: string; matchup: string; teams: string; variant: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, event, matchup, teams, variant } = await params
  return videoRouteMetadata([category, event, matchup, teams, variant])
}

export default async function WatchRoundVariantPage({ params }: PageProps) {
  const { category: season, event: tournament, matchup: round, teams, variant } = await params
  return <VideoRoutePage segments={[season, tournament, round, teams, variant]} />
}
