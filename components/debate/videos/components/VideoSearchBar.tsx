/**
 * @fileoverview Search bar with filters for videos
 * @module components/debate/videos/components/VideoSearchBar
 */

import { Search, X, Video, VideoOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { GlowingEffect } from "@/components/ui/glowing-effect"

interface VideoSearchBarProps {
  searchTerm: string
  sortOrder: string
  isSearchFocused: boolean
  showThumbnails: boolean
  onSearchChange: (value: string) => void
  onSearchFocus: () => void
  onSearchBlur: () => void
  onClearSearch: () => void
  onSortChange: (value: string) => void
  onToggleThumbnails: () => void
}

const sortOptions = [
  { value: "Recency", label: "Recency" },
  { value: "Views", label: "Views" },
]

/**
 * Search and filter controls for video list
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
