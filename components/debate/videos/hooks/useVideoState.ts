/**
 * @fileoverview State management hook for videos page
 * @module components/debate/videos/hooks/useVideoState
 */

import { useState, useRef } from "react"

/**
 * Video data tuple format from API
 * [videoId, title, date, channel, viewCount, description]
 */
export type VideoType = [string, string, string, string, number, string]

/**
 * Structure of video data returned from API
 */
export type DebateVideosData = {
  rounds: VideoType[]
  lectures: VideoType[]
  topPicks: VideoType[]
}

export type CategoryType = "rounds" | "lectures" | "topPicks" | "champions" | "dictionary" | "leaderboard"

/**
 * Hook for managing video page state
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

  const videoContainerRef = useRef<HTMLDivElement | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)

  return {
    state: {
      debateVideos,
      allVideos,
      filteredVideos,
      currentPage,
      videosPerPage,
      currentCategory,
      isLoading,
      errorMessage,
      searchTerm,
      sortOrder,
      isSearchFocused,
      showThumbnails,
      isLoadingMore,
      videoContainerRef,
      loadMoreTriggerRef,
    },
    actions: {
      setDebateVideos,
      setAllVideos,
      setFilteredVideos,
      setCurrentPage,
      setVideosPerPage,
      setCurrentCategory,
      setIsLoading,
      setErrorMessage,
      setSearchTerm,
      setSortOrder,
      setIsSearchFocused,
      setShowThumbnails,
      setIsLoadingMore,
    },
  }
}
