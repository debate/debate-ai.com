/**
 * @fileoverview Paginated data-fetching hooks for the video pages.
 *
 * The video library lives in a SQL table (Cloudflare D1 in production, local
 * SQLite in development) and is served a page at a time by `/api/videos`, so
 * filtering, search, sorting and pagination all happen server-side. These
 * hooks own one feed: they refetch from offset 0 whenever the filters change
 * and append the next page when the grid is scrolled to the bottom.
 * @module hooks/useVideoFeed
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import grab from "grab-url";
import type {
  LectureCategoryFacet,
  VideoFacets,
} from "debate-data-sync/src/videos/video-query";
import type {
  DebateStyle,
  VideoCounts,
  VideoFeedResponse,
  VideoMetaResponse,
  VideoType,
} from "../types/videos";

/** Videos requested per page; one screenful of grid plus headroom. */
export const VIDEO_PAGE_SIZE = 60;

/** Filters describing one video feed. */
export interface VideoFeedFilters {
  /** Restrict to rounds or lectures; `"all"` spans both. */
  source?: "round" | "lecture" | "all";
  /** Keep only videos without a numeric debate style (the "All Lectures" rule). */
  lecturesOnly?: boolean;
  /** Keep only top-pick videos. */
  topPicksOnly?: boolean;
  /** Lecture category slug, or `"all"`/empty for every category. */
  categoryKey?: string | null;
  /** Numeric debate style filter. */
  style?: DebateStyle | "";
  /** Season key (`"2026"`, `"legacy"`) or empty for all seasons. */
  year?: string;
  /** `"Views"` or `"Recency"`. */
  sort?: string;
  /** Free-text search over title, channel and description. */
  q?: string;
  /** Explicit id allow-list — how the favourites filter is applied server-side. */
  ids?: string[] | null;
  /** Page size override. */
  pageSize?: number;
  /** Whether to ask for the season/style dropdown counts. */
  withFacets?: boolean;
  /** Set to `false` to hold off fetching (e.g. while a non-video tab is active). */
  enabled?: boolean;
}

/** Everything a video grid needs to render and page through a feed. */
export interface VideoFeed {
  /** Videos loaded so far, in server order. */
  videos: VideoType[];
  /** Total matches for the current filters, across all pages. */
  total: number;
  /** Season/style dropdown counts, when requested. */
  facets: VideoFacets | null;
  /** Whether another page is available. */
  hasMore: boolean;
  /** `true` while the first page of the current filters is loading. */
  isLoading: boolean;
  /** `true` while a subsequent page is loading. */
  isLoadingMore: boolean;
  /** Human-readable error message, or an empty string. */
  errorMessage: string;
  /** Requests the next page; a no-op when one is already in flight. */
  loadMore: () => void;
  /** Refetches the feed from the first page. */
  reload: () => void;
}

/**
 * Turns filters into the request parameters `/api/videos` accepts.
 *
 * @param filters - See {@link VideoFeedFilters}.
 * @param offset - Zero-based offset of the requested page.
 * @param limit - Page size.
 * @returns Query parameters, ready to hand to `grab`.
 */
export function buildVideoParams(
  filters: VideoFeedFilters,
  offset: number,
  limit: number,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.source && filters.source !== "all") params.source = filters.source;
  if (filters.lecturesOnly) params.lecturesOnly = "1";
  if (filters.topPicksOnly) params.topPicks = "1";
  if (filters.categoryKey && filters.categoryKey !== "all") {
    params.category = filters.categoryKey;
  }
  if (filters.style) params.style = String(filters.style);
  if (filters.year) params.year = filters.year;
  if (filters.sort) params.sort = filters.sort;
  const q = filters.q?.trim();
  if (q) params.q = q;
  // An empty list still has to be sent: "favourites only" with no favourites
  // must return nothing rather than everything.
  if (filters.ids) params.ids = filters.ids.join(",");
  if (filters.withFacets) params.facets = "1";
  params.limit = String(limit);
  params.offset = String(offset);
  return params;
}

/**
 * Serialises request parameters into a stable string, used as the identity of
 * a feed: when it changes, the feed restarts from its first page.
 *
 * @param params - Parameters from {@link buildVideoParams}.
 * @returns The serialised query string.
 */
