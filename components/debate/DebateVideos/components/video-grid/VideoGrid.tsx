"use client"

import React from "react"
import type { VideoType, TopicType } from "@/lib/types/videos"
import { VideoCard } from "../video-card/VideoCard"
import { HoverCardWrapper } from "@/components/ui/hover-card-wrapper"

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
}

export function VideoGrid({ videos, showThumbnails, topics, videoContainerRef, favorites, onToggleFavorite, onBadgeClick, onHideVideo, onUnhideVideo, hiddenVideos, topPicks }: VideoGridProps) {
  return (
    <div
      ref={videoContainerRef}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6"
    >
      {videos.map((video, index) => (
        <HoverCardWrapper key={`${video[0]}-${index}`}>
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
            isTopPick={topPicks?.has(video[0]) || false}
          />
        </HoverCardWrapper>
      ))}
    </div>
  )
}