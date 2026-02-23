/**
 * @fileoverview Video grid display component
 * @module components/debate/videos/components/VideoGrid
 */

import { Card, CardDescription } from "@/components/ui/card"
import Image from "next/image"
import { Calendar, Eye } from "lucide-react"

/**
 * Props for the VideoGrid component.
 */
interface VideoGridProps {
  /** Ordered list of video tuples to render. */
  videos: VideoType[]
  /** Whether thumbnail images should be displayed on each card. */
  showThumbnails: boolean
  /** Ref attached to the grid wrapper element for scroll targeting. */
  videoContainerRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Renders a responsive grid of video cards.
 *
 * @param props - Grid configuration and video data.
 * @param props.videos - The list of videos to display.
 * @param props.showThumbnails - Whether to show thumbnail images.
 * @param props.videoContainerRef - Ref forwarded to the grid container element.
 * @returns A grid element containing one VideoCard per video.
 */
export function VideoGrid({ videos, showThumbnails, videoContainerRef }: VideoGridProps) {
  return (
    <div
      ref={videoContainerRef}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      {videos.map((video) => (
        <VideoCard key={video[0]} video={video} showThumbnails={showThumbnails} />
      ))}
    </div>
  )
}

/**
 * Props for the VideoCard component.
 */
interface VideoCardProps {
  /** Video data tuple to display. */
  video: VideoType
  /** Whether to render the YouTube thumbnail image. */
  showThumbnails: boolean
}

/**
 * Renders a single linked video card with thumbnail, title, channel, and metadata.
 *
 * @param props - Card data and display options.
 * @param props.video - The video tuple to render.
 * @param props.showThumbnails - Whether to show the thumbnail image.
 * @returns An anchor element wrapping a Card with video details.
 */
function VideoCard({ video, showThumbnails }: VideoCardProps) {
  const [videoId, title, date, channel, viewCount, description] = video

  return (
    <a
      href={`https://www.youtube.com/watch?v=${videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full"
    >
      <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full cursor-pointer">
        {showThumbnails && (
          <div className="relative w-full pt-[56.25%] bg-muted">
            <Image
              src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          </div>
        )}

        <div className="p-4 flex-1 flex flex-col">
          <h3 className="text-lg font-semibold text-primary hover:underline line-clamp-2 mb-2">
            {title}
          </h3>

          <CardDescription className="text-sm text-muted-foreground mb-2">{channel}</CardDescription>

          <CardDescription className="text-xs line-clamp-2 mb-3 flex-1">{description}</CardDescription>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{new Date(date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>{viewCount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </Card>
    </a>
  )
}
