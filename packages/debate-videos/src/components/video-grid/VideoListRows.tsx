/**
 * @fileoverview Dense row/table layout for the video results — same data as
 * {@link VideoGrid}'s cards, but as a header + one row per video with no
 * thumbnails, for scanning many videos' details at once. Columns are
 * drag-resizable and click-sortable.
 */

"use client"

import React, { useMemo, useState } from "react"
import { Star, ExternalLink, EyeOff, Eye, ListVideo, ChevronUp, ChevronDown, Info } from "lucide-react"
import { cn } from "../../ui/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/primitives/tooltip"
import { useVideoPlayerStore } from "../../state/videoPlayerStore"
import { STYLE_COLORS, DEBATE_STYLE_LABELS, getRoundBadgeColor } from "../video-card/videoCardUtils"
import { HideConfirmDialog } from "../video-card/VideoCardDialogs"
import { TranscriptModal } from "../transcript-modal/TranscriptModal"
import { useResizableColumns } from "./useResizableColumns"
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

function getStyleLabel(video: VideoType): string {
  const style = video[6]
  if (typeof style === "number") return DEBATE_STYLE_LABELS[style] ?? ""
  return typeof style === "string" ? style : ""
}

type ColumnKey =
  | "tournament"
  | "level"
  | "aff"
  | "neg"
  | "arguments"
  | "format"
  | "channel"
  | "date"
  | "views"

interface ColumnDef {
  key: ColumnKey
  label: string
  headerClassName?: string
  /** Omit for columns (like "Arguments") that have no single sortable value. */
  sortValue?: (video: VideoType) => string | number
}

const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  tournament: 150,
  level: 100,
  aff: 150,
  neg: 150,
  arguments: 200,
  format: 90,
  channel: 160,
  date: 110,
  views: 90,
}

const DATE_COLUMN: ColumnDef = { key: "date", label: "Date", sortValue: (v) => new Date(v[2]).getTime() || 0 }
const VIEWS_COLUMN: ColumnDef = {
  key: "views",
  label: "Views",
  headerClassName: "text-right",
  sortValue: (v) => v[4] ?? 0,
}

const ROUND_COLUMNS: ColumnDef[] = [
  { key: "tournament", label: "Tournament", headerClassName: "hidden sm:table-cell", sortValue: (v) => v[7]?.toLowerCase() ?? "" },
  { key: "level", label: "Level", headerClassName: "hidden sm:table-cell", sortValue: (v) => v[8]?.toLowerCase() ?? "" },
  { key: "aff", label: "Aff", sortValue: (v) => v[9]?.toLowerCase() ?? "" },
  { key: "neg", label: "Neg", sortValue: (v) => v[10]?.toLowerCase() ?? "" },
  { key: "arguments", label: "Arguments", headerClassName: "hidden lg:table-cell" },
  DATE_COLUMN,
  VIEWS_COLUMN,
]

const LECTURE_COLUMNS: ColumnDef[] = [
  { key: "format", label: "Format", headerClassName: "hidden sm:table-cell", sortValue: (v) => getStyleLabel(v).toLowerCase() },
  { key: "channel", label: "Channel", headerClassName: "hidden md:table-cell", sortValue: (v) => v[3]?.toLowerCase() ?? "" },
  DATE_COLUMN,
  VIEWS_COLUMN,
]

type SortDirection = "asc" | "desc"

function ColumnResizeHandle({ onResizeStart }: { onResizeStart: (clientX: number) => void }) {
  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onResizeStart(e.clientX)
      }}
      onTouchStart={(e) => {
        e.stopPropagation()
        onResizeStart(e.touches[0].clientX)
      }}
      onClick={(e) => e.stopPropagation()}
      role="separator"
      aria-orientation="vertical"
      className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none select-none hover:bg-primary/40 active:bg-primary/60"
    />
  )
}

