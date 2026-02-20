"use client"

/**
 * @fileoverview Research Search Sidebar Component
 *
 * Search interface for finding research evidence cards.
 * Features:
 * - Full-text search input
 * - Sort options (relevance, most read, newest/oldest, length)
 * - Scrollable results list
 * - Loading and empty states
 * - Mobile-responsive with close button
 *
 * @module components/debate/research/ResearchSearchSidebar
 */

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X } from "lucide-react"
import { SearchResultCard } from "./SearchResultCard"
import { Button } from "@/components/ui/button"

/**
 * Type definition for search result data
 */
type SearchResult = {
  /** Unique identifier */
  id: number
  /** Evidence category */
  category: string
  /** Research field/topic */
  researchField: string
  /** Argument block name */
  argBlock: string
  /** Short summary of the evidence */
  summary: string
  /** Short citation (author year) */
  cite_short: string
  /** Full citation */
  cite: string
  /** Number of times this card has been read */
  readCount: number
  /** Length of highlighted text in characters */
  highlightLength: number
  /** Total text length */
  textLength: number
  /** Word count */
  word_count: number
  /** HTML content of the card */
  html: string
  /** Tag line */
  tag: string
  /** Publication year */
  year: string
  /** Page reference */
  page: string
}

/**
 * Props for the ResearchSearchSidebar component
 */
interface ResearchSearchSidebarProps {
  /** Current search term */
  searchTerm: string
  /** Callback to update search term */
  setSearchTerm: (term: string) => void
  /** Current sort option */
  sortBy: string
  /** Callback to update sort option */
  setSortBy: (sort: string) => void
  /** Array of search results */
  searchResults: SearchResult[]
  /** Index of currently selected result */
  selectedIndex: number
  /** Callback when a result is selected */
  selectResult: (result: SearchResult, index: number) => void
  /** Whether results are loading */
  isLoading: boolean
  /** Optional callback to close sidebar (mobile) */
  onClose?: () => void
}

/**
 * ResearchSearchSidebar - Search and browse research evidence
 *
 * Provides a sidebar interface for searching the evidence database
 * with filtering, sorting, and result selection.
 *
 * @param props - Component props
 * @returns The research search sidebar component
 *
 * @example
 * ```tsx
 * <ResearchSearchSidebar
 *   searchTerm={query}
 *   setSearchTerm={setQuery}
 *   sortBy={sortOption}
 *   setSortBy={setSortOption}
 *   searchResults={results}
 *   selectedIndex={selectedIdx}
 *   selectResult={handleSelect}
 *   isLoading={loading}
 * />
 * ```
 */
export function ResearchSearchSidebar({
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  searchResults,
  selectedIndex,
  selectResult,
  isLoading,
  onClose,
}: ResearchSearchSidebarProps) {
  console.log("[v0] SearchSidebar render - results:", searchResults.length, "isLoading:", isLoading)

  return (
    <div className="w-full md:w-80 h-full flex flex-col border-r bg-background">
      {/* Search controls header */}
      <div className="p-3 border-b space-y-2">
        {/* Mobile header with close button */}
        <div className="flex items-center justify-between md:hidden mb-2">
          <h2 className="font-semibold text-lg">Search</h2>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search research cards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Sort selector */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_text_match:desc">Relevance</SelectItem>
            <SelectItem value="readCount:desc">Most Read</SelectItem>
            <SelectItem value="year:asc">Oldest</SelectItem>
            <SelectItem value="year:desc">Newest</SelectItem>
            <SelectItem value="highlightLength:asc">Shortest</SelectItem>
            <SelectItem value="highlightLength:desc">Longest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          // Loading state
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : searchResults.length === 0 ? (
          // Empty state
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No results found</div>
        ) : (
          // Results list
          <>
            {console.log("[v0] Rendering", searchResults.length, "result cards")}
            {searchResults.map((result, index) => (
              <SearchResultCard
                key={result.id}
                result={result}
                isSelected={selectedIndex === index}
                onClick={() => selectResult(result, index)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
