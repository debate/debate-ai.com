/**
 * @fileoverview Dense row/table layout for the video results — same data as
 * {@link VideoGrid}'s cards, but as a header + one row per video with no
 * thumbnails, for scanning many videos' details at once.
 */

"use client"

import React, { useState } from "react"
import { Star, ExternalLink, EyeOff, Eye, ListVideo, Scale } from "lucide-react"
import { cn } from "debate-ui/src/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "debate-ui/src/primitives/tooltip"
import { useVideoPlayerStore } from "../../state/videoPlayerStore"
import { STYLE_COLORS, DEBATE_STYLE_LABELS } from "../video-card/videoCardUtils"
import { HideConfirmDialog } from "../video-card/VideoCardDialogs"
import type { VideoType } from "../../types/videos"

interface VideoListRowsProps {
  videos: VideoType[]
  videoContainerRef: React.RefObject<HTMLDivElement | null>
  favorites: Set<string>
  onToggleFavorite: (videoId: string) => void
  onHideVideo: (videoId: string) => void
  onUnhideVideo: (videoId: string) => void
  hiddenVideos: Set<string>
  topPicks?: Set<string>
}

function formatDate(date: string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function VideoRow({
  video,
  index,
  isFavorite,
  isHidden,
  isTopPick,
  onToggleFavorite,
  onHideVideo,
  onUnhideVideo,
}: {
  video: VideoType
  index: number
  isFavorite: boolean
  isHidden: boolean
  isTopPick: boolean
  onToggleFavorite: (videoId: string) => void
  onHideVideo: (videoId: string) => void
  onUnhideVideo: (videoId: string) => void
}) {
  const [
    videoId,
    title,
    date,
    channel,
    viewCount,
    _description,
    style,
    tournament,
    _roundLevel,
    affTeam,
    negTeam,
    _affWin,
    judgeDecision,
  ] = video
  const [showHideConfirm, setShowHideConfirm] = useState(false)

  const { activeVideoId, setActiveVideo, addToQueue, queue } = useVideoPlayerStore()
  const isPlaying = activeVideoId === videoId
  const isInQueue = queue.some((q) => q.videoId === videoId)

  const styleNumber = typeof style === "number" ? style : undefined
  const styleLabel = styleNumber
    ? DEBATE_STYLE_LABELS[styleNumber]
    : typeof style === "string"
      ? style
      : undefined
  const year = new Date(date).getFullYear()
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
  const teams = affTeam && negTeam ? `${affTeam} vs ${negTeam}` : affTeam || negTeam || undefined

  return (
    <>
      <tr
        onClick={() =>
          !isPlaying &&
          setActiveVideo(videoId, title, { style: styleNumber, tournament, year, affTeam, negTeam })
        }
        className={cn(
          "cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-accent/50",
          index % 2 === 1 && "bg-muted/30",
          isPlaying && "bg-primary/10 hover:bg-primary/10",
          isHidden && "opacity-50",
        )}
      >
        <td className="px-3 py-2 align-top max-w-[320px]">
          <div className="flex items-start gap-1.5">
            {isTopPick && <span title="Top pick">🎖️</span>}
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground text-sm">{title}</p>
              {teams && <p className="truncate text-xs text-muted-foreground">{teams}</p>}
            </div>
          </div>
        </td>
        <td className="px-3 py-2 align-top hidden sm:table-cell whitespace-nowrap">
          {styleLabel ? (
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                styleNumber && STYLE_COLORS[styleNumber] ? STYLE_COLORS[styleNumber] : "bg-muted text-muted-foreground",
              )}
            >
              {styleLabel}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-3 py-2 align-top hidden md:table-cell text-sm text-muted-foreground truncate max-w-[160px]">
          {channel}
        </td>
        <td className="px-3 py-2 align-top text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(date)}
        </td>
        <td className="px-3 py-2 align-top text-sm text-muted-foreground text-right tabular-nums whitespace-nowrap">
          {viewCount.toLocaleString()}
        </td>
        <td className="px-3 py-2 align-top hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
          {judgeDecision ? (
            <span className="inline-flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" />
              {judgeDecision}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-2 align-top">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Watch on YouTube</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToggleFavorite(videoId)}
                  className={cn(
                    "p-1 rounded transition-colors",
                    isFavorite
                      ? "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
                >
                  <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{isFavorite ? "Remove from favorites" : "Save to favorites"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    if (!isInQueue) addToQueue(videoId, title, { style: styleNumber, tournament, year, affTeam, negTeam })
                  }}
                  disabled={isInQueue}
                  className={cn(
                    "p-1 rounded transition-colors",
                    isInQueue ? "text-muted-foreground/50 cursor-not-allowed" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={isInQueue ? "In queue" : "Add to queue"}
                >
                  <ListVideo className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{isInQueue ? "In queue" : "Add to queue"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                {isHidden ? (
                  <button
                    onClick={() => onUnhideVideo(videoId)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Unhide video"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowHideConfirm(true)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Hide video"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                )}
              </TooltipTrigger>
              <TooltipContent>{isHidden ? "Unhide video" : "Hide video"}</TooltipContent>
            </Tooltip>
          </div>
        </td>
      </tr>

      <HideConfirmDialog
        open={showHideConfirm}
        onOpenChange={setShowHideConfirm}
        onConfirm={() => onHideVideo(videoId)}
        videoId={videoId}
        title={title}
      />
    </>
  )
}

export function VideoListRows({
  videos,
  videoContainerRef,
  favorites,
  onToggleFavorite,
  onHideVideo,
  onUnhideVideo,
  hiddenVideos,
  topPicks,
}: VideoListRowsProps) {
  return (
    <TooltipProvider>
      <div ref={videoContainerRef} className="w-full overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2 hidden sm:table-cell">Format</th>
              <th className="px-3 py-2 hidden md:table-cell">Channel</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">Views</th>
              <th className="px-3 py-2 hidden lg:table-cell">Decision</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video, index) => (
              <VideoRow
                key={`${video[0]}-${index}`}
                video={video}
                index={index}
                isFavorite={favorites.has(video[0])}
                isHidden={hiddenVideos.has(video[0])}
                isTopPick={topPicks?.has(video[0]) || false}
                onToggleFavorite={onToggleFavorite}
                onHideVideo={onHideVideo}
                onUnhideVideo={onUnhideVideo}
              />
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  )
}
