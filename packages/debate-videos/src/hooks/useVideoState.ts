/**
 * @fileoverview State management hook for videos page
 * @module components/debate/videos/hooks/useVideoState
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { CategoryType, DebateStyle } from "../types/videos";
import {
  VIDEO_FAVORITES_KEY,
  VIDEO_HIDDEN_KEY,
  hideVideo as hideVideoRecord,
  listHiddenVideos,
  listVideoFavorites,
  toggleVideoFavorite as toggleVideoFavoriteRecord,
  unhideVideo as unhideVideoRecord,
} from "../state/videoLibrary";

/** Layout of the video results: card grid with thumbnails, or a dense row/table list. */
export type VideoViewMode = "grid" | "list";

/**
 * Initialises and returns the view state and refs the videos pages own.
 *
 * Video rows, paging and load state are *not* here — they belong to
 * {@link useVideoFeed}, which pages them in from `/api/videos`. This hook keeps
 * only the user-controlled filter state and the favourite/hidden sets, which
 * drive the requests that hook makes.
 *
 * Those two sets are no longer this hook's own `localStorage` writes: they live
 * in `state/videoLibrary.ts`, which keys them as records the account sync can
 * store, mirrors each change up, and prompts a signed-out user to keep the
 * collection. This hook keeps the `Set<string>` shape its callers filter on and
 * re-reads that store whenever it changes — including when an account merge
 * writes it on sign-in, which is what makes favourites from another device show
 * up in an open grid without a reload.
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
  // Rows by default: the dense list fits roughly four times as many results
  // on a screen, and the thumbnail grid is one toggle away in the search
  // panel for anyone who wants it.
  const [viewMode, setViewMode] = useState<VideoViewMode>("list");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedStyle, setSelectedStyle] = useState<DebateStyle | "">("");
  const [hiddenVideos, setHiddenVideos] = useState<Set<string>>(new Set());

  // Read both stores on mount, and again whenever anything writes them: this
  // tab's own mutators dispatch a `storage` event by hand, other tabs get the
  // real one, and the account merge on sign-in writes through the same key.
  useEffect(() => {
    const read = () => {
      setFavorites(new Set(listVideoFavorites().map((favorite) => favorite.videoId)));
      setHiddenVideos(new Set(listHiddenVideos().map((entry) => entry.videoId)));
    };
    read();

    const onStorage = (event: StorageEvent) => {
      // `null` is `localStorage.clear()` per the StorageEvent spec — both
      // stores may be gone, so re-read rather than guess.
      if (event.key === null || event.key === VIDEO_FAVORITES_KEY || event.key === VIDEO_HIDDEN_KEY) {
        read();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Stable identities: these are handed to every card in the grid, and the
  // cards are memoised, so a fresh function per render would defeat that and
  // re-render the whole (paged, potentially several-hundred-card) grid on
  // every keystroke in the search box.
  //
  // The store owns persistence, mirroring and the guest prompt, and hands back
  // the full list — so state is set from what was actually written rather than
  // from an optimistic copy a failed quota write would leave diverged.
  const hideVideo = useCallback((videoId: string) => {
    setHiddenVideos(new Set(hideVideoRecord(videoId).map((entry) => entry.videoId)));
  }, []);

  const unhideVideo = useCallback((videoId: string) => {
    setHiddenVideos(new Set(unhideVideoRecord(videoId).map((entry) => entry.videoId)));
  }, []);

  const toggleFavorite = useCallback((videoId: string) => {
    setFavorites(new Set(toggleVideoFavoriteRecord(videoId).map((favorite) => favorite.videoId)));
  }, []);

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
      /** Current results layout: card grid or row list. */
      viewMode,
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
      /** Sets the results layout (grid or list). */
      setViewMode,
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
