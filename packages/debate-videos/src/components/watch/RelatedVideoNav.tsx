/**
 * @fileoverview Step between the related videos without leaving the player.
 *
 * The watch page listed the related videos below the fold and nowhere else,
 * so moving through a tournament's rounds meant scrolling past the player
 * for every one of them. This is the same list as a control: previous, the
 * position in it, next — and it wraps, so the end of the list rotates back
 * to its start rather than dead-ending.
 *
 * The order is the related rows' own default, newest first, so `Next` is the
 * row under the one you are watching rather than some hidden feed order.
 *
 * ← and → drive it from the keyboard. They are free to: YouTube's own seek
 * shortcuts fire inside the iframe, whose keystrokes never reach this
 * document, and the handler stands down while a field has focus or a
 * modifier is held, so browser history (Alt+←) and text editing still work.
 * @module components/watch/RelatedVideoNav
 */

"use client"

import { useEffect, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "../../ui/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/primitives/tooltip"
import type { VideoType } from "../../types/videos"

/**
 * The ring this control rotates through: the video on screen, then the
 * related videos newest first — the order their rows are listed in.
 *
 * @param current - The video being watched.
 * @param related - Its related videos, in feed order.
 * @returns The ring, always opening on `current`.
 */
export function buildRelatedRing(current: VideoType, related: VideoType[]): VideoType[] {
  const others = related
    .filter((video) => video[0] !== current[0])
    .sort((a, b) => (new Date(b[2]).getTime() || 0) - (new Date(a[2]).getTime() || 0))
  return [current, ...others]
}

/** The neighbour `step` places away, wrapping at both ends. */
export function ringNeighbour(ring: VideoType[], index: number, step: number): VideoType | null {
  if (ring.length < 2) return null
  return ring[(index + step + ring.length) % ring.length]
}

/** Whether a keystroke is meant for the page rather than for a field. */
function isPageKeystroke(event: KeyboardEvent): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false
  const target = event.target as HTMLElement | null
  if (!target) return true
  if (target.isContentEditable) return false
  return !/^(input|textarea|select)$/i.test(target.tagName)
}

export function RelatedVideoNav({
  current,
  related,
  onSelect,
  className,
}: {
  current: VideoType
  related: VideoType[]
  /** Hands back the video to play; the page turns that into a navigation. */
  onSelect: (video: VideoType) => void
  className?: string
}) {
  // The ring always opens on the video being watched, so it sits at 0 and
  // `previous` is the last entry — the wrap the control is named for.
  const ring = useMemo(() => buildRelatedRing(current, related), [current, related])
  const previous = ringNeighbour(ring, 0, -1)
  const next = ringNeighbour(ring, 0, 1)

  useEffect(() => {
    if (!previous && !next) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isPageKeystroke(event)) return
      const target =
        event.key === "ArrowLeft" ? previous : event.key === "ArrowRight" ? next : null
      if (!target) return
      event.preventDefault()
      onSelect(target)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [previous, next, onSelect])

  if (!previous || !next) return null

  return (
    <nav
      aria-label="Related videos"
      className={cn("flex items-center justify-between gap-2 text-xs", className)}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(previous)}
            aria-label={`Previous related video: ${previous[1]}`}
            className="flex min-w-0 items-center gap-1 rounded border border-border px-2 py-1 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[12rem] truncate">{previous[1]}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Previous related video (←)</TooltipContent>
      </Tooltip>

      <span className="shrink-0 tabular-nums text-muted-foreground">
        {ring.length - 1} related
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(next)}
            aria-label={`Next related video: ${next[1]}`}
            className="flex min-w-0 items-center gap-1 rounded border border-border px-2 py-1 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <span className="max-w-[12rem] truncate">{next[1]}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Next related video (→)</TooltipContent>
      </Tooltip>
    </nav>
  )
}
