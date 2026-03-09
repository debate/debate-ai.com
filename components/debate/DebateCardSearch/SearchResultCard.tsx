/**
 * @fileoverview Compact card component for displaying individual research search results.
 */

"use client"


import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Clock } from "lucide-react"
import { getBlueShade, getGreenShade } from "@/lib/card-parser/utils/card-utils"
import type { SearchResult } from "@/components/debate/DebateCardSearch/types"

/**
 * Props for the SearchResultCard component
 */
interface SearchResultCardProps {
  /** The search result data to display */
  result: SearchResult
  /** Whether this card is currently selected */
  isSelected: boolean
  /** Callback invoked when the card is clicked */
  onClick: () => void
}

/**
 * SearchResultCard - Compact search result display
 *
 * Renders a single research evidence result as a clickable card.
 * Uses color-coded badges for read count and word count metrics.
 *
 * @param props - Component props
 * @param props.result - The search result data to display
 * @param props.isSelected - Whether this card is currently selected
 * @param props.onClick - Callback invoked when the card is clicked
 * @returns The search result card component
 *
 * @example
 * ```tsx
 * <SearchResultCard
 *   result={searchResult}
 *   isSelected={selectedId === searchResult.id}
 *   onClick={() => selectResult(searchResult)}
 * />
 * ```
 */
export function SearchResultCard({ result, isSelected, onClick }: SearchResultCardProps) {
  console.log("[v0] Rendering ResultCard:", result.id, result.summary.substring(0, 30))

  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition-all hover:shadow-md border-2 ${isSelected ? "border-primary bg-muted" : "border-border hover:border-primary/50"
        }`}
    >
      <CardContent className="p-4">
        {/* Header row with category, research field, and metrics */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category badge */}
            <Badge variant="secondary" className="text-xs">
              {result.category}
            </Badge>
            {/* Research field */}
            <span className="font-bold text-sm">{result.researchField}</span>
          </div>

          {/* Metrics badges */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Read count with blue color coding */}
            <Badge variant="outline" className={`gap-1 ${getBlueShade(result.readCount)}`}>
              <Users className="h-3 w-3" />
              <span className="text-xs">{result.readCount}</span>
            </Badge>
            {/* Word count with green color coding */}
            <Badge variant="outline" className={`gap-1 ${getGreenShade(result.word_count)}`}>
              <Clock className="h-3 w-3" />
              <span className="text-xs">{result.word_count}</span>
            </Badge>
          </div>
        </div>

        {/* Argument block name */}
        <p className="text-sm text-muted-foreground mb-2 font-medium">{result.argBlock}</p>

        {/* Summary (truncated to 2 lines) */}
        <p className="text-sm mb-2 line-clamp-2">{result.summary}</p>

        {/* Debate metadata */}
        {(result as any).school && (
          <p className="text-xs text-muted-foreground truncate mb-1">
            {[(result as any).tournament, (result as any).team, (result as any).side, `20${(result as any).year || ""}`]
              .filter(Boolean)
              .join(" \u2022 ")}
          </p>
        )}

        {/* Tag line (truncated) */}
        <p className="text-xs text-muted-foreground truncate">{result.tag}</p>
      </CardContent>
    </Card>
  )
}
