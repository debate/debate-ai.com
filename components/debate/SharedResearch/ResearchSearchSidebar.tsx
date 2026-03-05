/**
 * @fileoverview Search sidebar for research evidence with advanced filtering.
 */

"use client"


import { useState } from "react"
import grab from "grab-url"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X, ChevronDown, ChevronUp } from "lucide-react"
import { SearchResultCard } from "./SearchResultCard"
import { Button } from "@/components/ui/button"
import type { SearchResult } from "@/components/debate/SharedResearch/types"
import { MultiSelect } from "@/components/ui/multi-select"
import { Autocomplete } from "@/components/ui/autocomplete"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

async function fetchSchools(q: string): Promise<string[]> {
  const data = await grab(`/api/schools?q=${encodeURIComponent(q)}&limit=10`)
  return data.results ?? []
}

async function fetchTournaments(q: string): Promise<string[]> {
  const data = await grab(`/api/tournaments?q=${encodeURIComponent(q)}&limit=10`)
  return data.results ?? []
}

export interface SearchFilters {
  year: string
  school: string
  team: string
  tournament: string
  event: string
  searchHighlighted: boolean
  searchUnderlined: boolean
  searchSummaries: boolean
  searchOutlines: boolean
  searchRoundSpeeches: boolean
  searchQuotes: boolean
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

const MULTISELECT_SEARCH_KEYS = ["searchHighlighted", "searchUnderlined", "searchSummaries", "searchAllText"] as const

const TOGGLE_BAR_ITEMS = [
  { key: "searchRoundSpeeches" as const, label: "Debates", tooltip: "Show recent rounds" },
  { key: "searchOutlines" as const, label: "Outlines", tooltip: "Show recent outlines" },
  { key: "searchQuotes" as const, label: "Quotes", tooltip: "Show recent quotes" },
]

const RECENT_CHIPS = [
  { key: "searchQuotes" as const, label: "Recent Quotes" },
  { key: "searchOutlines" as const, label: "Recent Outlines" },
  { key: "searchRoundSpeeches" as const, label: "Recent Rounds" },
]

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
  const years = Array.from({ length: maxYear - 2012 }, (_, i) => String(maxYear - i))

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
            placeholder="Search debates, outlines, quotes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Toggle bar: Outlines | Speeches | Quotes */}
        <TooltipProvider>
          <div className="flex rounded-md border overflow-hidden">
            {TOGGLE_BAR_ITEMS.map(({ key, label, tooltip }) => {
              const isActive = filters[key]
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        const newActive = !isActive
                        const newFilters = { ...filters }
                        TOGGLE_BAR_ITEMS.forEach((item) => { newFilters[item.key] = false })
                        newFilters[key] = newActive
                        setFilters(newFilters)
                      }}
                      className={`flex-1 h-7 text-xs border-r last:border-r-0 transition-colors ${isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                      {label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{tooltip}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>


        {/* Advanced toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2 w-full justify-start"
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

        {/* Advanced filters (hidden by default) */}
        {showMoreFilters && (
          <div className="space-y-2">
            <div className="flex flex-row gap-1">

              {/* Sort — moved into advanced */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 text-xs">
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
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="CX">CX</SelectItem>
                  <SelectItem value="PF">PF</SelectItem>
                  <SelectItem value="LD">LD</SelectItem>
                  <SelectItem value="NDT">NDT</SelectItem>
                  <SelectItem value="NFA">NFA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-row gap-1">
              <Autocomplete
                placeholder="School"
                value={filters.school}
                onChange={(v) => updateFilter("school", v)}
                fetchOptions={fetchSchools}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Debater"
                value={filters.team}
                onChange={(e) => updateFilter("team", e.target.value)}
                className="h-8 text-xs"
              />
              <Autocomplete
                placeholder="Tournament"
                value={filters.tournament}
                onChange={(v) => updateFilter("tournament", v)}
                fetchOptions={fetchTournaments}
                className="h-8 text-xs"
              />
            </div>

            {/* Search in: Highlighted / Underlined / Summaries / All Text */}
            <MultiSelect
              label="Search in"
              placeholder="Search in"
              options={[
                { value: "searchHighlighted", label: "Highlighted" },
                { value: "searchUnderlined", label: "Underlined" },
                { value: "searchSummaries", label: "Summaries" },
                { value: "searchTitles", label: "Block & Filename" },
                { value: "searchAllText", label: "All Text" },
              ]}
              selected={MULTISELECT_SEARCH_KEYS.filter((k) => filters[k] === true)}
              onChange={(selectedKeys) => {
                const newFilters = { ...filters }
                MULTISELECT_SEARCH_KEYS.forEach((key) => {
                  newFilters[key] = false
                })
                selectedKeys.forEach((key) => {
                  if (key in newFilters) {
                    ; (newFilters as any)[key] = true
                  }
                })
                setFilters(newFilters)
              }}
            />


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
