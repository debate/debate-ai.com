/**
 * @fileoverview The group rows of the list layout and the recursion that
 * draws a tree of them — a season opens onto its tournaments, a tournament
 * onto its rounds, a round onto the videos themselves.
 *
 * A group is open or closed on its own state, seeded from the table's
 * collapse level: a row at depth `d` starts open when `d + 1 < collapseDepth`.
 * The table remounts these rows when that level changes (the level is part of
 * their React key), which is what makes the header's `L1 … L4` control move
 * every group at once while still letting a single row be toggled afterwards.
 * @module components/video-grid/VideoTreeRows
 */

"use client"

import { useState } from "react"
import { CalendarRange, ChevronRight, Medal, Tag, Trophy, Tv } from "lucide-react"
import { cn } from "../../ui/lib/utils"
import { formatVideoDate } from "../video-card/videoCardUtils"
import { VideoListRow } from "./VideoListRow"
import { treeIndentStyle } from "./tree-indent"
import type { VideoGroupKind, VideoTreeGroup, VideoTreeNode } from "./video-tree"
import type { VideoType } from "../../types/videos"

/** Icon per group level, so the depth reads without counting indents. */
const GROUP_ICONS: Record<VideoGroupKind, typeof Trophy> = {
  season: CalendarRange,
  tournament: Trophy,
  round: Medal,
  channel: Tv,
  category: Tag,
}

/** What the rows below a group are called, for its screen-reader label. */
const GROUP_KIND_LABELS: Record<VideoGroupKind, string> = {
  season: "season",
  tournament: "tournament",
  round: "round",
  channel: "channel",
  category: "category",
}

/** Everything the leaves need that the tree itself does not carry. */
export interface VideoTreeRowContext {
  isRoundMode: boolean
  showThumbnails: boolean
  favorites: Set<string>
  hiddenVideos: Set<string>
  topPicks?: Set<string>
  /** Which member of each stacked playlist its row is showing, by slot key. */
  stackSelection: Record<string, number>
  onStackSelect: (slotKey: string, index: number) => void
  onToggleFavorite: (videoId: string) => void
  onHideVideo: (videoId: string) => void
  onUnhideVideo: (videoId: string) => void
  /** Searches the library for a clicked team name. */
  onSearch?: (text: string) => void
}

function GroupRows({
  group,
  depth,
  collapseDepth,
  context,
}: {
  group: VideoTreeGroup
  depth: number
  collapseDepth: number
  context: VideoTreeRowContext
}) {
  const [isOpen, setIsOpen] = useState(depth + 1 < collapseDepth)
  const Icon = GROUP_ICONS[group.kind]

  return (
    <>
      <tr
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "cursor-pointer select-none border-b border-border transition-colors",
          depth === 0 ? "bg-muted/60 hover:bg-muted" : "bg-muted/25 hover:bg-muted/50",
        )}
      >
        <td className="py-2 pr-3 align-middle" style={treeIndentStyle(depth)}>
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${GROUP_KIND_LABELS[group.kind]} ${group.label}`}
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen((open) => !open)
            }}
            className="flex w-full items-center gap-2 text-left"
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                isOpen && "rotate-90",
              )}
            />
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span
              className={cn(
                "truncate font-semibold",
                depth === 0 ? "text-sm text-foreground" : "text-sm text-primary",
              )}
            >
              {group.label}
            </span>
            <span className="shrink-0 rounded-full bg-background/70 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {group.videoCount}
            </span>
          </button>
        </td>

        {/* The matchup columns stay empty on a group row: a tournament has no
            Aff and no Neg. Spanned rather than split so every row in the
            table still has exactly as many cells as there are headers. */}
        {context.isRoundMode && <td colSpan={2} />}

        <td className="px-3 py-2 align-middle text-xs text-muted-foreground whitespace-nowrap">
          {group.latestDate ? formatVideoDate(group.latestDate, "full", "—") : "—"}
        </td>
        <td className="px-3 py-2 align-middle text-xs text-muted-foreground text-right tabular-nums whitespace-nowrap">
          {group.viewCount.toLocaleString()}
        </td>
      </tr>

      {isOpen &&
        group.children.map((child) => (
          <VideoTreeRows
            key={`${collapseDepth}-${child.key}`}
            node={child}
            depth={depth + 1}
            collapseDepth={collapseDepth}
            context={context}
          />
        ))}
    </>
  )
}

/**
 * Draws one node of the tree — a group and, when it is open, everything
 * under it, or a single video row.
 */
export function VideoTreeRows({
  node,
  depth,
  collapseDepth,
  context,
}: {
  node: VideoTreeNode
  depth: number
  collapseDepth: number
  context: VideoTreeRowContext
}) {
  if (node.type === "group") {
    return (
      <GroupRows group={node} depth={depth} collapseDepth={collapseDepth} context={context} />
    )
  }

  const { slot } = node
  const selected = context.stackSelection[slot.key] ?? slot.initialIndex
  const stackIndex = Math.min(Math.max(selected, 0), slot.videos.length - 1)
  const video: VideoType = slot.videos[stackIndex]

  return (
    <VideoListRow
      video={video}
      depth={depth}
      stackVideos={slot.videos}
      stackIndex={stackIndex}
      onStackSelect={(next) => context.onStackSelect(slot.key, next)}
      isFavorite={context.favorites.has(video[0])}
      isHidden={context.hiddenVideos.has(video[0])}
      isTopPick={context.topPicks?.has(video[0]) || false}
      isRoundMode={context.isRoundMode}
      showThumbnails={context.showThumbnails}
      onToggleFavorite={context.onToggleFavorite}
      onHideVideo={context.onHideVideo}
      onUnhideVideo={context.onUnhideVideo}
      onSearch={context.onSearch}
    />
  )
}
