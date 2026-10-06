/**
 * @fileoverview The debate-format chip (PF, LD, Policy, College) drawn beside
 * a tournament name in the list layout, in the same colours the cards and the
 * player's title bar use for a format.
 *
 * Shown where a listing mixes formats — Top Picks spans every one — so a
 * tournament row says which format its rounds were without opening them.
 * @module components/video-grid/FormatBadge
 */

import { cn } from "../../ui/lib/utils"
import { DEBATE_STYLE_LABELS, STYLE_COLORS } from "../video-card/videoCardUtils"
import type { VideoType } from "../../types/videos"

/** The video's numeric debate format, or `undefined` for a lecture. */
export function videoFormat(video: VideoType): number | undefined {
  const style = video[6]
  return typeof style === "number" && style in DEBATE_STYLE_LABELS ? style : undefined
}

/** One format chip; renders nothing for an unknown format. */
export function FormatBadge({ style, className }: { style: number | undefined; className?: string }) {
  if (style === undefined) return null
  const label = DEBATE_STYLE_LABELS[style as keyof typeof DEBATE_STYLE_LABELS]
  if (!label) return null
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide leading-none",
        STYLE_COLORS[style] ?? "bg-muted text-muted-foreground",
        className,
      )}
      data-testid="format-badge"
    >
      {label}
    </span>
  )
}
