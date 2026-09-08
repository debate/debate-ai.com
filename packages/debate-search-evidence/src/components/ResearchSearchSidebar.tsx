/**
 * @fileoverview Search sidebar for research evidence with advanced filtering.
 */

"use client"


import { useState } from "react"
import { Input } from "../ui/primitives/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/primitives/select"
import { Search, X, ChevronDown, ChevronUp, Scale, ListTree, Quote } from "lucide-react"
import { SearchResultCard } from "./SearchResultCard"
import { Button } from "../ui/primitives/button"
import type { SearchResult } from "../types"
import { MultiSelect } from "../ui/primitives/multi-select"
import { Autocomplete } from "../ui/primitives/autocomplete"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/primitives/tooltip"
import { searchSchools, searchTournaments, searchNames } from "../cache/client-cache"
import { resultCountLabel } from "../lib/card-display"
import { EMPTY_FILTERS } from "../lib/search-query"

const SUGGESTION_LIMIT = 20
const SEARCH_DROPDOWN_CLASS = "right-auto w-[14rem]"
const SEARCH_OPTION_CLASS = "!px-0"

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
  { key: "searchRoundSpeeches" as const, label: "Debates", tooltip: "Show recent rounds", icon: Scale },
  { key: "searchOutlines" as const, label: "Outlines", tooltip: "Show recent outlines", icon: ListTree },
  { key: "searchQuotes" as const, label: "Quotes", tooltip: "Show recent quotes", icon: Quote },
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
  const [showMoreFilters, setShowMoreFilters] = useState(true)

  const updateFilter = (key: keyof SearchFilters, value: string | boolean) => {
    setFilters({ ...filters, [key]: value })
  }

  const currentYear = new Date().getFullYear()
  const maxYear = Math.max(currentYear, 2026)
  const years = Array.from({ length: maxYear - 2012 }, (_, i) => String(maxYear - i))

  const activeFilterCount = Object.values(filters).filter((v) => v && v !== "all").length
  const hasActiveFilters = activeFilterCount > 0
  const countLabel = resultCountLabel(searchResults?.length ?? 0, totalResults)

  /** Resets every filter to its empty value, leaving the search term alone. */
  const clearFilters = () => setFilters({ ...EMPTY_FILTERS })

  return (
    <div className="mt-[50px] w-full h-full flex flex-col bg-background overflow-hidden min-w-0">
      <TooltipProvider>
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
              placeholder="Search debates, outlines, and quotes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Toggle bar: Outlines | Speeches | Quotes */}
          <div className="flex rounded-md border overflow-hidden">
            {TOGGLE_BAR_ITEMS.map(({ key, label, tooltip, icon: Icon }) => {
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
                      className={`flex-1 h-7 text-xs border-r last:border-r-0 transition-colors flex items-center justify-center ${isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                      <Icon className="h-3.5 w-3.5 mr-1" />
                      {label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{tooltip}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>

          {/* Advanced toggle */}
          {/* <Button
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
        </Button> */}

          {/* Advanced filters (hidden by default) */}
          {showMoreFilters && (
            <div className="space-y-2">
              <div className="flex flex-row flex-wrap gap-1">

                {/* Sort — moved into advanced */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
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
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Sort results by relevance, popularity, date, or length</TooltipContent>
                </Tooltip>

                {/* Search in: Highlighted / Underlined / Summaries / All Text */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-[120px]">
                      <MultiSelect
                        label="Search in"
                        className="w-full"
                        placeholder="Search in"
                        options={[
                          { value: "searchHighlighted", label: "Highlight" },
                          { value: "searchUnderlined", label: "Underlined" },
                          { value: "searchSummaries", label: "Summaries" },
                          { value: "searchTitles", label: "Blocks" },
                          { value: "searchAllText", label: "All" },
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
                  </TooltipTrigger>
                  <TooltipContent>Choose which parts of evidence to search</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select value={filters.year || "all"} onValueChange={(v) => updateFilter("year", v === "all" ? "" : v)}>
                        <SelectTrigger className="h-8 w-[65px] text-xs">
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
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Filter by debate season year</TooltipContent>
                </Tooltip>

              </div>

              <div className="flex flex-row flex-wrap gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-[70px]">
                      <Autocomplete
                        placeholder="School"
                        value={filters.school}
                        onChange={(v) => updateFilter("school", v)}
                        fetchOptions={(q) => searchSchools(q, SUGGESTION_LIMIT)}
                        className="h-8 w-full text-xs"
                        dropdownClassName={SEARCH_DROPDOWN_CLASS}
                        optionClassName={SEARCH_OPTION_CLASS}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Search by school or university name</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-[70px]">
                      <Autocomplete
                        placeholder="Name"
                        value={filters.team}
                        onChange={(v) => updateFilter("team", v)}
                        fetchOptions={(q) => searchNames(q, SUGGESTION_LIMIT)}
                        className="h-8 w-full text-xs"
                        dropdownClassName={SEARCH_DROPDOWN_CLASS}
                        optionClassName={SEARCH_OPTION_CLASS}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Search by debater&apos;s first or last name</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex-1">
                      <Autocomplete
                        placeholder="Tournament"
                        value={filters.tournament}
                        onChange={(v) => updateFilter("tournament", v)}
                        fetchOptions={(q) => searchTournaments(q, SUGGESTION_LIMIT)}
                        className="h-8 w-full text-xs"
                        dropdownClassName={SEARCH_DROPDOWN_CLASS}
                        optionClassName={SEARCH_OPTION_CLASS}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Filter by tournament name</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select value={filters.event || "all"} onValueChange={(v) => updateFilter("event", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Format" />
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
                  </TooltipTrigger>
                  <TooltipContent>Filter by debate format (CX, PF, LD, etc.)</TooltipContent>
                </Tooltip>
              </div>




            </div>
          )}
        </div>
      </TooltipProvider>

      {/* Result count — how much of the match set is on screen. */}
      {!isLoading && countLabel && (
        <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
          <span>{countLabel}</span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <div
        role="listbox"
        aria-label="Evidence cards"
        aria-busy={isLoading}
        className="flex-1 space-y-1.5 overflow-y-auto p-2"
      >
        {isLoading ? (
          // Skeleton rows in the shape of the cards they replace, so the list
          // does not collapse and reflow when results land.
          Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex gap-0 overflow-hidden rounded-lg border" aria-hidden="true">
              <span className="w-1 shrink-0 animate-pulse bg-muted" />
              <div className="flex-1 space-y-2 p-3">
                <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))
        ) : !searchResults || searchResults.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Search className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm font-medium">No cards found</p>
            <p className="text-xs text-muted-foreground">
              {searchTerm
                ? `Nothing matches "${searchTerm}"${hasActiveFilters ? " with these filters" : ""}.`
                : "Try a search term, or widen the filters."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="mt-1 h-7 text-xs" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          searchResults.map((result, index) => (
            <SearchResultCard
              key={result.id}
              result={result}
              index={index}
              total={searchResults.length}
              searchTerm={searchTerm}
              isSelected={selectedIndex === index}
              onClick={() => selectResult(result, index)}
            />
          ))
        )}
      </div>
    </div>
  )
}
