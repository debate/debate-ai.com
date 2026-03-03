"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Search, X, ChevronDown, ChevronUp } from "lucide-react"
import { SearchResultCard } from "./SearchResultCard"
import { Button } from "@/components/ui/button"
import type { SearchResult } from "@/components/debate/SharedResearch/types"
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select"

export interface SearchFilters {
  year: string
  school: string
  team: string
  tournament: string
  event: string
  searchHighlighted: boolean
  searchUnderlined: boolean
  searchSummaries: boolean
  searchBlockTitles: boolean
  searchFileTitles: boolean
  searchOutlines: boolean
  searchRoundSpeeches: boolean
  searchAllText: boolean
}

interface ResearchSearchSidebarProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  sortBy: string
  setSortBy: (sort: string) => void
  filters: SearchFilters
  setFilters: (filters: SearchFilters) => void
  searchResults: SearchResult[]
  selectedIndex: number
  selectResult: (result: SearchResult, index: number) => void
  totalResults: number
  isLoading: boolean
  onClose?: () => void
}

export function ResearchSearchSidebar({
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  filters,
  setFilters,
  searchResults,
  selectedIndex,
  selectResult,
  totalResults,
  isLoading,
  onClose,
}: ResearchSearchSidebarProps) {
  const [showMoreFilters, setShowMoreFilters] = useState(false)

  const updateFilter = (key: keyof SearchFilters, value: string | boolean) => {
    setFilters({ ...filters, [key]: value })
  }

  const currentYear = new Date().getFullYear()
  const maxYear = Math.max(currentYear, 2026)
  const years = Array.from({ length: maxYear - 2001 }, (_, i) => String(maxYear - i))

  const activeFilterCount = Object.values(filters).filter((v) => v && v !== "all").length

  return (
    <div className="w-full md:w-80 h-full flex flex-col border-r bg-background">
      <div className="p-3 border-b space-y-2">
        {/* Mobile header */}
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
            placeholder="Search cards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Sort + Advanced toggle */}
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-7 text-xs flex-1">
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
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 shrink-0"
            onClick={() => setShowMoreFilters(!showMoreFilters)}
          >
            {showMoreFilters ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            Advanced
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Advanced filters (hidden by default) */}
        {showMoreFilters && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Select value={filters.year || "all"} onValueChange={(v) => updateFilter("year", v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Seasons</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {Number(y) - 1}-{y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.event || "all"} onValueChange={(v) => updateFilter("event", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="CX">CX</SelectItem>
                  <SelectItem value="LD">LD</SelectItem>
                  <SelectItem value="PF">PF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="School"
                value={filters.school}
                onChange={(e) => updateFilter("school", e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Team (ex. HaDa)"
                value={filters.team}
                onChange={(e) => updateFilter("team", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Input
              placeholder="Tournament"
              value={filters.tournament}
              onChange={(e) => updateFilter("tournament", e.target.value)}
              className="h-8 text-xs"
            />
            <div className="pt-1">
              <MultiSelect
                label="Search in"
                placeholder="Search in"
                options={[
                  { value: "searchHighlighted", label: "Highlighted" },
                  { value: "searchUnderlined", label: "Underlined" },
                  { value: "searchSummaries", label: "Summaries" },
                  { value: "searchBlockTitles", label: "Block Titles" },
                  { value: "searchFileTitles", label: "File Titles" },
                  { value: "searchOutlines", label: "Outlines" },
                  { value: "searchRoundSpeeches", label: "Round Speeches" },
                  { value: "searchAllText", label: "Search All Text" },
                ]}
                selected={Object.entries(filters)
                  .filter(([key, value]) => key.startsWith("search") && value === true)
                  .map(([key]) => key)}
                onChange={(selectedKeys) => {
                  const newFilters = { ...filters }
                    // Reset all search flags first
                    ; ([
                      "searchHighlighted",
                      "searchUnderlined",
                      "searchSummaries",
                      "searchBlockTitles",
                      "searchFileTitles",
                      "searchOutlines",
                      "searchRoundSpeeches",
                      "searchAllText",
                    ] as const).forEach((key) => {
                      newFilters[key] = false
                    })
                  // Set selected flags
                  selectedKeys.forEach((key) => {
                    if (key in newFilters) {
                      ; (newFilters as any)[key] = true
                    }
                  })
                  setFilters(newFilters)
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results count + list */}
      <div className="px-3 py-1.5 text-xs text-muted-foreground flex justify-between border-b">
        <span>{searchResults.length} shown</span>
        <span>{totalResults} total</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No results found</div>
        ) : (
          searchResults.map((result, index) => (
            <SearchResultCard
              key={result.id}
              result={result}
              isSelected={selectedIndex === index}
              onClick={() => selectResult(result, index)}
            />
          ))
        )}
      </div>
    </div>
  )
}
