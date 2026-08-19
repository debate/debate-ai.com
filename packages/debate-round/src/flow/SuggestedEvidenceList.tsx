/**
 * @fileoverview Ranked "Suggested evidence" list rendered inside
 * `EditReviewPopover` — part of idea #16's follow-up (c) in TODO.md. Kept
 * as its own pure/props-driven component (rather than inlined in the
 * popover) so it stays render-testable the same way `EditBadge` is, since
 * `EditReviewPopover` itself touches `window`/`document` directly and has
 * no render test of its own.
 */

"use client"

import type { EvidenceSearchResult } from "debate-card-search/src/lib/shared-evidence-library"

export interface SuggestedEvidenceListProps {
  results: EvidenceSearchResult[]
  onInsert: (result: EvidenceSearchResult) => void
}

/**
 * Renders nothing when there are no matches (a box's popover shouldn't
 * show an empty "Suggested evidence" section before the contributor has
 * typed anything worth matching against). Each match shows its argument
 * block, citation, and a one-line snippet of its full text, with an
 * "Insert" button that hands the result back to the caller — this
 * component never mutates anything itself, matching the "suggest, not
 * auto-apply" requirement.
 */
export function SuggestedEvidenceList({ results, onInsert }: SuggestedEvidenceListProps) {
  if (results.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Suggested evidence
      </span>
      <ul className="flex max-h-24 flex-col gap-1 overflow-y-auto text-xs">
        {results.map((result) => (
          <li
            key={result.entry.id}
            className="flex items-start justify-between gap-1 rounded bg-muted/50 px-1.5 py-1"
          >
            <span className="min-w-0 flex-1 truncate" title={result.entry.text || result.entry.argBlock}>
              <span className="font-medium">{result.entry.argBlock}</span>
              {result.entry.cite ? ` (${result.entry.cite})` : ""}
            </span>
            <button
              type="button"
              className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground hover:bg-secondary/80"
              onClick={() => onInsert(result)}
            >
              Insert
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
