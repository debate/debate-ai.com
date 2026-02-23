/**
 * @fileoverview Search bar with filters for videos
 * @module components/debate/videos/components/VideoSearchBar
 */

import { Search, X, Video, VideoOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { GlowingEffect } from "@/components/ui/glowing-effect"

/**
 * Props for the VideoSearchBar component.
 */
interface VideoSearchBarProps {
  /** Current value of the search input. */
  searchTerm: string
  /** Currently active sort order (e.g. "Recency" or "Views"). */
  sortOrder: string
  /** Whether the search input is focused; controls the glowing effect. */
  isSearchFocused: boolean
  /** Whether video thumbnails are currently visible in the grid. */
  showThumbnails: boolean
  /** Callback invoked with the new search string on every input change. */
  onSearchChange: (value: string) => void
  /** Callback invoked when the search input receives focus. */
  onSearchFocus: () => void
  /** Callback invoked when the search input loses focus. */
  onSearchBlur: () => void
  /** Callback invoked when the clear-search button is clicked. */
  onClearSearch: () => void
  /** Callback invoked with the newly selected sort option value. */
  onSortChange: (value: string) => void
  /** Callback invoked to toggle thumbnail visibility. */
  onToggleThumbnails: () => void
}

/** Available sort options shown in the sort dropdown. */
const sortOptions = [
  { value: "Recency", label: "Recency" },
  { value: "Views", label: "Views" },
]

/**
 * Renders a search input, sort order selector, and thumbnail toggle button.
 *
 * @param props - Search bar state and event handlers.
 * @param props.searchTerm - Current search input value.
 * @param props.sortOrder - Currently selected sort order.
 * @param props.isSearchFocused - Whether the search input is focused.
 * @param props.showThumbnails - Whether thumbnails are currently shown.
 * @param props.onSearchChange - Handler for search input changes.
 * @param props.onSearchFocus - Handler for search input focus.
 * @param props.onSearchBlur - Handler for search input blur.
 * @param props.onClearSearch - Handler for the clear-search action.
 * @param props.onSortChange - Handler for sort order changes.
 * @param props.onToggleThumbnails - Handler to toggle thumbnail display.
 * @returns A toolbar row containing the search field, sort selector, and thumbnail toggle.
 */
export function VideoSearchBar({
  searchTerm,
  sortOrder,
  isSearchFocused,
  showThumbnails,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onClearSearch,
  onSortChange,
  onToggleThumbnails,
}: VideoSearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Search videos..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <button
              onClick={onClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isSearchFocused && <GlowingEffect />}
        </div>
      </div>

      <Select value={sortOrder} onValueChange={onSortChange}>
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="icon" onClick={onToggleThumbnails} title="Toggle thumbnails">
        {showThumbnails ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
      </Button>
    </div>
  )
}
