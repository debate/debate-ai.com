/**
 * @fileoverview State management hook for videos page
 * @module components/debate/videos/hooks/useVideoState
 */

import { useState, useRef } from "react"

/**
 * Initialises and returns all state and refs needed by the videos page.
 *
 * @returns An object containing `state` (current values and refs) and `actions` (setter functions).
 */
export function useVideoState() {
  const [debateVideos, setDebateVideos] = useState<DebateVideosData | null>(null)
  const [allVideos, setAllVideos] = useState<VideoType[]>([])
  const [filteredVideos, setFilteredVideos] = useState<VideoType[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [videosPerPage, setVideosPerPage] = useState(8)
  const [currentCategory, setCurrentCategory] = useState<CategoryType>("rounds")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortOrder, setSortOrder] = useState("Recency")
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [showThumbnails, setShowThumbnails] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  /** Ref attached to the scrollable video grid container. */
  const videoContainerRef = useRef<HTMLDivElement | null>(null)
  /** Ref attached to the sentinel element that triggers infinite scroll loading. */
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)

  return {
    /**
     * Current state values and DOM refs for the videos page.
     */
    state: {
      /** Raw video data fetched from the API, or null while loading. */
      debateVideos,
      /** Full list of videos for the active category before filtering. */
      allVideos,
      /** Videos remaining after search and sort have been applied. */
      filteredVideos,
      /** Current pagination page number (1-indexed). */
      currentPage,
      /** Number of videos displayed per page. */
      videosPerPage,
      /** The category tab currently selected by the user. */
      currentCategory,
      /** Whether the initial video fetch is in progress. */
      isLoading,
      /** Human-readable error message to display when fetching fails. */
      errorMessage,
      /** Current value of the search input field. */
      searchTerm,
      /** Active sort order; either "Recency" or "Views". */
      sortOrder,
      /** Whether the search input currently has keyboard focus. */
      isSearchFocused,
      /** Whether video thumbnail images are visible in the grid. */
      showThumbnails,
      /** Whether additional videos are being loaded via infinite scroll. */
      isLoadingMore,
      /** Ref for the video grid container element. */
      videoContainerRef,
      /** Ref for the infinite-scroll sentinel element. */
      loadMoreTriggerRef,
    },
    /**
     * Setter functions for updating each piece of state.
     */
    actions: {
      /** Updates the raw API video data. */
      setDebateVideos,
      /** Replaces the full unfiltered video list. */
      setAllVideos,
      /** Replaces the filtered and sorted video list. */
      setFilteredVideos,
      /** Sets the current pagination page. */
      setCurrentPage,
      /** Sets how many videos are shown per page. */
      setVideosPerPage,
      /** Sets the active category tab. */
      setCurrentCategory,
      /** Sets the initial loading state. */
      setIsLoading,
      /** Sets the error message string. */
      setErrorMessage,
      /** Sets the search input value. */
      setSearchTerm,
      /** Sets the active sort order. */
      setSortOrder,
      /** Sets whether the search field is focused. */
      setIsSearchFocused,
      /** Sets whether thumbnails are shown. */
      setShowThumbnails,
      /** Sets whether more videos are being fetched for infinite scroll. */
      setIsLoadingMore,
    },
  }
}
