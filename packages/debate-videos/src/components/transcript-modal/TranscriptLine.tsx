/**
 * @fileoverview One clickable transcript line with an approximate
 * karaoke-style per-word highlight sweep while it's the active line.
 */

"use client"

import { forwardRef, useMemo } from "react"
import { cn } from "../../ui/lib/utils"
import { formatTime, type TranscriptSnippet } from "./transcriptUtils"

interface TranscriptLineProps {
  snippet: TranscriptSnippet
  isActive: boolean
  currentTime: number
  onSeek: () => void
  /** Tighter padding/type size for the popout player's subtitles panel. */
  compact?: boolean
}

export const TranscriptLine = forwardRef<HTMLButtonElement, TranscriptLineProps>(
  function TranscriptLine({ snippet, isActive, currentTime, onSeek, compact }, ref) {
    const words = useMemo(() => snippet.text.split(/\s+/).filter(Boolean), [snippet.text])

    // Words don't carry their own timestamps — approximate a karaoke-style
    // sweep by spreading the snippet's duration evenly across its words.
    const activeWordIndex =
      isActive && snippet.duration > 0
        ? Math.min(
            words.length - 1,
            Math.max(0, Math.floor(((currentTime - snippet.start) / snippet.duration) * words.length)),
          )
        : -1

    return (
      <button
        ref={ref}
        onClick={(e) => {
          e.stopPropagation()
          onSeek()
        }}
        className={cn(
          "w-full text-left rounded transition-colors flex gap-2",
          compact ? "px-1.5 py-1 text-xs" : "px-2 py-1.5 text-sm",
          isActive ? "bg-primary/10" : "hover:bg-accent/60",
        )}
      >
        <span
          className={cn(
            "shrink-0 tabular-nums text-muted-foreground pt-0.5",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          {formatTime(snippet.start)}
        </span>
        <span className="text-foreground">
          {words.map((word, i) => (
            <span
              key={i}
              className={cn(i === activeWordIndex && "bg-primary/30 rounded px-0.5 font-medium text-primary")}
            >
              {word}{" "}
            </span>
          ))}
        </span>
      </button>
    )
  },
)
