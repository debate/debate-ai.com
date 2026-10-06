/**
 * @fileoverview Dense row/table layout for the video results — the same data
 * as {@link VideoGrid}'s cards. An archive of rounds is grouped into a
 * collapsible tree of rows; lectures are one flat row per video.
 *
 * The round hierarchy is season → tournament, newest first at every level,
 * with untagged rounds in an `Unsorted` tournament; `video-tree.ts` builds
 * it and `VideoTreeRows` draws it. Lectures skip the tree: each row already
 * names its channel and category on its second tier, so grouping by them
 * only added clicks between the reader and the videos. A group row opens and closes on click, and the
 * `L1 … Ln` control in the first header moves every group at once — `L1`
 * leaves only the seasons standing, the top level shows every video.
 *
 * What is left of the flat table is still here: the columns are
 * drag-resizable and click-sortable, and a sort orders the videos *within*
 * their round rather than tearing the tree apart (see `sortVideoTreeLeaves`).
 *
 * Rows are one per *slot*, not one per video: a stacked playlist (a round and
 * the round-analysis video made from it) occupies a single row, and the
 * `<` / `>` control at the head of the row's actions swaps which member that
 * row is showing. The grouping rule lives in `video-stacks.ts`, shared with
 * the card grid.
 */

"use client"

import React, { useCallback, useMemo, useState } from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "../../ui/lib/utils"
import { TooltipProvider } from "../../ui/primitives/tooltip"
import { useWatchHistory } from "../../hooks/useWatchHistory"
import { useVideoTeamRankings } from "../../hooks/useVideoTeamRankings"
import { ColumnResizeHandle } from "./ColumnResizeHandle"
import { useResizableColumns } from "./useResizableColumns"
import { buildVideoSlots, type VideoSlot, type VideoStackMap } from "./video-stacks"
import {
  buildVideoTree,
  countVideoTreeLeaves,
  sortVideoTreeLeaves,
  videoTreeDepth,
  type VideoTreeNode,
} from "./video-tree"
import { VideoTreeRows, type VideoTreeRowContext } from "./VideoTreeRows"
import type { VideoType } from "../../types/videos"

export { cleanTournamentName } from "./video-tree"

interface VideoListRowsProps {
  videos: VideoType[]
  videoContainerRef: React.RefObject<HTMLDivElement | null>
  favorites: Set<string>
  onToggleFavorite: (videoId: string) => void
  onHideVideo: (videoId: string) => void
  onUnhideVideo: (videoId: string) => void
  hiddenVideos: Set<string>
  topPicks?: Set<string>
  /** Members of the stacked playlists on screen, from `/api/videos/stacks`. */
  stacks?: VideoStackMap | null
  /** Whether stacking is on; `false` gives every video its own row. */
  stacksEnabled?: boolean
  /** Draws the thumbnail strip at the head of each video row. */
  showThumbnails?: boolean
  /** Tree level the table opens at; the deepest level (every video shown)
   *  when omitted. */
  defaultCollapseDepth?: number
  /**
   * Which layout to draw: `"round"` for the season → tournament tree,
   * `"lecture"` for flat rows. Omit to infer it from the videos, which a
   * single stray round in a lecture feed tips over into the tree — so a page
   * that knows what it is listing should say.
   */
  layout?: "round" | "lecture"
  /**
   * `false` lists every video as its own row, tree or no tree — what the
   * related videos under the player want: round columns, since a related
   * round still has an Aff and a Neg, but nothing to group a handful of
   * videos by.
   */
  grouped?: boolean
  /**
   * Column the table opens sorted by. Without it the rows keep the feed's
   * own order, which is what the library's listings want — the feed is
   * already ranked. A short, unranked list passes `date`/`desc` to open
   * newest first instead.
   */
  defaultSort?: { column: ColumnKey; direction: SortDirection }
  /** Searches the library for a team when its name is clicked in the Aff or
   *  Neg column; without it the names are plain text. */
  onSearch?: (text: string) => void
  /**
   * Adds a sortable "Last watched" column (how long ago each video was
   * played), for the watch-history listing.
   */
  showWatched?: boolean
  /**
   * Badges each tournament name — its group row and every round under it —
   * with the debate format, for a listing that mixes formats (Top Picks).
   */
  showFormat?: boolean
}

type ColumnKey = "tree" | "aff" | "neg" | "date" | "views" | "watched"

interface ColumnDef {
  key: ColumnKey
  label: string
  headerClassName?: string
  /** Omit for a column with no single sortable value; its header is then
   *  plain text rather than a sort button. */
  sortValue?: (video: VideoType) => string | number
}

const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  // Wide enough for the 160px thumbnail, the indent of a video sitting three
  // levels deep, and two lines of title beside them.
  tree: 400,
  aff: 150,
  neg: 150,
  date: 110,
  views: 90,
  watched: 120,
}

