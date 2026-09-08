/**
 * @fileoverview Result card for a single piece of evidence in the CARDS search list.
 */

"use client"

import { useEffect, useRef } from "react"
import { Badge } from "../ui/primitives/badge"
import { BookOpen, Highlighter, Users } from "lucide-react"
import { getBlueShade, getGreenShade } from "debate-card-parser/src/utils/card-utils"
import {
  cardAriaLabel,
  cardPreview,
  cardProvenance,
  categoryStyle,
  formatCompactCount,
  highlightRatio,
  splitHighlightSegments,
} from "../lib/card-display"
import type { SearchResult } from "../types"

/**
 * Props for the SearchResultCard component
 */
interface SearchResultCardProps {
  /** The search result data to display */
  result: SearchResult
  /** Whether this card is currently selected */
  isSelected: boolean
  /** Callback invoked when the card is chosen by click or keyboard */
  onClick: () => void
  /** Zero-based position in the result list, used for the accessible label */
  index?: number
  /** Number of results in the list, used for the accessible label */
  total?: number
  /** Current search term, so matched words can be marked in the card */
  searchTerm?: string
}

/**
 * Renders text with the current query's terms marked.
 *
 * Showing *why* a card matched is what makes a long result list scannable —
 * without it, every row looks equally relevant.
 */
function Highlighted({ text, query }: { text: string; query: string }) {
  const segments = splitHighlightSegments(text, query)
  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark
            key={index}
            className="rounded-[2px] bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/30"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}

/**
 * SearchResultCard — one evidence card in the result list.
 *
 * Reads top-down in the order a debater triages evidence: the tag (the claim
 * the card makes), then who wrote it and when, then a preview of the summary
 * with the query's terms marked, then where the card has been run, then how
 * heavy it is to read. The category drives a colour accent so a disadvantage
 * is distinguishable from a counterplan before any text is read.
 *
 * The card is a real listbox option — reachable by Tab, selectable with Enter
 * or Space, labelled for screen readers, and scrolled back into view when
 * arrow keys move the selection off-screen.
 *
 * @param props - Component props
 * @returns The search result card component
 *
 * @example
 * ```tsx
 * <SearchResultCard
 *   result={searchResult}
 *   isSelected={selectedIndex === index}
 *   index={index}
 *   total={results.length}
 *   searchTerm={searchTerm}
 *   onClick={() => selectResult(searchResult, index)}
 * />
 * ```
 */
export function SearchResultCard({
  result,
  isSelected,
  onClick,
  index = 0,
  total = 1,
  searchTerm = "",
}: SearchResultCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const category = categoryStyle(result.category)
  const headline = result.tag?.trim() || result.argBlock?.trim() || "Untitled card"
  const preview = cardPreview(result)
  const provenance = cardProvenance(result)
  const ratio = highlightRatio(result)

  // Arrow-key navigation can move the selection past either end of the
  // scrollport; without this the selected card is only visible in the reader.
  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView({ block: "nearest" })
  }, [isSelected])

  return (
    <div
      ref={ref}
      role="option"
      aria-selected={isSelected}
      aria-label={cardAriaLabel(result, index + 1, total)}
      tabIndex={0}
      data-testid="search-result-card"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
      className={`group relative flex cursor-pointer gap-0 overflow-hidden rounded-lg border bg-card text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/50 hover:shadow-md"
      }`}
    >
      {/* Category accent — the fastest signal in the list. */}
      <span aria-hidden="true" className={`w-1 shrink-0 ${category.accent}`} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        {/* Tag: the claim the card makes, and the reason to open it. */}
        <p className="line-clamp-2 text-sm leading-snug font-semibold">
          <Highlighted text={headline} query={searchTerm} />
        </p>

        {/* Citation and category */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className={`px-1.5 py-0 text-[10px] font-semibold ${category.badge}`}>
            {category.label}
          </Badge>
          {result.cite_short && (
            <span className="truncate text-xs font-medium text-foreground/80">
              <Highlighted text={result.cite_short} query={searchTerm} />
            </span>
          )}
          {result.researchField && (
            <span className="truncate text-xs text-muted-foreground">{result.researchField}</span>
          )}
        </div>

        {/* Summary preview with the query's terms marked */}
        {preview && preview !== headline && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            <Highlighted text={preview} query={searchTerm} />
          </p>
        )}

        {/* Where the card has been run */}
        {provenance.length > 0 && (
          <p className="truncate text-[11px] text-muted-foreground">{provenance.join(" • ")}</p>
        )}

        {/* Reading cost: how often it is used, how long it is, how much is highlighted */}
        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant="outline"
            className={`gap-1 border-0 px-1.5 py-0 ${getBlueShade(result.readCount)}`}
            title={`${result.readCount?.toLocaleString() ?? 0} reads`}
          >
            <Users className="h-3 w-3" aria-hidden="true" />
            <span className="text-[10px]">{formatCompactCount(result.readCount)}</span>
          </Badge>
          <Badge
            variant="outline"
            className={`gap-1 border-0 px-1.5 py-0 ${getGreenShade(result.word_count)}`}
            title={`${result.word_count?.toLocaleString() ?? 0} words`}
          >
            <BookOpen className="h-3 w-3" aria-hidden="true" />
            <span className="text-[10px]">{formatCompactCount(result.word_count)}</span>
          </Badge>
          {ratio !== null && (
            <Badge
              variant="outline"
              className="gap-1 px-1.5 py-0 text-muted-foreground"
              title={`${Math.round(ratio * 100)}% of the card is highlighted`}
            >
              <Highlighter className="h-3 w-3" aria-hidden="true" />
              <span className="text-[10px]">{Math.round(ratio * 100)}%</span>
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
