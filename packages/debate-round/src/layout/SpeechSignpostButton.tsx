/**
 * @fileoverview Signpost button on a speech row in the round sidebar. Hovering
 * (or focusing) it shows the speech's signposting: the H1, H2 and H3 heading
 * names of its speech doc, indented by level. H4 tags — the long sentence
 * summaries on each card — are left out (see `utils/speech-signposts.ts`).
 */

"use client"

import { Signpost } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/primitives/tooltip"
import { cn } from "../ui/lib/utils"
import type { SpeechDocHeading } from "../utils/speech-doc-headings"

/** Tailwind left padding per heading level, so H2s and H3s nest under H1s. */
const LEVEL_INDENT: Record<number, string> = { 1: "pl-0 font-semibold", 2: "pl-3", 3: "pl-6 opacity-90" }

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
      <TooltipContent side="right" align="start" className="max-w-72 text-left text-wrap">
        <p className="pb-1 font-bold">{speechName} signposts</p>
        {empty ? (
          <p className="opacity-80">No H1–H3 headings in this speech doc yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5" aria-label={`${speechName} headings`}>
            {signposts.map((h, i) => (
              <li key={i} data-level={h.level} className={cn("leading-snug", LEVEL_INDENT[h.level])}>
                {h.text}
              </li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
