import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { videoRouteHref, type VideoType } from "debate-videos"
import { getVideoBySlug } from "@/lib/videos/video-repository"

/**
 * The watch page's address, `/videos/watch/<title-slug>`,
 * kept as a redirect to the canonical one.
 *
 * Every one of these links is somewhere out in the world — in a coach's
 * shared doc, in a Discord message, in a search index — and the slug
 * still resolves the video, so none of them has to break. What they get now
 * is a permanent redirect to `/videos/<season>/<format-tournament>/<matchup>`,
 * which is where the page itself lives; see
 * `app/videos/[category]/[event]/[matchup]/page.tsx`.
 *
 * A slug naming a video the library no longer holds still 404s here.
 */

interface PageProps {
  params: Promise<{ slug: string }>
}

/** Resolves the video this slug names, or `null`. */
async function videoForSlug(slug: string): Promise<VideoType | null> {
  return (await getVideoBySlug(slug)) as VideoType | null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const video = await videoForSlug(slug)

  // The page redirects, so this metadata is only ever read by a crawler that
  // does not follow it. Point it at the canonical address either way.
  if (!video) return { title: "Video not found", robots: { index: false, follow: false } }
  return {
    title: `${video[1]} — Watch with transcript`,
    alternates: { canonical: videoRouteHref(video) },
  }
}

export default async function LegacyWatchVideoPage({ params }: PageProps) {
  const { slug } = await params
  const video = await videoForSlug(slug)
  if (!video) notFound()

  permanentRedirect(videoRouteHref(video))
}
