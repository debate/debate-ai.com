/**
 * @fileoverview State management hook for videos page
 * @module components/debate/videos/hooks/useVideoState
 */

import { useState, useRef, useEffect } from "react";
import type { CategoryType, DebateVideosData, VideoType, DebateStyle } from "@/lib/types/videos";

/**
 * Initialises and returns all state and refs needed by the videos page.
 *
 * @returns An object containing `state` (current values and refs) and `actions` (setter functions).
 */
export function useVideoState(initialCategory: CategoryType = "rounds") {
  const [debateVideos, setDebateVideos] = useState<DebateVideosData | null>(
    null,
  );
  const [allVideos, setAllVideos] = useState<VideoType[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<VideoType[]>([]);
  const [currentCategory, setCurrentCategory] =
    useState<CategoryType>(initialCategory);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [sortOrder, setSortOrder] = useState("Recency");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedStyle, setSelectedStyle] = useState<DebateStyle | "">("");
  const [hiddenVideos, setHiddenVideos] = useState<Set<string>>(new Set());

  // Load favorites and hidden videos from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("debateVideosFavorites");
      if (stored) {
        setFavorites(new Set(JSON.parse(stored)));
      }
      const storedHidden = localStorage.getItem("debateVideosHidden");
      if (storedHidden) {
        setHiddenVideos(new Set(JSON.parse(storedHidden)));
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
  }, []);

  // Action to hide/unhide a video
  const hideVideo = (videoId: string) => {
    setHiddenVideos((prev) => {
      const next = new Set(prev);
      next.add(videoId);
      try {
        localStorage.setItem("debateVideosHidden", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const unhideVideo = (videoId: string) => {
    setHiddenVideos((prev) => {
      const next = new Set(prev);
      next.delete(videoId);
      try {
        localStorage.setItem("debateVideosHidden", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Action to toggle a favorite
  const toggleFavorite = (videoId: string) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(videoId)) {
        newFavorites.delete(videoId);
      } else {
        newFavorites.add(videoId);
      }

      try {
        localStorage.setItem(
          "debateVideosFavorites",
          JSON.stringify(Array.from(newFavorites)),
        );
      } catch (error) {
        console.error("Failed to save favorites to localStorage", error);
      }

      return newFavorites;
    });
  };

  /** Ref attached to the scrollable video grid container. */
  const videoContainerRef = useRef<HTMLDivElement | null>(null);

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
      /** The category tab currently selected by the user. */
      currentCategory,
      /** Whether the initial video fetch is in progress. */
      isLoading,
      /** Human-readable error message to display when fetching fails. */
      errorMessage,
      /** Current value of the search input field. */
      searchTerm,
      /** Currently selected season year. */
      selectedYear,
      /** Active sort order; either "Recency" or "Views". */
      sortOrder,
      /** Whether the search input currently has keyboard focus. */
      isSearchFocused,
      /** Whether video thumbnail images are visible in the grid. */
      showThumbnails,
      /** Whether to only show favorited videos. */
      showFavoritesOnly,
      /** Set of favorite video IDs. */
      favorites,
      /** Currently active debate style filter. */
      selectedStyle,
      /** Set of hidden video IDs. */
      hiddenVideos,
      /** Ref for the video grid container element. */
      videoContainerRef,
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
      /** Sets the selected season year. */
      setSelectedYear,
      /** Sets whether the search field is focused. */
      setIsSearchFocused,
      /** Sets whether thumbnails are shown. */
      setShowThumbnails,
      /** Sets whether to only show favorited videos. */
      setShowFavoritesOnly,
      /** Toggles a video in the favorites set. */
      toggleFavorite,
      /** Sets the active debate style filter. */
      setSelectedStyle,
      /** Hides a video. */
      hideVideo,
      /** Unhides a video. */
      unhideVideo,
    },
  };
}
