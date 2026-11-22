/**
 * @fileoverview A round's aff or neg argument text drawn as a list of
 * arguments, each with its category badge (K, CP, DA, T, Theory, FW) and a
 * `NEW` badge when the saved name said "new". Used by the watch page header,
 * the list view's team cells and the card thumbnail. See
 * `lib/argument-labels.ts` for how the text is split and classified.
 * @module components/videos/card/ArgumentLabels
 */

import { parseArgumentLabels } from "../../../lib/argument-labels"
import { cn } from "../../../ui/lib/utils"

/** Badge surfaces: `muted` on page backgrounds, `overlay` on dark thumbnails. */
type BadgeTone = "muted" | "overlay"

export function ArgumentLabels({
  text,
  tone = "muted",
  className,
}: {
  /** The saved `arg_1ac` / `arg_2nr` text. */
  text?: string | null
  tone?: BadgeTone
  className?: string
}) {
  const parts = parseArgumentLabels(text)
  if (parts.length === 0) return null
  const badge =
    tone === "overlay"
      ? "border-white/30 bg-white/15 text-white"
      : "border-current/30 bg-current/10"
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5", className)}>
      {parts.map((part, index) => (
        <span key={`${index}-${part.name}`} className="inline-flex items-center gap-1">
          {part.isNew && (
            <span
              title="New argument"
              className="rounded border border-amber-500/60 bg-amber-400/90 px-1 text-[0.625rem] font-bold uppercase leading-4 tracking-wide text-amber-950"
            >
              New
            </span>
          )}
          {part.category && (
            <span
              title={`${part.category} argument`}
              className={cn("rounded border px-1 text-[0.625rem] font-bold leading-4", badge)}
            >
              {part.category}
            </span>
          )}
          {part.name !== part.category && <span>{part.name}</span>}
          {index < parts.length - 1 && <span aria-hidden>,</span>}
        </span>
      ))}
    </span>
  )
}
