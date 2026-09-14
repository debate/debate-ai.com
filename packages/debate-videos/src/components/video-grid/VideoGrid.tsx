/**
 * @fileoverview Standard video grid component for displaying video cards.
 *
 * Cards are laid out one per *slot* rather than one per video: a stacked
 * playlist (a round and the analysis of it, say) folds its members into the
 * slot the first of them occupies and is flipped through in place with the
 * `<` / `>` arrows on the card. See `video-stacks.ts` for the collapsing rule
 * and `StackedVideoCard` for the card itself.
 */

"use client"

import React, { memo } from "react"
import type { VideoType, TopicType } from "../../types/videos"
import { StackedVideoCard } from "../video-card/StackedVideoCard"
import { HoverCardWrapper } from "../../ui/primitives/hover-card-wrapper"
import { buildVideoSlots, type VideoStackMap } from "./video-stacks"

interface VideoGridProps {
  videos: VideoType[]
  showThumbnails: boolean
  topics?: TopicType[]
  videoContainerRef: React.RefObject<HTMLDivElement | null>
  favorites: Set<string>
  onToggleFavorite: (videoId: string) => void
  onBadgeClick: (text: string) => void
  onHideVideo: (videoId: string) => void
  onUnhideVideo: (videoId: string) => void
  hiddenVideos: Set<string>
  topPicks?: Set<string>
  showFullDate?: boolean
  showDescription?: boolean
  /** Members of the stacked playlists on screen, from `/api/videos/stacks`. */
  stacks?: VideoStackMap | null
  /** Whether stacking is on; `false` gives every video its own card. */
  stacksEnabled?: boolean
}

function VideoGridComponent({ videos, showThumbnails, topics, videoContainerRef, favorites, onToggleFavorite, onBadgeClick, onHideVideo, onUnhideVideo, hiddenVideos, topPicks, showFullDate, showDescription, stacks, stacksEnabled = true }: VideoGridProps) {
  const slots = React.useMemo(
    () => buildVideoSlots(videos, stacks, stacksEnabled),
    [videos, stacks, stacksEnabled],
  )

  return (
    <div
      ref={videoContainerRef}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6"
    >
      {slots.map((slot) => (
        <HoverCardWrapper key={slot.key}>
          <StackedVideoCard
            videos={slot.videos}
            initialIndex={slot.initialIndex}
            showThumbnails={showThumbnails}
            topics={topics}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            onBadgeClick={onBadgeClick}
            onHideVideo={onHideVideo}
            onUnhideVideo={onUnhideVideo}
            hiddenVideos={hiddenVideos}
            topPicks={topPicks}
            showFullDate={showFullDate}
            showDescription={showDescription}
          />
        </HoverCardWrapper>
      ))}
    </div>
  )
}

/**
 * Memoised: the page above re-renders on every keystroke in the search box
 * and on every filter toggle, and the grid's own props (the loaded page of
 * videos, the favourite/hidden sets, the stable card callbacks) change far
 * less often than that.
 */
export const VideoGrid = memo(VideoGridComponent)