/** Widest the tree column gets on a phone, so the next column shows beside it. */
const TREE_COLUMN_PHONE_MAX = "75vw"

const DATE_COLUMN: ColumnDef = { key: "date", label: "Date", sortValue: (v) => new Date(v[2]).getTime() || 0 }
const VIEWS_COLUMN: ColumnDef = {
  key: "views",
  label: "Views",
  headerClassName: "text-right",
  sortValue: (v) => v[4] ?? 0,
}

/** Added to either layout on the watch-history listing; sorted by recency. */
const WATCHED_COLUMN_LABEL = "Last watched"

/**
 * Round columns. Tournament, Level and Season are not among them: they head
 * the groups the rows sit in, and repeating them in every row is what the
 * tree is here to stop.
 */
const ROUND_COLUMNS: ColumnDef[] = [
  { key: "tree", label: "Round", sortValue: (v) => v[1]?.toLowerCase() ?? "" },
  { key: "aff", label: "Aff", sortValue: (v) => v[9]?.toLowerCase() ?? "" },
  { key: "neg", label: "Neg", sortValue: (v) => v[10]?.toLowerCase() ?? "" },
  DATE_COLUMN,
  VIEWS_COLUMN,
]

/**
 * Lecture columns. Channel and Category ride on the row's second tier rather
 * than taking a column each.
 */
const LECTURE_COLUMNS: ColumnDef[] = [
  { key: "tree", label: "Library", sortValue: (v) => v[1]?.toLowerCase() ?? "" },
  DATE_COLUMN,
  VIEWS_COLUMN,
]

type SortDirection = "asc" | "desc"

