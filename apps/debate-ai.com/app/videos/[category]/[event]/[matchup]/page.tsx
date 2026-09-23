import type { Metadata } from "next"
import { VideoRoutePage, videoRouteMetadata } from "../../../_watch/video-route-page"

/**
 * A video at `/videos/<season>/<event>/<matchup>`, e.g.
 * `/videos/2019/kritik-critical-theory/how-to-give-a-2nr`.
 *
 * Lectures and untagged rounds live here. A tagged round's older address in
 * this shape (`/videos/2022/college-ndt/dartmouth-sv-vs-michigan-pr-finals`)
 * still resolves and redirects to its four-segment one; see
 * `app/videos/_watch/video-route-page.tsx`.
 */

interface PageProps {
  params: Promise<{ category: string; event: string; matchup: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, event, matchup } = await params
  return videoRouteMetadata([category, event, matchup])
}

export default async function WatchVideoPage({ params }: PageProps) {
  const { category: season, event, matchup } = await params
  return <VideoRoutePage segments={[season, event, matchup]} />
}
