/**
 * @fileoverview Data fetching and filtering hooks for videos
 * @module components/debate/videos/hooks/useVideoData
 */

import { useEffect, useCallback } from "react"
const ORIGIN = ""

/**
 * Fetches video data from the API on mount and invokes the initial category change.
 *
 * @param setDebateVideos - Setter for the raw API video data.
 * @param setIsLoading - Setter for the loading flag.
 * @param setErrorMessage - Setter for the error message string.
 * @param changeCategory - Callback invoked with the fetched data to activate the default category.
 * @returns An object containing the memoised `fetchVideos` function.
 */
export function useVideoDataFetch(
  setDebateVideos: (data: DebateVideosData | null) => void,
  setIsLoading: (loading: boolean) => void,
  setErrorMessage: (msg: string) => void,
  changeCategory: (category: CategoryType, data: DebateVideosData) => void,
) {
  const fetchVideos = useCallback(async () => {
    try {
      const response = await fetch(ORIGIN + "/api/videos?type=videos")
      if (!response.ok) {
        throw new Error("Failed to fetch videos")
      }
      const data = await response.json()
      setDebateVideos(data)
      changeCategory("rounds", data)
    } catch (error) {
      console.error("Error fetching videos:", error)
      setErrorMessage("Error loading videos. Please try again.")
      setIsLoading(false)
    }
  }, [setDebateVideos, setErrorMessage, setIsLoading, changeCategory])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  return { fetchVideos }
}

/**
 * Provides a memoised function for filtering and sorting a video list.
 *
 * @returns An object containing the `filterAndSortVideos` callback.
 */
export function useVideoFiltering() {
  /**
   * Filters videos by search term and sorts them by the given order.
   *
   * @param videos - The baseline list of videos to operate on.
   * @param search - The current search string; an empty string disables filtering.
   * @param sort - Sort mode: "Views" for descending view count, anything else for recency.
   * @param data - Full API data used when a search spans all categories.
   * @returns A new sorted (and optionally filtered) array of videos.
   */
  const filterAndSortVideos = useCallback(
    (videos: VideoType[], search: string, sort: string, data: DebateVideosData | null) => {
      let filtered: VideoType[]

      if (search.trim()) {
        const searchLower = search.toLowerCase()
        const allCategoryVideos = data ? [...data.rounds, ...data.lectures, ...data.topPicks] : videos

        filtered = allCategoryVideos.filter(
          (video) =>
            (video[1] || "").toLowerCase().includes(searchLower) ||
            (video[3] || "").toLowerCase().includes(searchLower) ||
            (video[5] || "").toLowerCase().includes(searchLower),
        )
      } else {
        filtered = [...videos]
      }

      if (sort === "Views") {
        filtered.sort((a, b) => b[4] - a[4])
      } else {
        filtered.sort((a, b) => new Date(b[2]).getTime() - new Date(a[2]).getTime())
      }

      return filtered
    },
    [],
  )

  return { filterAndSortVideos }
}

/**
 * Adjusts the videos-per-page count based on the current viewport width.
 * Listens to window resize events and cleans up on unmount.
 *
 * @param setVideosPerPage - Setter for the videos-per-page count.
 */
export function useResponsiveVideosPerPage(setVideosPerPage: (count: number) => void) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const updateVideosPerPage = () => {
        if (window.innerWidth < 640) {
          setVideosPerPage(4)
        } else if (window.innerWidth < 1024) {
          setVideosPerPage(6)
        } else {
          setVideosPerPage(8)
        }
      }
      updateVideosPerPage()
      window.addEventListener("resize", updateVideosPerPage)
      return () => window.removeEventListener("resize", updateVideosPerPage)
    }
  }, [setVideosPerPage])
}
