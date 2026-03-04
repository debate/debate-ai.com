/**
 * @fileoverview Video grid display component
 * @module components/debate/videos/components/VideoGrid
 */

import { Card, CardDescription } from "@/components/ui/card"
import { useState } from "react"
import Image from "next/image"
import { Calendar, Eye, Star } from "lucide-react"

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
  /** Set of favorited video IDs. */
  favorites: Set<string>
  /** Callback to toggle a video as favorite. */
  onToggleFavorite: (videoId: string) => void
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
export function VideoGrid({ videos, showThumbnails, videoContainerRef, favorites, onToggleFavorite }: VideoGridProps) {
  return (
    <div
      ref={videoContainerRef}
      className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6"
    >
      {videos.map((video, index) => (
        <VideoCard
          key={`${video[0]}-${index}`}
          video={video}
          showThumbnails={showThumbnails}
          isFavorite={favorites.has(video[0])}
          onToggleFavorite={onToggleFavorite}
        />
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
  /** Whether this video is marked as favorite. */
  isFavorite: boolean
  /** Callback to toggle this video as favorite. */
  onToggleFavorite: (videoId: string) => void
}

/**
 * Renders a single linked video card with thumbnail, title, channel, and metadata.
 *
 * @param props - Card data and display options.
 * @param props.video - The video tuple to render.
 * @param props.showThumbnails - Whether to show the thumbnail image.
 * @returns An anchor element wrapping a Card with video details.
 */
function VideoCard({ video, showThumbnails, isFavorite, onToggleFavorite }: VideoCardProps) {
  const [videoId, title, date, channel, viewCount, description] = video
  const [isPlaying, setIsPlaying] = useState(false)

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

  return (
    <div className="block h-full relative group/card">
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleFavorite(videoId)
        }}
        className={`absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors opacity-0 group-hover/card:opacity-100 focus:opacity-100 ${isFavorite ? "opacity-100 text-amber-400" : "text-white"}`}
        title={isFavorite ? "Remove from favorites" : "Save to favorites"}
      >
        <Star className={`h-5 w-5 ${isFavorite ? "fill-current text-amber-400" : ""}`} />
      </button>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full relative">
        {showThumbnails && (
          <div
            className="relative w-full pt-[56.25%] bg-muted cursor-pointer"
            onClick={() => !isPlaying && setIsPlaying(true)}
          >
            {isPlaying ? (
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                title={title}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <Image
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt={title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            )}
          </div>
        )}

        <div className="p-4 flex-1 flex flex-col">
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-lg font-semibold text-primary hover:underline line-clamp-2 mb-2"
          >
            {title}
          </a>

          <CardDescription className="text-sm text-muted-foreground mb-2">{channel}</CardDescription>

          <CardDescription className="text-xs line-clamp-2 mb-3 flex-1">{description}</CardDescription>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>{viewCount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
