"use client"

import React from "react"
import type { VideoType, TopicType } from "@/lib/types/videos"
import { VideoCard } from "../video-card/VideoCard"
import { HoverCardWrapper } from "@/components/ui/hover-card-wrapper"
import { GlowingShadow } from "@/components/ui/glowing-shadow"

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
}

/**
 * VideoGrid with selective glowing effect - only applies to top pick videos
 * This creates a nice visual hierarchy where featured videos stand out
 */
export function VideoGridSelectiveGlow({ videos, showThumbnails, topics, videoContainerRef, favorites, onToggleFavorite, onBadgeClick, onHideVideo, onUnhideVideo, hiddenVideos, topPicks, showFullDate, showDescription }: VideoGridProps) {
  return (
    <div
      ref={videoContainerRef}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6"
    >
      {videos.map((video, index) => {
        const isTopPick = topPicks?.has(video[0]) || false
        const videoCard = (
          <VideoCard
            video={video}
            showThumbnails={showThumbnails}
            topics={topics}
            isFavorite={favorites.has(video[0])}
            onToggleFavorite={onToggleFavorite}
            onBadgeClick={onBadgeClick}
            onHideVideo={onHideVideo}
            onUnhideVideo={onUnhideVideo}
            isHidden={hiddenVideos.has(video[0])}
            isTopPick={isTopPick}
            showFullDate={showFullDate}
            showDescription={showDescription}
          />
        )

        // Apply glowing effect only to top picks
        return isTopPick ? (
          <GlowingShadow
            key={`${video[0]}-${index}`}
            cardRadius="0.75rem"
            animationSpeed="5s"
            glowIntensity={0.7}
          >
            {videoCard}
          </GlowingShadow>
        ) : (
          <HoverCardWrapper key={`${video[0]}-${index}`}>
            {videoCard}
          </HoverCardWrapper>
        )
      })}
    </div>
  )
}
