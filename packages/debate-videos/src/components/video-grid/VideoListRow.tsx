/**
 * @fileoverview One video row of the list layout — the leaf of the tree the
 * rows are grouped into (see `video-tree.ts`).
 *
 * The row is two tiers next to a thumbnail: the title on top, and under it
 * the details that identify the video when its groups are scrolled off or
 * collapsed away — the round level and tournament for a round, the channel
 * and category for a lecture. It stands for a *slot*, so a stacked playlist
 * occupies one row and the `<` / `>` control at the head of the Actions cell
 * swaps which member the row is showing.
 *
 * The 1AC/2NR argument labels, when recorded, sit in small type under the
 * team that ran them in the Aff and Neg cells — the same pairing the cards
 * (`VideoCardThumbnail`) draw.
 */

"use client"

import { useState } from "react"
import { Star, ExternalLink, EyeOff, Eye, ListVideo, Play } from "lucide-react"
import { cn } from "../../ui/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/primitives/tooltip"
import { useVideoPlayerStore } from "../../state/videoPlayerStore"
import { STYLE_COLORS, getRoundBadgeColor, formatVideoDate } from "../video-card/videoCardUtils"
import { TopPickBadge } from "../video-card/TopPickBadge"
import { WatchProgressBadge } from "../video-card/WatchProgressBadge"
import { useWatchHistoryEntry } from "../../hooks/useWatchHistory"
import { HideConfirmDialog } from "../video-card/VideoCardDialogs"
import { WatchPageLink } from "../watch/WatchPageLink"
import { StackNav, stackMemberLabel } from "../video-card/StackNav"
import { cleanTournamentName, videoCategoryLabel } from "./video-tree"
import { treeIndentStyle } from "./tree-indent"
import type { VideoType } from "../../types/videos"

/** Thumbnail strip at the head of a row, 16:9 like the cards'. */
function RowThumbnail({
  videoId,
  title,
  isPlaying,
}: {
  videoId: string
  title: string
  isPlaying: boolean
}) {
  const [failed, setFailed] = useState(false)

  return (
    <span
      className={cn(
        // 160×90 at full width, the native size of YouTube's `mqdefault`, and
        // a step down on a phone rather than gone: a row without its
        // thumbnail is the hardest kind to pick a video out of.
        "relative block aspect-video w-28 shrink-0 overflow-hidden rounded border border-border bg-muted sm:w-40",
        isPlaying && "border-primary",
      )}
    >
      {/* A plain <img>, as on the cards: one request per row, no layout work,
          and a thumbnail YouTube never generated just fades out. */}
      {!failed && (
        <img
          src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
        <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] leading-tight text-muted-foreground">
          {title.slice(0, 28)}
        </span>
      )}
      {isPlaying && (
        <span className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Play className="h-4 w-4 fill-current text-primary" />
        </span>
      )}
    </span>
  )
}

/** An Aff or Neg cell: the team, and under it the argument it ran if known. */
function TeamCell({ team, argument }: { team?: string | null; argument?: string | null }) {
  return (
    <td className="px-3 py-3 align-top text-sm">
      <div className="truncate">{team || <span className="text-muted-foreground">—</span>}</div>
      {argument && (
        <div className="mt-0.5 line-clamp-2 text-xs leading-tight text-muted-foreground" title={argument}>
          {argument}
        </div>
      )}
    </td>
  )
}

