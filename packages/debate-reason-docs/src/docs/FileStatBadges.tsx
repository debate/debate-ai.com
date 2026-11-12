/**
 * @fileoverview The small quote and block count badges a file row shows
 * between its icon and its name, in both the Topic Starters tree and My
 * Personal Documents. The same numbers are in the row's hover text
 * (`lib/file-stats/file-stats.ts#formatFileHoverText`); a count of zero, or
 * one not counted yet, shows no badge so empty rows stay quiet. Badges are
 * numbers only (no icons); quotes are tinted primary, blocks muted.
 *
 * @module docs/FileStatBadges
 */

import { cn } from "../ui/lib/utils"

export interface FileStatBadgesProps {
  quoteCount?: number | null
  blockCount?: number | null
  className?: string
}

const BADGE = "inline-flex h-4 shrink-0 items-center rounded px-1 text-[10px] font-medium leading-none tabular-nums"

/** Quote and block counts as badges; renders nothing when both are zero. */
export function FileStatBadges({ quoteCount, blockCount, className }: FileStatBadgesProps) {
  const quotes = quoteCount ?? 0
  const blocks = blockCount ?? 0
  if (quotes <= 0 && blocks <= 0) return null
  return (
    <span className={cn("flex shrink-0 items-center gap-0.5", className)}>
      {quotes > 0 && (
        <span className={cn(BADGE, "bg-primary/10 text-primary")} aria-label={`${quotes} ${quotes === 1 ? "quote" : "quotes"}`} data-testid="file-quote-badge">
          {quotes.toLocaleString("en-US")}
        </span>
      )}
      {blocks > 0 && (
        <span className={cn(BADGE, "bg-muted text-muted-foreground")} aria-label={`${blocks} ${blocks === 1 ? "block" : "blocks"}`} data-testid="file-block-badge">
          {blocks.toLocaleString("en-US")}
        </span>
      )}
    </span>
  )
}
