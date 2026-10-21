/**
 * @fileoverview Signpost button on a speech row in the round sidebar. Hovering
 * (or focusing) it shows the speech's signposting: the H1 and H2 heading
 * names of its speech doc, H2s indented under their H1. H3 blocks and H4 card
 * tags are left out (see `utils/speech-signposts.ts`). A long outline scrolls
 * inside the tooltip, which can be hovered, instead of running off screen.
 */

"use client"

import { Signpost } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/primitives/tooltip"
import { cn } from "../ui/lib/utils"
import type { SpeechDocHeading } from "../utils/speech-doc-headings"

/** Tailwind left padding per heading level, so H2s nest under H1s. */
const LEVEL_INDENT: Record<number, string> = { 1: "pl-0 font-semibold", 2: "pl-3" }

export function SpeechSignpostButton({
  speechName,
  signposts,
}: {
  speechName: string
  signposts: readonly SpeechDocHeading[]
}) {
  const empty = signposts.length === 0
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${speechName} signposts`}
          data-empty={empty || undefined}
          className={cn(
            "flex shrink-0 items-center rounded-[var(--border-radius)] px-1 py-0.5 hover:bg-[var(--background-indent)]",
            empty ? "text-muted-foreground/60" : "text-muted-foreground",
          )}
        >
          <Signpost className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="start"
        collisionPadding={8}
        className="w-max max-w-[min(26rem,calc(100vw-2rem))] px-2.5 py-1.5 text-left text-[11px] text-wrap"
      >
        <p className="pb-1 font-bold">{speechName} signposts</p>
        {empty ? (
          <p className="opacity-80">No H1 or H2 headings in this speech doc yet.</p>
        ) : (
          // Scroll an inner box so the tooltip's arrow, outside it, isn't clipped.
          <ul
            className="flex max-h-[min(60vh,28rem)] flex-col gap-px overflow-y-auto overscroll-contain pr-1"
            aria-label={`${speechName} headings`}
          >
            {signposts.map((h, i) => (
              <li key={i} data-level={h.level} className={cn("leading-tight break-words", LEVEL_INDENT[h.level])}>
                {h.text}
              </li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