export function VideoListRow({
  video,
  depth,
  stackVideos,
  stackIndex,
  onStackSelect,
  isFavorite,
  isHidden,
  isTopPick,
  isRoundMode,
  showThumbnails,
  onToggleFavorite,
  onHideVideo,
  onUnhideVideo,
}: {
  video: VideoType
  /** Tree depth, for the row's indent. */
  depth: number
  /** The stack this row stands for; one entry for a standalone video. */
  stackVideos: VideoType[]
  /** Index of {@link video} within `stackVideos`. */
  stackIndex: number
  /** Flips the row to another member of the stack. */
  onStackSelect: (index: number) => void
  isFavorite: boolean
  isHidden: boolean
  isTopPick: boolean
  isRoundMode: boolean
  showThumbnails: boolean
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
    description,
    style,
    tournament,
    roundLevel,
    affTeam,
    negTeam,
    _affWin,
    _judgeDecision,
    arg1AC,
    arg2NR,
  ] = video
  const [showHideConfirm, setShowHideConfirm] = useState(false)

  // Per-field selectors rather than the whole store — see `VideoCard` for
  // why: a list holds one of these rows per loaded video, and subscribing
  // each to the store object re-rendered all of them on any player change.
  const isPlaying = useVideoPlayerStore((state) => state.activeVideoId === videoId)
  const isInQueue = useVideoPlayerStore((state) =>
    state.queue.some((item) => item.videoId === videoId),
  )
  const setActiveVideo = useVideoPlayerStore((state) => state.setActiveVideo)
  const addToQueue = useVideoPlayerStore((state) => state.addToQueue)
  const watched = useWatchHistoryEntry(videoId)

  const styleNumber = typeof style === "number" ? style : undefined
  const categoryLabel = videoCategoryLabel(video)
  const year = new Date(date).getFullYear()
  const cleanTournament = cleanTournamentName(tournament)
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

  return (
    <>
      <tr
        onClick={() =>
          !isPlaying &&
          setActiveVideo(videoId, title, { style: styleNumber, tournament, year, affTeam, negTeam })
        }
        className={cn(
          "cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-accent/50",
          isPlaying && "bg-primary/10 hover:bg-primary/10",
          isHidden && "opacity-50",
        )}
      >
        <td className="py-3 pr-3 align-top" style={treeIndentStyle(depth)}>
          <div className="flex items-start gap-3">
            {/* Stands in for a group row's chevron, so titles line up under
                the round they belong to rather than under its arrow. Lectures
                are listed flat, with no group rows to line up under. */}
            {isRoundMode && <span className="w-4 shrink-0" aria-hidden="true" />}
            {showThumbnails && (
              <RowThumbnail videoId={videoId} title={title} isPlaying={isPlaying} />
            )}
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                {title}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 overflow-hidden text-xs text-muted-foreground">
                {isRoundMode ? (
                  <>
                    {roundLevel && (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[11px] font-medium",
                          getRoundBadgeColor(roundLevel),
                        )}
                      >
                        {roundLevel}
                      </span>
                    )}
                    <span className="truncate">
                      {[cleanTournament, channel].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </>
                ) : (
                  <>
                    {categoryLabel && (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
                          styleNumber && STYLE_COLORS[styleNumber]
                            ? STYLE_COLORS[styleNumber]
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {categoryLabel}
                      </span>
                    )}
                    <span className="truncate">{channel || "—"}</span>
                  </>
                )}
              </div>
              {/* What the cards have always carried and the rows did not: the
                  uploader's own blurb, clamped to two lines. It is often the
                  only place a lecture says what it actually covers. */}
              {description && (
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground/90">
                  {description}
                </p>
              )}
            </div>
          </div>
        </td>

        {isRoundMode && (
          <>
            <TeamCell team={affTeam} argument={arg1AC} />
            <TeamCell team={negTeam} argument={arg2NR} />
          </>
        )}

        <td className="px-3 py-3 align-top text-sm text-muted-foreground whitespace-nowrap">
          {formatVideoDate(date, "full", "—")}
        </td>
        <td className="px-3 py-3 align-top text-sm text-muted-foreground text-right tabular-nums whitespace-nowrap">
          {viewCount.toLocaleString()}
        </td>

        <td className="px-3 py-3 align-top">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {stackVideos.length > 1 && (
              <StackNav
                index={stackIndex}
                count={stackVideos.length}
                label={stackMemberLabel(video)}
                onSelect={onStackSelect}
                variant="inline"
                className="mr-1"
              />
            )}

            {/* Every row carries it, watched or not: the point of the marker
                is that you can hover any row and learn where you got to —
                "Not watched" included. */}
            <WatchProgressBadge entry={watched} size={14} plain showUnwatched />

            {isTopPick && (
              <TopPickBadge
                videoId={videoId}
                affTeam={affTeam}
                negTeam={negTeam}
                title={title}
                tournament={tournament}
                year={date ? new Date(date).getFullYear() : undefined}
                roundLevel={roundLevel}
                size="sm"
              />
            )}

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
                  aria-label={isFavorite ? "Remove from My Favorites" : "Star to add to My Favorites"}
                >
                  <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{isFavorite ? "Remove from My Favorites" : "Star to add to My Favorites"}</TooltipContent>
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

            <WatchPageLink
              videoId={videoId}
              title={title}
              video={video}
              className="p-1"
              iconClassName="h-3.5 w-3.5"
            />

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
