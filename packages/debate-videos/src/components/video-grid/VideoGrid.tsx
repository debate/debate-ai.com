/**
 * @fileoverview Standard video grid component for displaying video cards.
 *
 * Cards are laid out one per *slot* rather than one per video: a stacked
 * playlist (a round and the analysis of it, say) folds its members into the
 * slot the first of them occupies and is flipped through in place with the
 * `<` / `>` arrows on the card. See `video-stacks.ts` for the collapsing rule
 * and `StackedVideoCard` for the card itself.
 *
 * The slots are drawn in chunks of {@link GRID_CHUNK_SIZE}, each its own grid
 * row block, and a chunk away from the viewport drops its cards (see
 * `WindowedChunk`). The feed keeps loading pages on its own, so this is what
 * keeps a category with thousands of videos responsive.
 */

"use client"

import React, { memo } from "react"
import type { VideoType, TopicType } from "../../types/videos"
import { StackedVideoCard } from "../video-card/StackedVideoCard"
import { HoverCardWrapper } from "../../ui/primitives/hover-card-wrapper"
import { buildVideoSlots, type VideoStackMap } from "./video-stacks"
import { WindowedChunk } from "./WindowedChunk"

/**
 * Slots per windowed chunk. 60 divides evenly into every column count the
 * grid uses (1–5), so only the last chunk can end on a partial row.
 */
export const GRID_CHUNK_SIZE = 60

/** Grid classes shared by every chunk, so the chunks line up as one grid. */
const GRID_CLASSES =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6"

/** Rough card height plus gap, for a chunk that has never been measured. */
const ESTIMATED_ROW_HEIGHT = 380

/** Columns the grid has at the current window width, matching {@link GRID_CLASSES}. */
function currentColumnCount(): number {
  if (typeof window === "undefined") return 1
  const width = window.innerWidth
  if (width >= 1536) return 5
  if (width >= 1280) return 4
  if (width >= 1024) return 3
  if (width >= 640) return 2
  return 1
}

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

  const chunks = React.useMemo(() => {
    const result: (typeof slots)[] = []
    for (let i = 0; i < slots.length; i += GRID_CHUNK_SIZE) {
      result.push(slots.slice(i, i + GRID_CHUNK_SIZE))
    }
    return result
  }, [slots])
  const estimatedHeight = Math.ceil(GRID_CHUNK_SIZE / currentColumnCount()) * ESTIMATED_ROW_HEIGHT

  return (
    <div ref={videoContainerRef} className="flex flex-col gap-3 sm:gap-6">
      {chunks.map((chunk, index) => (
        <WindowedChunk
          key={index}
          initiallyMounted={index === 0}
          estimatedHeight={estimatedHeight}
          className={GRID_CLASSES}
        >
          {chunk.map((slot) => (
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
        </WindowedChunk>
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
