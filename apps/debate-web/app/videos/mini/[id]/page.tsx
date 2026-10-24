import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { VideoMiniPlayer, parseMiniPlayerStart, type VideoType } from "@debate-ai/videos"
import { getVideoById } from "@/lib/videos/video-repository"
import { getVideoDocuments } from "@/lib/videos/video-content"

/**
 * `/videos/mini/<videoId>?t=<seconds>` — the page the mini player window
 * loads: one video and its speech switcher, sized for a small window the
 * desktop app can keep on top of other apps. The watch page's "Pop out mini
 * player" control opens it; see `@debate-ai/videos`' `lib/mini-player-window.ts`.
 *
 * The app shell draws no chrome around this route (see `AppShell`), and it is
 * never indexed: the canonical watch page is the video's real address.
 */

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ t?: string | string[] }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const video = (await getVideoById(id)) as VideoType | null
  return {
    title: video ? `${video[1]} — Mini player` : "Video not found",
    robots: { index: false, follow: false },
  }
}

export default async function MiniPlayerPage({ params, searchParams }: PageProps) {
  const [{ id }, { t }] = await Promise.all([params, searchParams])
  const video = (await getVideoById(id)) as VideoType | null
  if (!video) notFound()

  const documents = await getVideoDocuments(video[0] as string)
  return (
    <VideoMiniPlayer
      video={video}
      documents={documents}
      startSeconds={parseMiniPlayerStart(Array.isArray(t) ? t[0] : t)}
    />
  )
}
