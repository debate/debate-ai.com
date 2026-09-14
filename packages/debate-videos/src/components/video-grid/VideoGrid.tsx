/**
 * @fileoverview Standard video grid component for displaying video cards
 */

"use client"

import React, { memo, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Link2 } from "lucide-react"
import type { VideoType, TopicType } from "../../types/videos"
import { VideoCard } from "../video-card/VideoCard"
import { HoverCardWrapper } from "../../ui/primitives/hover-card-wrapper"
import { ROUND_ANALYSIS_LINKS, linkedRoundVideoId } from "../../lib/round-analysis-links"

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
  /** Combine known full rounds and their analysis videos into one stack. */
  stackLinkedRounds?: boolean
}

function VideoGridComponent({ videos, showThumbnails, topics, videoContainerRef, favorites, onToggleFavorite, onBadgeClick, onHideVideo, onUnhideVideo, hiddenVideos, topPicks, showFullDate, showDescription, stackLinkedRounds = false }: VideoGridProps) {
  const [linkedVideos, setLinkedVideos] = useState<VideoType[]>([])
  const loadedIds = useMemo(() => new Set(videos.map((video) => video[0])), [videos])
  const missingRoundIds = useMemo(
    () => Object.entries(ROUND_ANALYSIS_LINKS)
      .filter(([analysisId, roundId]) => loadedIds.has(analysisId) && !loadedIds.has(roundId))
      .map(([, roundId]) => roundId),
    [loadedIds],
  )

  useEffect(() => {
    if (!stackLinkedRounds || missingRoundIds.length === 0) {
      setLinkedVideos([])
      return
    }
    const controller = new AbortController()
    void fetch(`/api/videos?ids=${encodeURIComponent(missingRoundIds.join(","))}&limit=${missingRoundIds.length}`,
      { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!controller.signal.aborted) setLinkedVideos(Array.isArray(data?.videos) ? data.videos : []) })
      .catch((error) => { if (error.name !== "AbortError") setLinkedVideos([]) })
    return () => controller.abort()
  }, [stackLinkedRounds, missingRoundIds])

  const displayedVideos = useMemo(() => {
    if (!stackLinkedRounds) return videos.map((video) => [video] as VideoType[])
    const available = new Map([...videos, ...linkedVideos].map((video) => [video[0], video]))
    const grouped = new Set<string>()
    return videos.map((video) => {
      if (grouped.has(video[0])) return []
      const otherId = linkedRoundVideoId(video[0])
      const other = otherId ? available.get(otherId) : undefined
      grouped.add(video[0])
      if (other) grouped.add(other[0])
      return other ? [video, other] : [video]
    }).filter((group) => group.length > 0)
  }, [videos, linkedVideos, stackLinkedRounds])

  return (
    <div
      ref={videoContainerRef}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6"
    >
      {displayedVideos.map((stack, index) => (
        <VideoStack key={`${stack[0][0]}-${index}`} videos={stack}>
          {(video) => <VideoCard
            video={video}
            showThumbnails={showThumbnails}
            topics={topics}
            isFavorite={favorites.has(video[0])}
            onToggleFavorite={onToggleFavorite}
            onBadgeClick={onBadgeClick}
            onHideVideo={onHideVideo}
            onUnhideVideo={onUnhideVideo}
            isHidden={hiddenVideos.has(video[0])}
            isTopPick={topPicks?.has(video[0]) || false}
            showFullDate={showFullDate}
            showDescription={showDescription}
          />}
        </VideoStack>
      ))}
    </div>
  )
}

function VideoStack({ videos, children }: { videos: VideoType[]; children: (video: VideoType) => React.ReactNode }) {
  const [activeIndex, setActiveIndex] = useState(0)
  useEffect(() => setActiveIndex(0), [videos])
  const stacked = videos.length > 1
  return <HoverCardWrapper>
    <div className="relative h-full">
      {children(videos[activeIndex])}
      {stacked && <div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-md bg-background/90 p-0.5 shadow-sm ring-1 ring-border backdrop-blur">
        <Link2 className="h-3.5 w-3.5 text-primary" aria-hidden />
        <button type="button" aria-label="Show previous linked video" className="rounded p-0.5 hover:bg-accent" onClick={() => setActiveIndex((activeIndex + videos.length - 1) % videos.length)}><ChevronLeft className="h-3.5 w-3.5" /></button>
        <span className="text-[10px] font-medium tabular-nums">{activeIndex + 1}/{videos.length}</span>
        <button type="button" aria-label="Show next linked video" className="rounded p-0.5 hover:bg-accent" onClick={() => setActiveIndex((activeIndex + 1) % videos.length)}><ChevronRight className="h-3.5 w-3.5" /></button>
      </div>}
    </div>
  </HoverCardWrapper>
}

/**
 * Memoised: the page above re-renders on every keystroke in the search box
 * and on every filter toggle, and the grid's own props (the loaded page of
 * videos, the favourite/hidden sets, the stable card callbacks) change far
 * less often than that.
 */
export const VideoGrid = memo(VideoGridComponent)