function VideoRow({
  video,
  index,
  isFavorite,
  isHidden,
  isTopPick,
  isRoundMode,
  onToggleFavorite,
  onHideVideo,
  onUnhideVideo,
}: {
  video: VideoType
  index: number
  isFavorite: boolean
  isHidden: boolean
  isTopPick: boolean
  isRoundMode: boolean
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
    roundLevel,
    affTeam,
    negTeam,
    _affWin,
    _judgeDecision,
    arg1AC,
    arg2NR,
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

  // Without a Title column, Tournament and the Aff/Neg matchup are what
  // actually identify a round — Level and Arguments alone don't. When
  // neither is available (no tournament, or no team on either side), the
  // row has nothing to scan, so show the video title across the full width
  // instead of a row of dashes.
  const roundRowIdentifiable = Boolean(tournament) && Boolean(affTeam || negTeam)

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
        {isRoundMode ? (
          roundRowIdentifiable ? (
            <>
              <td className="px-3 py-2 align-top hidden sm:table-cell text-sm text-muted-foreground truncate">
                {tournament || "—"}
              </td>
              <td className="px-3 py-2 align-top hidden sm:table-cell whitespace-nowrap">
                {roundLevel ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border",
                      getRoundBadgeColor(roundLevel),
                    )}
                  >
                    {roundLevel}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2 align-top text-sm truncate">
                {affTeam || <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-3 py-2 align-top text-sm truncate">
                {negTeam || <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-3 py-2 align-top hidden lg:table-cell text-xs text-muted-foreground">
                {arg1AC || arg2NR ? (
                  <div className="flex flex-col gap-0.5">
                    {arg1AC && <span className="truncate">1AC: {arg1AC}</span>}
                    {arg2NR && <span className="truncate">2NR: {arg2NR}</span>}
                  </div>
                ) : (
                  "—"
                )}
              </td>
            </>
          ) : (
            <td colSpan={5} className="px-3 py-2 align-top text-sm text-foreground truncate">
              {title}
            </td>
          )
        ) : (
          <>
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
            <td className="px-3 py-2 align-top hidden md:table-cell text-sm text-muted-foreground truncate">
              {channel}
            </td>
          </>
        )}
        <td className="px-3 py-2 align-top text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(date)}
        </td>
        <td className="px-3 py-2 align-top text-sm text-muted-foreground text-right tabular-nums whitespace-nowrap">
          {viewCount.toLocaleString()}
        </td>
        <td className="px-3 py-2 align-top">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {isTopPick && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="p-1" aria-label="Top pick">
                    🎖️
                  </span>
                </TooltipTrigger>
                <TooltipContent>Top pick</TooltipContent>
              </Tooltip>
            )}

            {!isRoundMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Video title: ${title}`}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px]">{title}</TooltipContent>
              </Tooltip>
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

            <TranscriptModal videoId={videoId} title={title} />

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
  // Round (debate) videos carry tournament/aff/neg data that lectures never
  // populate, so that presence alone tells the two layouts apart — no need
  // for the caller to say which page it's rendering.
  const isRoundMode = useMemo(
    () => videos.some((video) => video[7] || video[9] || video[10]),
    [videos],
  )

  const columns = isRoundMode ? ROUND_COLUMNS : LECTURE_COLUMNS
  const { widths, startResize } = useResizableColumns(DEFAULT_COLUMN_WIDTHS)

  const [sortColumn, setSortColumn] = useState<ColumnKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const handleSort = (column: ColumnDef) => {
    if (!column.sortValue) return
    if (sortColumn === column.key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column.key)
      setSortDirection("asc")
    }
  }

  const sortedVideos = useMemo(() => {
    const column = columns.find((c) => c.key === sortColumn)
    if (!column?.sortValue) return videos
    const { sortValue } = column
    const withKeys = videos.map((video, index) => ({ video, index, value: sortValue(video) }))
    withKeys.sort((a, b) => {
      const cmp =
        typeof a.value === "number" && typeof b.value === "number"
          ? a.value - b.value
          : String(a.value).localeCompare(String(b.value))
      return cmp !== 0 ? cmp : a.index - b.index
    })
    const ordered = withKeys.map((entry) => entry.video)
    return sortDirection === "asc" ? ordered : ordered.reverse()
  }, [videos, columns, sortColumn, sortDirection])

  return (
    <TooltipProvider>
      <div ref={videoContainerRef} className="w-full overflow-x-auto rounded-md border border-border">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: widths[column.key], minWidth: widths[column.key] }}
                  className={cn("relative px-3 py-2 select-none", column.headerClassName)}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column)}
                      className={cn(
                        "flex items-center gap-1 hover:text-foreground",
                        column.headerClassName?.includes("text-right") && "ml-auto",
                      )}
                    >
                      {column.label}
                      {sortColumn === column.key &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        ))}
                    </button>
                  ) : (
                    column.label
                  )}
                  <ColumnResizeHandle onResizeStart={(clientX) => startResize(column.key, clientX)} />
                </th>
              ))}
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedVideos.map((video, index) => (
              <VideoRow
                key={`${video[0]}-${index}`}
                video={video}
                index={index}
                isFavorite={favorites.has(video[0])}
                isHidden={hiddenVideos.has(video[0])}
                isTopPick={topPicks?.has(video[0]) || false}
                isRoundMode={isRoundMode}
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
