/**
 * @fileoverview State management hook for videos page
 * @module components/debate/videos/hooks/useVideoState
 */

import { useState, useRef, useEffect } from "react";
import type { CategoryType, DebateStyle } from "../types/videos";

/**
 * Initialises and returns the view state and refs the videos pages own.
 *
 * Video rows, paging and load state are *not* here — they belong to
 * {@link useVideoFeed}, which pages them in from `/api/videos`. This hook keeps
 * only the user-controlled filter state and the browser-local favourite/hidden
 * sets, which drive the requests that hook makes.
 *
 * @returns An object containing `state` (current values and refs) and `actions` (setter functions).
 */
export function useVideoState(initialCategory: CategoryType = "rounds") {
  const [currentCategory, setCurrentCategory] =
    useState<CategoryType>(initialCategory);
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
  /** Ref attached to the sentinel element that triggers infinite scroll loading. */
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);

  return {
    /**
     * Current state values and DOM refs for the videos page.
     */
    state: {
      /** The category tab currently selected by the user. */
      currentCategory,
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
      /** Ref for the infinite-scroll sentinel element. */
      loadMoreTriggerRef,
    },
    /**
     * Setter functions for updating each piece of state.
     */
    actions: {
      /** Sets the active category tab. */
      setCurrentCategory,
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
