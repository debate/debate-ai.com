/**
 * @fileoverview One grid slot holding a stacked playlist.
 *
 * Renders the member currently selected as an ordinary {@link VideoCard} — so
 * every card in the grid is the same card, with the same actions — and lays
 * the flip control over its top-left corner. A slot with a single video skips
 * the control entirely, which is what a standalone video renders as.
 * @module components/video-card/StackedVideoCard
 */

"use client"

import { useState } from "react"
import type { TopicType, VideoType } from "../../types/videos"
import { VideoCard } from "./VideoCard"
import { StackNav, stackMemberLabel } from "./StackNav"

/** Props for the {@link StackedVideoCard} component. */
export interface StackedVideoCardProps {
  /** The stack's members, primary first; a one-entry list is a plain card. */
  videos: VideoType[]
  /** Which member to open on — the one the feed itself returned. */
  initialIndex?: number
  showThumbnails: boolean
  topics?: TopicType[]
  favorites: Set<string>
  onToggleFavorite: (videoId: string) => void
  onBadgeClick: (text: string) => void
  onHideVideo: (videoId: string) => void
  onUnhideVideo: (videoId: string) => void
  hiddenVideos: Set<string>
  topPicks?: Set<string>
  showFullDate?: boolean
  showDescription?: boolean
}

/**
 * A card the user can flip between the videos of one stacked playlist.
 *
 * @param props - See {@link StackedVideoCardProps}.
 */
export function StackedVideoCard({
  videos,
  initialIndex = 0,
  showThumbnails,
  topics,
  favorites,
  onToggleFavorite,
  onBadgeClick,
  onHideVideo,
  onUnhideVideo,
  hiddenVideos,
  topPicks,
  showFullDate,
  showDescription,
}: StackedVideoCardProps) {
  const [index, setIndex] = useState(initialIndex)
  // A feed page can shrink a stack under this index (a member hidden, a
  // filter change); clamp rather than render nothing.
  const active = videos[Math.min(index, videos.length - 1)] ?? videos[0]

  return (
    <div className="relative h-full">
      {videos.length > 1 && (
        <StackNav
          index={videos.indexOf(active)}
          count={videos.length}
          label={stackMemberLabel(active)}
          onSelect={setIndex}
          className="absolute left-1.5 top-1.5 z-20"
        />
      )}

      <VideoCard
        video={active}
        showThumbnails={showThumbnails}
        topics={topics}
        isFavorite={favorites.has(active[0])}
        onToggleFavorite={onToggleFavorite}
        onBadgeClick={onBadgeClick}
        onHideVideo={onHideVideo}
        onUnhideVideo={onUnhideVideo}
        isHidden={hiddenVideos.has(active[0])}
        isTopPick={topPicks?.has(active[0]) || false}
        showFullDate={showFullDate}
        showDescription={showDescription}
      />
    </div>
  )
}
