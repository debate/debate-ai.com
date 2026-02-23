/**
 * @fileoverview Video grid display component
 * @module components/debate/videos/components/VideoGrid
 */

import { Card, CardDescription } from "@/components/ui/card"
import Image from "next/image"
import { Calendar, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VideoType } from "../hooks/useVideoState"

interface VideoGridProps {
  videos: VideoType[]
  showThumbnails: boolean
  videoContainerRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Grid layout for video cards
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

interface VideoCardProps {
  video: VideoType
  showThumbnails: boolean
}

/**
 * Individual video card
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
