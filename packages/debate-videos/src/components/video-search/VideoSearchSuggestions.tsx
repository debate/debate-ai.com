/**
 * @fileoverview Popular-search chips shown under the video grid.
 *
 * Two rows of one-click searches drawn from the library itself: curated debate
 * keywords that actually have matching videos, and the tournament names the
 * library carries the most rounds from. Clicking a chip runs it as a search.
 * @module components/debate/DebateVideos/components/video-search/VideoSearchSuggestions
 */

"use client"

import React from "react"
import { Hash, Trophy } from "lucide-react"
import type { VideoSuggestion, VideoSuggestions } from "../../types/videos"
import { cn } from "../../ui/lib/utils"

/** Props for the {@link VideoSearchSuggestions} component. */
interface VideoSearchSuggestionsProps {
  /** Keyword and tournament chips from `/api/videos/meta`. */
  suggestions: VideoSuggestions
  /** Active search term, so the matching chip can be highlighted. */
  searchTerm?: string
  /** Runs the chip's label as a search. */
  onSelect: (term: string) => void
  /** Extra classes for the wrapper. */
  className?: string
}

/** Formats a chip's match count the same way the quick-link cards do. */
function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

/** One row of chips with its heading; renders nothing when the row is empty. */
function SuggestionRow({
  title,
  icon,
  items,
  searchTerm,
  onSelect,
}: {
  title: string
  icon: React.ReactNode
  items: VideoSuggestion[]
  searchTerm?: string
  onSelect: (term: string) => void
}) {
  if (items.length === 0) return null

  const active = searchTerm?.trim().toLowerCase()

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const isActive = active === item.label.toLowerCase()
          return (
            <button
              key={`${item.kind}-${item.label}`}
              type="button"
              onClick={() => onSelect(item.label)}
              aria-pressed={isActive}
              title={`Search ${item.label} — ${item.count} video${item.count === 1 ? "" : "s"}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10",
                isActive && "border-primary/60 bg-primary/15",
              )}
            >
              <span className="truncate max-w-[14rem]">{item.label}</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {formatCount(item.count)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Renders the popular keyword and tournament searches.
 *
 * @param props - See {@link VideoSearchSuggestionsProps}.
 */
export function VideoSearchSuggestions({
  suggestions,
  searchTerm,
  onSelect,
  className,
}: VideoSearchSuggestionsProps) {
  const { keywords = [], tournaments = [] } = suggestions ?? {}
  if (keywords.length === 0 && tournaments.length === 0) return null

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <SuggestionRow
        title="Popular searches"
        icon={<Hash className="h-3.5 w-3.5" />}
        items={keywords}
        searchTerm={searchTerm}
        onSelect={onSelect}
      />
      <SuggestionRow
        title="Tournaments"
        icon={<Trophy className="h-3.5 w-3.5" />}
        items={tournaments}
        searchTerm={searchTerm}
        onSelect={onSelect}
      />
    </div>
  )
}
