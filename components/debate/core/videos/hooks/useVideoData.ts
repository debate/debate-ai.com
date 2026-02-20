/**
 * @fileoverview Data fetching and filtering hooks for videos
 * @module components/debate/core/videos/hooks/useVideoData
 */

import { useEffect, useCallback } from "react"
import type { VideoType, DebateVideosData, CategoryType } from "./useVideoState"

const ORIGIN = ""

/**
 * Hook for fetching video data
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
 * Hook for filtering and sorting videos
 */
export function useVideoFiltering() {
  const filterAndSortVideos = useCallback(
    (videos: VideoType[], search: string, sort: string, data: DebateVideosData | null) => {
      let filtered: VideoType[]

      if (search.trim()) {
        const searchLower = search.toLowerCase()
        const allCategoryVideos = data ? [...data.rounds, ...data.lectures, ...data.topPicks] : videos

        filtered = allCategoryVideos.filter(
          (video) =>
            video[1].toLowerCase().includes(searchLower) ||
            video[3].toLowerCase().includes(searchLower) ||
            video[5].toLowerCase().includes(searchLower),
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
 * Hook for responsive videos per page
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
