import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import {
  SlowSpreadButton,
  VideoWatchPage,
  parseVideoWatchSlug,
  videoWatchSlug,
  type VideoType,
} from "debate-videos"
import { CategoryDock } from "@/components/layout/CategoryDock"
import { getRelatedVideos, getVideoById } from "@/lib/videos/video-repository"

/**
 * One video at its own address: `/videos/watch/<title-slug>-<videoId>`.
 *
 * The slug's title half is for readers and for search engines; only the
 * 11-character id at the end identifies the video, so a retitled video keeps
 * answering on links that are already out in the world. `/videos/[category]`
 * is a single segment and never collides with this two-segment path.
 *
 * Rendered on the server so the title, description and social card come from
 * the video itself rather than from a client fetch that a crawler never waits
 * for.
 */

interface PageProps {
  params: Promise<{ slug: string }>
}

/** How many videos the "Related videos" row under the player asks for. */
const RELATED_VIDEO_COUNT = 12

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const videoId = parseVideoWatchSlug(slug)
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
    // The canonical slug is rebuilt from the current title, so a video that
    // has been retitled since a link was shared does not leave two indexable
    // URLs for the same page.
    alternates: { canonical: `/videos/watch/${videoWatchSlug(title, id)}` },
    openGraph: {
      title,
      description: summary,
      type: "video.other",
      images: [`https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
    },
  }
}

export default async function WatchVideoPage({ params }: PageProps) {
  const { slug } = await params
  const videoId = parseVideoWatchSlug(slug)
  if (!videoId) notFound()

  const video = (await getVideoById(videoId)) as VideoType | null
  if (!video) notFound()

  const related = (await getRelatedVideos(video, RELATED_VIDEO_COUNT)) as VideoType[]

  return (
    <Suspense>
      <VideoWatchPage
        video={video}
        related={related}
        dockSlot={<CategoryDock embedded />}
        extraControls={<SlowSpreadButton size="md" />}
      />
    </Suspense>
  )
}