/** The `- Ln +` stepper that opens and closes every group at once. */
function CollapseLevelControl({
  level,
  maxLevel,
  onChange,
}: {
  level: number
  maxLevel: number
  onChange: (level: number) => void
}) {
  return (
    <span className="ml-auto inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Collapse one level"
        disabled={level <= 1}
        onClick={() => onChange(Math.max(1, level - 1))}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded border border-border text-xs leading-none",
          level <= 1 ? "cursor-not-allowed opacity-40" : "hover:border-primary hover:text-primary",
        )}
      >
        −
      </button>
      <span className="w-6 text-center text-[11px] font-semibold tabular-nums text-primary">
        L{level}
      </span>
      <button
        type="button"
        aria-label="Expand one level"
        disabled={level >= maxLevel}
        onClick={() => onChange(Math.min(maxLevel, level + 1))}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded border border-border text-xs leading-none",
          level >= maxLevel ? "cursor-not-allowed opacity-40" : "hover:border-primary hover:text-primary",
        )}
      >
        +
      </button>
    </span>
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
  stacks,
  stacksEnabled = true,
  showThumbnails = true,
  defaultCollapseDepth,
  layout,
  grouped = true,
  defaultSort,
  onSearch,
  showWatched = false,
  showFormat = false,
}: VideoListRowsProps) {
  const watchHistory = useWatchHistory()
  // Without an explicit `layout`, round (debate) videos carry tournament/aff/
  // neg data that lectures rarely populate, so that presence tells the two
  // layouts apart.
  const isRoundMode = useMemo(
    () => (layout ? layout === "round" : videos.some((video) => video[7] || video[9] || video[10])),
    [videos, layout],
  )

  const teamRanking = useVideoTeamRankings(videos, isRoundMode)

  const baseColumns = isRoundMode ? ROUND_COLUMNS : LECTURE_COLUMNS
  const columns = useMemo<ColumnDef[]>(
    () =>
      showWatched
        ? [
            ...baseColumns,
            {
              key: "watched",
              label: WATCHED_COLUMN_LABEL,
              sortValue: (v) => Date.parse(watchHistory.get(v[0])?.watchedAt ?? "") || 0,
            },
          ]
        : baseColumns,
    [baseColumns, showWatched, watchHistory],
  )
  const { widths, startResize } = useResizableColumns(DEFAULT_COLUMN_WIDTHS)
  const tableWidth = columns.reduce((total, column) => total + widths[column.key], 0)

  const [sortColumn, setSortColumn] = useState<ColumnKey | null>(defaultSort?.column ?? null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort?.direction ?? "asc")

  const handleSort = (column: ColumnDef) => {
    if (!column.sortValue) return
    if (sortColumn === column.key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column.key)
      // Recency reads newest-first; everything else starts A→Z / low→high.
      setSortDirection(column.key === "watched" ? "desc" : "asc")
    }
  }

  // Which member of each stacked playlist its row is currently showing, keyed
  // by slot. Held here rather than in the row so that re-sorting the table —
  // which re-orders the rows — cannot reset a flipped row back to its round.
  const [stackSelection, setStackSelection] = useState<Record<string, number>>({})

  const slots = useMemo(
    () => buildVideoSlots(videos, stacks, stacksEnabled),
    [videos, stacks, stacksEnabled],
  )

  // Lectures, and any listing that asked not to be grouped, are listed flat
  // — one row per slot, in feed order.
  const tree = useMemo<VideoTreeNode[]>(
    () =>
      isRoundMode && grouped
        ? buildVideoTree(slots, "round")
        : slots.map((slot) => ({ type: "video", key: slot.key, slot })),
    [slots, isRoundMode, grouped],
  )

  /** The member of a slot on screen — what a sort reads, and what a row shows. */
  const selectedVideo = useCallback(
    (slot: VideoSlot): VideoType => {
      const selected = stackSelection[slot.key] ?? slot.initialIndex
      return slot.videos[Math.min(Math.max(selected, 0), slot.videos.length - 1)]
    },
    [stackSelection],
  )

  // Sorting runs on the video each row is showing, not on the stack's primary:
  // a row flipped to the analysis sorts by the analysis' own date and views,
  // which is what the row has on screen.
  const sortedTree = useMemo(() => {
    const column = columns.find((c) => c.key === sortColumn)
    if (!column?.sortValue) return tree
    const { sortValue } = column
    return sortVideoTreeLeaves(tree, (a, b) => {
      const valueA = sortValue(selectedVideo(a))
      const valueB = sortValue(selectedVideo(b))
      const cmp =
        typeof valueA === "number" && typeof valueB === "number"
          ? valueA - valueB
          : String(valueA).localeCompare(String(valueB))
      return sortDirection === "asc" ? cmp : -cmp
    })
  }, [tree, columns, sortColumn, sortDirection, selectedVideo])

  // `null` means "however deep the tree goes", so a page that loads more
  // videos — and so grows a level — stays open rather than closing itself.
  const [collapseDepth, setCollapseDepth] = useState<number | null>(defaultCollapseDepth ?? null)
  const maxCollapseDepth = useMemo(() => videoTreeDepth(tree), [tree])
  const effectiveCollapseDepth = Math.min(collapseDepth ?? maxCollapseDepth, maxCollapseDepth)

  const context: VideoTreeRowContext = {
    isRoundMode,
    showWatched,
    showThumbnails,
    favorites,
    hiddenVideos,
    topPicks,
    stackSelection,
    onStackSelect: (slotKey, index) =>
      setStackSelection((current) => ({ ...current, [slotKey]: index })),
    onToggleFavorite,
    onHideVideo,
    onUnhideVideo,
    onSearch,
    showFormat,
  }

  return (
    <TooltipProvider>
      <div ref={videoContainerRef} className="w-full overflow-x-auto rounded-md border border-border">
        {/* Sized to its columns rather than stretched across the page, so a
            wide screen does not pull a row's date and views far from its
            title, and a phone scrolls sideways to reach them. */}
        <table
          // Every column shows at every width; on a phone the wrapper scrolls
          // sideways to reach them. There the tree column is capped at
          // `TREE_COLUMN_PHONE_MAX` so the Aff column peeks in beside it —
          // the hint that there is more to the right.
          className="w-[var(--table-width-phone)] table-fixed border-collapse text-sm sm:w-[var(--table-width)]"
          style={
            {
              "--table-width": `${tableWidth}px`,
              "--table-width-phone": `calc(${tableWidth - widths.tree}px + min(${widths.tree}px, ${TREE_COLUMN_PHONE_MAX}))`,
            } as React.CSSProperties
          }
        >
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ "--col-width": `${widths[column.key]}px` } as React.CSSProperties}
                  className={cn(
                    "relative px-3 py-2 select-none sm:w-[var(--col-width)] sm:min-w-[var(--col-width)]",
                    column.key === "tree"
                      ? "w-[min(var(--col-width),75vw)]"
                      : "w-[var(--col-width)] min-w-[var(--col-width)]",
                    column.headerClassName,
                  )}
                >
                  <span className="flex items-center gap-1">
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
                    {column.key === "tree" && maxCollapseDepth > 1 && (
                      <CollapseLevelControl
                        level={effectiveCollapseDepth}
                        maxLevel={maxCollapseDepth}
                        onChange={setCollapseDepth}
                      />
                    )}
                  </span>
                  <ColumnResizeHandle onResizeStart={(clientX) => startResize(column.key, clientX)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {countVideoTreeLeaves(sortedTree) > 0 ? (
              sortedTree.map((node) => (
                <VideoTreeRows
                  key={`${effectiveCollapseDepth}-${node.key}`}
                  node={node}
                  depth={0}
                  collapseDepth={effectiveCollapseDepth}
                  context={context}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  No videos to show
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  )
}
