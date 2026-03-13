/**
 * @fileoverview Data fetching and filtering hooks for videos
 * @module components/debate/videos/hooks/useVideoData
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import grab from "grab-url";
import type {
  CategoryType,
  DebateVideosData,
  VideoType,
  DebateStyle,
} from "@/lib/types/videos";
import Fuse from "fuse.js";
const ORIGIN = "";

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
  initialCategory: CategoryType = "rounds",
) {
  const fetchVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await grab(ORIGIN + "videos");
      const videosData = data.data || data;
      setDebateVideos(videosData);
      changeCategory(initialCategory, videosData);
    } catch (err) {
      setErrorMessage("Failed to load videos");
    } finally {
      setIsLoading(false);
    }
  }, [
    setDebateVideos,
    setErrorMessage,
    setIsLoading,
    changeCategory,
    initialCategory,
  ]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return { fetchVideos };
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
    (
      videos: VideoType[],
      search: string,
      sort: string,
      year: string,
      data: DebateVideosData | null,
      showFavoritesOnly: boolean,
      favorites: Set<string>,
      selectedStyle: DebateStyle | "",
      hiddenVideos: Set<string>,
    ) => {
      let allCategoryVideos = videos;
      if (search.trim() && data && Array.isArray(data.rounds)) {
        allCategoryVideos = [...data.rounds, ...(data.lectures || [])];
      }

      let filtered: VideoType[] = allCategoryVideos;

      // Filter out hidden videos (unless explicitly searching)
      if (!search.trim()) {
        filtered = filtered.filter((video) => !hiddenVideos.has(video[0]));
      }

      // Filter by favorites if enabled
      if (showFavoritesOnly) {
        filtered = filtered.filter((video) => favorites.has(video[0]));
      }

      // Filter by debate style
      if (selectedStyle) {
        filtered = filtered.filter((video) => video[6] === selectedStyle);
      }

      // Filter by season year
      if (year) {
        if (year === "legacy") {
          // Everything before 2011 season (i.e. before June 1st, 2010)
          const legacyEndDate = new Date("2010-06-01");
          filtered = filtered.filter((video) => {
            const videoDate = new Date(video[2]);
            return videoDate < legacyEndDate;
          });
        } else {
          const seasonYear = parseInt(year);
          // Season runs from June 1st of (year-1) to June 1st of year
          const startDate = new Date(`${seasonYear - 1}-06-01`);
          const endDate = new Date(`${seasonYear}-06-01`);

          filtered = filtered.filter((video) => {
            const videoDate = new Date(video[2]);
            return videoDate >= startDate && videoDate < endDate;
          });
        }
      }

      // Filter by search if provided using Fuse.js
      if (search.trim()) {
        const fuse = new Fuse(filtered, {
          keys: [
            { name: "1", weight: 0.5 }, // title
            { name: "3", weight: 0.3 }, // channel
            { name: "5", weight: 0.2 }, // description
          ],
          threshold: 0.1, // low tolerance
          ignoreLocation: true,
        });

        const results = fuse.search(search);
        filtered = results.map((result) => result.item);
      }

      if (sort === "Views") {
        filtered.sort((a, b) => b[4] - a[4]);
      } else {
        filtered.sort(
          (a, b) => new Date(b[2]).getTime() - new Date(a[2]).getTime(),
        );
      }

      return filtered;
    },
    [],
  );

  return { filterAndSortVideos };
}

/**
 * Adjusts the videos-per-page count based on the current viewport width.
 * Listens to window resize events and cleans up on unmount.
 *
 * @param setVideosPerPage - Setter for the videos-per-page count.
 */
export function useResponsiveVideosPerPage(
  setVideosPerPage: (count: number) => void,
) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const updateVideosPerPage = () => {
        setVideosPerPage(100);
      };
      updateVideosPerPage();
      window.addEventListener("resize", updateVideosPerPage);
      return () => window.removeEventListener("resize", updateVideosPerPage);
    }
  }, [setVideosPerPage]);
}
