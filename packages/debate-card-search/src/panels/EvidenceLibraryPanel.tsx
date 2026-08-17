/**
 * @fileoverview Shared Evidence Library search panel — the UI follow-up
 * named "(a) a search panel UI" under the "Shared Evidence Library" bullet
 * in TODO.md.
 *
 * Reads the persisted evidence repository via
 * `state/evidenceLibraryEntries.ts`'s `searchPersistedEvidenceLibrary`
 * (itself a thin composition of `shared-evidence-library.ts`'s pure
 * `searchEvidenceLibrary` against the persisted store) and renders a
 * free-text/kind search box over it, reusing the existing search/ranking
 * logic directly rather than introducing new logic here.
 *
 * @module panels/EvidenceLibraryPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import {
  listEvidenceLibraryEntries,
  searchPersistedEvidenceLibrary,
} from "../state/evidenceLibraryEntries"
import { buildEvidenceSearchSummaryText } from "../lib/shared-evidence-library"
import type { EvidenceEntryKind, EvidenceSearchResult } from "../lib/shared-evidence-library"

const KIND_FILTERS: { value: EvidenceEntryKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "card", label: "Cards" },
  { value: "block", label: "Blocks" },
]

const KIND_VARIANT: Record<EvidenceEntryKind, "default" | "secondary"> = {
  card: "default",
  block: "secondary",
}

/**
 * Renders the Shared Evidence Library: a free-text search box and a
 * card/block kind filter over every persisted `EvidenceLibraryEntry`,
 * ranked by keyword relevance when a text query is present.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function EvidenceLibraryPanel() {
  const [hasEntries, setHasEntries] = useState<boolean | null>(null)
  const [queryText, setQueryText] = useState("")
  const [kind, setKind] = useState<EvidenceEntryKind | "all">("all")
  const [results, setResults] = useState<EvidenceSearchResult[]>([])

  useEffect(() => {
    setHasEntries(listEvidenceLibraryEntries().length > 0)
  }, [])

  useEffect(() => {
    if (hasEntries === null) return
    const query = { text: queryText, ...(kind !== "all" ? { kind } : {}) }
    setResults(searchPersistedEvidenceLibrary(query))
  }, [hasEntries, queryText, kind])

  if (hasEntries === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading evidence library…</div>
  }

  if (!hasEntries) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No evidence library entries yet. The library fills in as cards and reusable blocks are
        submitted to the team repository.
      </div>
    )
  }

  const summaryQuery = { text: queryText, ...(kind !== "all" ? { kind } : {}) }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Shared Evidence Library</h1>
        <p className="text-sm text-muted-foreground">
          Search cut cards and reusable analytic blocks by keyword, citation, or argument.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          placeholder="Search by keyword, argument, or citation…"
          aria-label="Search the evidence library"
          className="sm:max-w-sm"
        />
        <div className="flex gap-1">
          {KIND_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={kind === filter.value ? "default" : "outline"}
              onClick={() => setKind(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{buildEvidenceSearchSummaryText(results, summaryQuery)}</p>
      {results.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No entries match this search.
        </div>
      ) : (
        <div className="space-y-2">
          {results.map(({ entry, relevanceScore }) => (
            <div key={entry.id} className="rounded-lg border border-border p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{entry.argBlock}</span>
                <Badge variant={KIND_VARIANT[entry.kind]} className="capitalize">
                  {entry.kind}
                </Badge>
                {entry.topic && (
                  <Badge variant="outline">{entry.topic}</Badge>
                )}
                {entry.caseArea && (
                  <Badge variant="outline">{entry.caseArea}</Badge>
                )}
                {queryText.trim() && (
                  <span className="text-xs text-muted-foreground">relevance {relevanceScore}</span>
                )}
              </div>
              <p className="mb-2 text-sm text-muted-foreground">{entry.text}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {entry.cite && <span className="font-medium">{entry.cite}</span>}
                {entry.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
