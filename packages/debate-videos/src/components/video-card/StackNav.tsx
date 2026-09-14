/**
 * @fileoverview The `<` / `>` control that flips a stacked playlist.
 *
 * One control, two layouts: the card grid pins it over the top-left corner of
 * the card (`variant="overlay"`) and the dense row list drops it inline at the
 * start of the actions cell (`variant="inline"`). Both render the same thing —
 * an arrow either side of a position counter, with the current member's kind
 * ("Round", "Round Analysis") as the label — so a stack reads the same
 * whichever layout the user is in.
 *
 * The buttons stop propagation: in the row list the whole row is a click
 * target that starts playback, and flipping to the companion video must not
 * also start playing the one being flipped away from.
 * @module components/video-card/StackNav
 */

"use client"

import { ChevronLeft, ChevronRight, Layers } from "lucide-react"
import { cn } from "../../ui/lib/utils"
import { DEBATE_STYLE_LABELS, type VideoType } from "../../types/videos"

/** Props for the {@link StackNav} control. */
export interface StackNavProps {
  /** Zero-based index of the member on screen. */
  index: number
  /** How many videos the stack holds. */
  count: number
  /** Short label for the current member, e.g. its category or format. */
  label?: string
  /** Called with the index to move to; the caller wraps at both ends. */
  onSelect: (index: number) => void
  /** `"overlay"` floats over a card; `"inline"` sits in a row of buttons. */
  variant?: "overlay" | "inline"
  className?: string
}

/**
 * Renders the stack's position counter and its two flip arrows.
 *
 * @param props - See {@link StackNavProps}.
 */
export function StackNav({
  index,
  count,
  label,
  onSelect,
  variant = "overlay",
  className,
}: StackNavProps) {
  if (count < 2) return null

  const go = (next: number) => (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    // Wraps in both directions: a two-video stack is flipped back and forth
    // with whichever arrow is under the cursor.
    onSelect((next + count) % count)
  }

  const arrowClass =
    "flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "flex items-center gap-0.5 text-[11px] font-medium",
        variant === "overlay"
          ? "rounded-md border border-border bg-background/90 px-1 py-0.5 shadow-sm backdrop-blur-sm"
          : "rounded border border-border/60 px-1",
        className,
      )}
    >
      <Layers className="mr-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />

      <button
        type="button"
        onClick={go(index - 1)}
        className={arrowClass}
        aria-label="Previous video in this stacked playlist"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      <span className="tabular-nums whitespace-nowrap text-muted-foreground">
        {index + 1}/{count}
      </span>

      <button
        type="button"
        onClick={go(index + 1)}
        className={arrowClass}
        aria-label="Next video in this stacked playlist"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {label && (
        <span className="ml-0.5 max-w-[9rem] truncate text-muted-foreground" title={label}>
          {label}
        </span>
      )}
    </div>
  )
}

/**
 * Names what a stack member is, for the control's label: the debate format for
 * a round, the lecture category otherwise ("Round Analysis" being the one this
 * feature exists for).
 *
 * @param video - The member on screen, as a tuple.
 * @returns A short label, or `undefined` when the video carries neither.
 */
export function stackMemberLabel(video: VideoType): string | undefined {
  const value = video[6]
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number") {
    const style = DEBATE_STYLE_LABELS[value as keyof typeof DEBATE_STYLE_LABELS]
    return style ? `${style} round` : "Full round"
  }
  return undefined
}