export function videoFeedKey(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/**
 * Loads one paginated video feed and keeps it in sync with its filters.
 *
 * @param filters - See {@link VideoFeedFilters}.
 * @returns The loaded videos plus paging state. See {@link VideoFeed}.
 */
export function useVideoFeed(filters: VideoFeedFilters): VideoFeed {
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<VideoFacets | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const enabled = filters.enabled !== false;
  const pageSize = filters.pageSize ?? VIDEO_PAGE_SIZE;

  // The serialised first-page request doubles as the identity of the feed:
  // whenever it changes the feed restarts from offset 0.
  const feedKey = videoFeedKey(buildVideoParams(filters, 0, pageSize));

  const requestRef = useRef(0);
  const loadedRef = useRef(0);
  // Latest filters, so paging can rebuild the request without making the fetch
  // callback depend on the caller's (freshly allocated) filters object.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchPage = useCallback(
    async (offset: number) => {
      const requestId = ++requestRef.current;

      if (offset === 0) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        // grab cancels an in-flight request to the same path when a newer one
        // starts, which is exactly what a filter change should do; the request
        // id guard below makes sure only the newest response updates state.
        const data: VideoFeedResponse = await grab(
          "videos",
          buildVideoParams(filtersRef.current, offset, pageSize),
        );
        if (requestId !== requestRef.current) return;
        if (!data || (data as { error?: string }).error || !Array.isArray(data.videos)) {
          throw new Error((data as { error?: string })?.error || "Malformed videos response");
        }

        setVideos((previous) => {
          const next = offset === 0 ? data.videos : [...previous, ...data.videos];
          loadedRef.current = next.length;
          return next;
        });
        setTotal(data.total);
        setHasMore(data.hasMore);
        if (data.facets) setFacets(data.facets);
        setErrorMessage("");
      } catch (error) {
        // A superseded request (cancelled, or simply overtaken) must not
        // report an error over the feed the user is now looking at.
        if (requestId !== requestRef.current) return;
        console.error("Failed to load videos", error);
        setErrorMessage("Failed to load videos");
        if (offset === 0) {
          setVideos([]);
          setTotal(0);
          setHasMore(false);
          loadedRef.current = 0;
        }
      } finally {
        if (requestId === requestRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    // `feedKey` is the serialised filter set: a change to it is a new feed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feedKey, pageSize],
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    loadedRef.current = 0;
    void fetchPage(0);
  }, [fetchPage, enabled, reloadToken]);

  const loadMore = useCallback(() => {
    if (!enabled || isLoading || isLoadingMore || !hasMore) return;
    void fetchPage(loadedRef.current);
  }, [enabled, isLoading, isLoadingMore, hasMore, fetchPage]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    videos,
    total,
    facets,
    hasMore,
    isLoading,
    isLoadingMore,
    errorMessage,
    loadMore,
    reload,
  };
}

/** Empty counts used until `/api/videos/meta` resolves. */
const EMPTY_COUNTS: VideoCounts = {
  total: 0,
  rounds: 0,
  lectures: 0,
  lecturesOnly: 0,
  topPicks: 0,
  byStyle: {},
};

/** Library metadata plus its load state. */
export interface VideoMetaState {
  meta: VideoMetaResponse | null;
  counts: VideoCounts;
  lectureCategories: LectureCategoryFacet[];
  isLoading: boolean;
}

/**
 * Fetches the page-level video metadata once: library counts, lecture-category
 * cards, and the season topic/champion tables. This is the small companion to
 * the paginated feed and does not grow with the size of the library.
 *
 * @returns See {@link VideoMetaState}.
 */
export function useVideoMeta(): VideoMetaState {
  const [meta, setMeta] = useState<VideoMetaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    grab("videos/meta", { cache: true })
      .then((data: VideoMetaResponse) => {
        if (!active) return;
        // grab resolves with an `error` field rather than throwing on a
        // non-2xx response, so a failure has to be checked for here.
        const failure = (data as { error?: string })?.error;
        if (!data || failure) {
          console.error("Failed to load video metadata", failure ?? "empty response");
          return;
        }
        setMeta(data);
      })
      .catch((error: unknown) => {
        if (active) console.error("Failed to load video metadata", error);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const lectureCategories = useMemo(() => meta?.lectureCategories ?? [], [meta]);

  return {
    meta,
    counts: meta?.counts ?? EMPTY_COUNTS,
    lectureCategories,
    isLoading,
  };
}
