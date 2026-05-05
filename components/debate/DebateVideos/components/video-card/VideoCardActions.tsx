/**
 * @fileoverview Action button strip and metadata row rendered below a video card thumbnail.
 * @module components/debate/DebateVideos/components/video-card/VideoCardActions
 */

"use client"

import { useState } from "react"
import {
  Star,
  Calendar,
  Eye,
  ListVideo,
  EyeOff,
  Eye as EyeIcon,
  ExternalLink,
  Scale,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { HideConfirmDialog } from "./VideoCardDialogs"

/** Shape of the video metadata forwarded to the player store on queue add. */
interface VideoMeta {
  style?: number
  tournament?: string | null
  year: number
  affTeam?: string | null
  negTeam?: string | null
}

/** Props for the {@link VideoCardActions} component. */
interface VideoCardActionsProps {
  /** YouTube video ID. */
  videoId: string
  /** Video title (used in tooltip and dialog copy). */
  title: string
  /** Full YouTube watch URL. */
  youtubeUrl: string
  /** ISO date string from the video metadata. */
  date: string
  /** Channel name shown in the date tooltip. */
  channel: string
  /** Total YouTube view count. */
  viewCount: number
  /** Video description text (used in judge-decision tooltip). */
  description?: string
  /** Resolved year topic text; shown in the "T" topic tooltip button. */
  yearTopic?: string
  /** Whether this video is bookmarked as a favourite. */
  isFavorite: boolean
  /** Callback invoked with `videoId` to toggle the favourite state. */
  onToggleFavorite: (videoId: string) => void
  /** Whether this video is already in the play queue. */
  isInQueue: boolean
  /**
   * Callback to push the video to the play queue.
   * Matches the signature of `useVideoPlayerStore().addToQueue`.
   */
  addToQueue: (videoId: string, title: string, meta: VideoMeta) => void
  /** Metadata forwarded to the store on queue add. */
  videoMeta: VideoMeta
  /** Judge decision string (e.g. `"2-1"`, `"3-0"`). */
  judgeDecision?: string | null
  /** Whether the video is currently hidden from the grid. */
  isHidden: boolean
  /** Callback invoked with `videoId` to hide the video after confirmation. */
  onHideVideo: (videoId: string) => void
  /** Callback invoked with `videoId` to un-hide the video. */
  onUnhideVideo: (videoId: string) => void
  /** Callback invoked with badge text when the channel/date badge is clicked. */
  onBadgeClick: (text: string) => void
  /** When `true` shows the full long date; otherwise shows abbreviated month only. */
  showFullDate: boolean
  /** When `true` renders a description text block below the action row. */
  showDescription: boolean
}

/**
 * Renders the bottom metadata and action row of a video card.
 *
 * Actions (left to right): external YouTube link, favourite toggle, add-to-queue,
 * topic tooltip button (when a year topic is available), hide/unhide toggle,
 * date+channel badge, view count, and judge decision (when present).
 *
 * Manages `showHideConfirm` state locally and renders the {@link HideConfirmDialog}
 * inline so the parent card doesn't need to track dialog open state.
 *
 * @param props - See {@link VideoCardActionsProps}.
 */
export function VideoCardActions({
  videoId,
  title,
  youtubeUrl,
  date,
  channel,
  viewCount,
  description,
  yearTopic,
  isFavorite,
  onToggleFavorite,
  isInQueue,
  addToQueue,
  videoMeta,
  judgeDecision,
  isHidden,
  onHideVideo,
  onUnhideVideo,
  onBadgeClick,
  showFullDate,
  showDescription,
}: VideoCardActionsProps) {
  const [showHideConfirm, setShowHideConfirm] = useState(false)

  return (
    <>
      <div className="px-2 pb-1.5 pt-0 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs text-muted-foreground flex-wrap">
          {/* External YouTube link */}
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:text-primary transition-colors"
            title={`Watch "${title}" on YouTube`}
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Favourite toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite(videoId)
                }}
                className={`p-0.5 rounded transition-colors ${
                  isFavorite
                    ? "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={
                  isFavorite ? "Remove from favorites" : "Save to favorites"
                }
              >
                <Star
                  className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {isFavorite ? "Remove from favorites" : "Save to favorites"}
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Add-to-queue */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isInQueue) addToQueue(videoId, title, videoMeta)
                }}
                disabled={isInQueue}
                className={`p-0.5 rounded transition-colors ${
                  isInQueue
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={isInQueue ? "In queue" : "Add to queue"}
              >
                <ListVideo className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isInQueue ? "In queue" : "Add to queue"}</p>
            </TooltipContent>
          </Tooltip>

          {/* Topic tooltip button */}
          {yearTopic && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors font-semibold text-xs"
                  aria-label="View topic"
                >
                  T
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="text-sm whitespace-pre-line space-y-2">
                  {description ? (
                    <>
                      <p className="font-semibold text-primary">
                        {yearTopic.replace(/<br\s*\/?>/gi, "\n")}
                      </p>
                      <p>
                        {description.split("\n").slice(2).join("\n").trim()}
                      </p>
                    </>
                  ) : (
                    <p>{yearTopic.replace(/<br\s*\/?>/gi, "\n")}</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Hide / unhide toggle */}
          {isHidden ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnhideVideo(videoId)
                  }}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Unhide video"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Unhide video</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowHideConfirm(true)
                  }}
                  className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Hide video"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Hide video</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Date + channel badge */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onBadgeClick(channel)
                }}
                className="flex items-center gap-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Calendar className="h-3 w-3" />
                <span>
                  {showFullDate
                    ? new Date(date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : new Date(date).toLocaleDateString("en-US", {
                        month: "short",
                      })}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm space-y-1">
                <p className="font-medium">{channel}</p>
                <p className="text-orange-400">
                  {new Date(date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* View count */}
          <div className="flex items-center gap-1 shrink-0">
            <Eye className="h-3 w-3" />
            <span>{viewCount.toLocaleString()}</span>
          </div>

          {/* Judge decision */}
          {judgeDecision && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 shrink-0 cursor-help">
                  <Scale className="h-3.5 w-3.5" />
                  <span>{judgeDecision}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">{description}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Optional description block */}
        {showDescription && description && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground line-clamp-3">
              {description}
            </p>
          </div>
        )}
      </div>

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
