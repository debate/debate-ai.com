/**
 * @fileoverview Video card displaying debate video metadata, thumbnail, and action buttons.
 * @module components/debate/DebateVideos/components/video-card/VideoCard
 */

"use client"

import { Card } from "@/components/ui/card"
import { GlowingEffect } from "@/components/ui/glowing-effect"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useVideoPlayerStore } from "@/lib/state/videoPlayerStore"
import { getYearTopic } from "./videoCardUtils"
import { VideoCardThumbnail } from "./VideoCardThumbnail"
import { VideoCardActions } from "./VideoCardActions"
import type { TopicType, VideoType } from "@/lib/types/videos"

/** Props for the {@link VideoCard} component. */
export interface VideoCardProps {
  /** Tuple of video data fields; see {@link VideoType} for the full index map. */
  video: VideoType
  /** Whether to show the YouTube thumbnail above the action row. */
  showThumbnails: boolean
  /** Topic list used to resolve the year-topic text for the "T" tooltip button. */
  topics?: TopicType[]
  /** Whether this video is bookmarked as a favourite. */
  isFavorite: boolean
  /** Callback invoked with `videoId` to toggle the favourite state. */
  onToggleFavorite: (videoId: string) => void
  /** Callback invoked with badge text when the date/channel badge is clicked. */
  onBadgeClick: (text: string) => void
  /** Callback invoked with `videoId` when the user confirms hiding a video. */
  onHideVideo: (videoId: string) => void
  /** Callback invoked with `videoId` to un-hide a previously hidden video. */
  onUnhideVideo: (videoId: string) => void
  /** Whether this video is currently hidden (dims the card and shows "Hidden" badge). */
  isHidden: boolean
  /** Whether this card is marked as a top pick (shows medal badge on thumbnail). */
  isTopPick: boolean
  /** When `true` shows the full long date in the action row; otherwise abbreviated month. */
  showFullDate?: boolean
  /** When `true` renders a description text block below the action row. */
  showDescription?: boolean
}

/**
 * Video card composing a thumbnail overlay and an action/metadata row.
 *
 * Delegates thumbnail rendering to {@link VideoCardThumbnail} and all action
 * buttons to {@link VideoCardActions}. The card itself only manages the play
 * state ring and the hidden-video visual treatment.
 *
 * @param props - See {@link VideoCardProps}.
 */
export function VideoCard({
  video,
  showThumbnails,
  topics,
  isFavorite,
  onToggleFavorite,
  onBadgeClick,
  onHideVideo,
  onUnhideVideo,
  isHidden,
  isTopPick,
  showFullDate = false,
  showDescription = false,
}: VideoCardProps) {
  const [
    videoId,
    title,
    date,
    channel,
    viewCount,
    description,
    style,
    tournament,
    roundLevel,
    affTeam,
    negTeam,
    affWin,
    judgeDecision,
    arg1AC,
    arg2NR,
  ] = video

  const { activeVideoId, setActiveVideo, addToQueue, queue } =
    useVideoPlayerStore()
  const isPlaying = activeVideoId === videoId
  const isInQueue = queue.some((q) => q.videoId === videoId)

  const year = new Date(date).getFullYear()
  const styleNumber = typeof style === "number" ? style : undefined
  const videoMeta = { style: styleNumber, tournament, year, affTeam, negTeam }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
  const hasTeams = !!(affTeam || negTeam)
  const hasFullMetadata = Boolean(tournament && affTeam && negTeam)
  const styleSuffix = styleNumber === 2 ? " (PF)" : styleNumber === 3 ? " (LD)" : ""
  const cleanTournament = tournament ? tournament.replace(/\d+/g, "").trim() + styleSuffix : undefined
  const yearTopic = getYearTopic(year, styleNumber, topics)

  return (
    <TooltipProvider>
      <div className="block h-full relative group/card">
        <Card
          className={`overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full relative p-0 ${
            isPlaying ? "ring-2 ring-primary" : ""
          } ${
            isHidden
              ? "opacity-60 ring-2 ring-dashed ring-muted-foreground/50"
              : ""
          }`}
        >
          <GlowingEffect
            spread={80}
            glow={false}
            disabled={false}
            proximity={200}
            inactiveZone={0.3}
            borderWidth={3}
            blur={2}
            movementDuration={0.5}
          />

          {isHidden && (
            <div className="absolute top-1 left-1 z-10">
              <span className="text-[9px] bg-muted/90 text-muted-foreground py-0.5 rounded font-medium">
                Hidden
              </span>
            </div>
          )}

          <VideoCardThumbnail
            videoId={videoId}
            title={title}
            showThumbnails={showThumbnails}
            isPlaying={isPlaying}
            isTopPick={isTopPick}
            hasFullMetadata={hasFullMetadata}
            hasTeams={hasTeams}
            cleanTournament={cleanTournament}
            year={year}
            roundLevel={roundLevel}
            affTeam={affTeam}
            negTeam={negTeam}
            affWin={affWin}
            arg1AC={arg1AC}
            arg2NR={arg2NR}
            youtubeUrl={youtubeUrl}
            videoMeta={videoMeta}
            styleNumber={styleNumber}
            setActiveVideo={setActiveVideo}
          />

          <VideoCardActions
            videoId={videoId}
            title={title}
            youtubeUrl={youtubeUrl}
            date={date}
            channel={channel}
            viewCount={viewCount}
            description={description}
            yearTopic={yearTopic}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            isInQueue={isInQueue}
            addToQueue={addToQueue}
            videoMeta={videoMeta}
            judgeDecision={judgeDecision}
            isHidden={isHidden}
            onHideVideo={onHideVideo}
            onUnhideVideo={onUnhideVideo}
            onBadgeClick={onBadgeClick}
            showFullDate={showFullDate}
            showDescription={showDescription}
          />
        </Card>
      </div>
    </TooltipProvider>
  )
}
