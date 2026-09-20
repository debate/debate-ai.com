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
import type { VideoQueryParams } from "debate-data-sync/src/videos/video-query";
import {
  hydrateVideoIndex,
  queryVideoIndex,
  queryVideoIndexMeta,
  scheduleVideoIndexRefresh,
} from "../state/videoIndexCache";
import { useVideoIndexReady } from "./useVideoIndex";
import type {
  LectureCategoryFacet,
  VideoFacets,
  VideoSuggestions,
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

/**
 * Hard ceiling on how many videos one feed will hold in memory at once.
 *
 * The grid is not virtualised: every loaded video is a mounted card with a
 * thumbnail, a tooltip provider and a glow subscriber, and infinite scroll
 * appended pages for as long as the library had more to give. A category with
 * a few thousand videos therefore ended with a few thousand live cards, which
 * is what made the page stop responding to clicks a while after it looked
 * loaded. Automatic paging stops here and the view offers an explicit
 * "Load more" instead, so the page can never grow without bound on its own.
 */
export const MAX_LOADED_VIDEOS = 600;

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
  /**
   * Explicit id deny-list — how hidden videos are kept out of both the grid
   * and the facet counts server-side. Leave unset while searching, so a
   * hidden video can still be found in order to unhide it.
   */
  excludeIds?: string[] | null;
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
  /**
   * `true` once {@link MAX_LOADED_VIDEOS} videos are loaded and more remain.
   * Automatic paging stops here; a forced `loadMore` still works, so the view
   * can put the next page behind a button the user presses deliberately.
   */
  atCapacity: boolean;
  /**
   * Requests the next page; a no-op when one is already in flight, when the
   * feed is exhausted, or when it is at capacity and `force` is not set.
   */
  loadMore: (options?: { force?: boolean }) => void;
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
  if (filters.excludeIds?.length) params.excludeIds = filters.excludeIds.join(",");
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
 * Turns the same filters into the parameter object the shared query functions
 * take, for a page answered out of the browser's copy of the library.
 *
 * Kept beside {@link buildVideoParams} deliberately: the two must describe the
 * same request, or a locally-served grid would disagree with the one the API
 * returns for the same controls.
 *
 * @param filters - See {@link VideoFeedFilters}.
 * @param offset - Zero-based offset of the requested page.
 * @param limit - Page size.
 * @returns Parameters for `queryVideoRows` and friends.
 */
export function toVideoQueryParams(
  filters: VideoFeedFilters,
  offset: number,
  limit: number,
): VideoQueryParams {
  return {
    source: filters.source && filters.source !== "all" ? filters.source : "all",
    lecturesOnly: Boolean(filters.lecturesOnly),
    topPicksOnly: Boolean(filters.topPicksOnly),
    categoryKey: filters.categoryKey && filters.categoryKey !== "all" ? filters.categoryKey : null,
    style: filters.style === "" || filters.style == null ? null : Number(filters.style),
    year: filters.year || null,
    q: filters.q?.trim() || null,
    // An empty list still filters: "favourites only" with no favourites must
    // return nothing rather than everything, exactly as the API treats it.
    ids: filters.ids ?? null,
    excludeIds: filters.excludeIds?.length ? filters.excludeIds : null,
    sort: filters.sort ?? null,
    limit,
    offset,
  };
}

/**
 * Loads one paginated video feed and keeps it in sync with its filters.
 *
 * Pages come from the browser's own copy of the library when it has one (see
 * `state/videoIndexCache.ts`) and from `/api/videos` when it does not — which
 * is the first visit, and any visit where the cache could not be stored. Both
 * paths run the same query over the same rows, so the grid cannot tell which
 * answered; the difference is that the cached one costs no request at all,
 * for any filter, search or page.
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
  /** Offset the next page is requested from — the server's row count so far. */
  const nextOffsetRef = useRef(0);
  /** Ids already appended, so a shifting server order cannot duplicate rows. */
  const seenIdsRef = useRef<Set<string>>(new Set());
  // Latest filters, so paging can rebuild the request without making the fetch
  // callback depend on the caller's (freshly allocated) filters object.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  /**
   * Appends (or replaces) one page of results, whichever side answered.
   *
   * Shared by the cached and the networked path so the de-duplication, the
   * offset bookkeeping and the capacity accounting cannot drift apart.
   */
  const applyPage = useCallback(
    (
      offset: number,
      page: { videos: VideoType[]; total: number; hasMore: boolean; facets?: VideoFacets },
    ) => {
      // Rows already on screen are dropped rather than appended again: the
      // library is ordered by view count or recency, both of which shift
      // under a feed that is read a page at a time, so the same video can
      // legitimately come back in a later page. Appending it grew the grid
      // without advancing through the library.
      if (offset === 0) seenIdsRef.current = new Set();
      const seen = seenIdsRef.current;
      const fresh: VideoType[] = [];
      for (const video of page.videos) {
        if (seen.has(video[0])) continue;
        seen.add(video[0]);
        fresh.push(video);
      }

      // The next request continues from where the *source* left off, not from
      // the number of rows kept, so dropping a duplicate never makes the feed
      // ask for the same window again.
      nextOffsetRef.current = offset + page.videos.length;

      setVideos((previous) => {
        const next = offset === 0 ? fresh : [...previous, ...fresh];
        loadedRef.current = next.length;
        return next;
      });
      setTotal(page.total);
      // A page that returned nothing at all ends the feed whatever the source
      // says about `hasMore`. Without this the sentinel sat in view asking for
      // the same offset over and over — a request loop that only stopped when
      // the tab did. A page of rows the client already had still counts as
      // progress, because the offset advanced past them.
      setHasMore(page.hasMore && page.videos.length > 0);
      if (page.facets) setFacets(page.facets);
      setErrorMessage("");
    },
    [],
  );

  const fetchPage = useCallback(
    async (offset: number) => {
      const requestId = ++requestRef.current;

      // The browser's own copy of the library answers first when it has one.
      // No request, no loading flicker, and the same query the API would have
      // run — see `state/videoIndexCache.ts`.
      const local = queryVideoIndex(
        toVideoQueryParams(filtersRef.current, offset, pageSize),
        Boolean(filtersRef.current.withFacets),
      );
      if (local) {
        applyPage(offset, local);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      if (offset === 0) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        // grab cancels an in-flight request to the same path when a newer one
        // starts, which is exactly what a filter change should do; the request
        // id guard below makes sure only the newest response updates state.
        const data: VideoFeedResponse = await grab("videos", {
          ...buildVideoParams(filtersRef.current, offset, pageSize),
          baseURL: "/api/",
        });
        if (requestId !== requestRef.current) return;
        if (!data || (data as { error?: string }).error || !Array.isArray(data.videos)) {
          throw new Error((data as { error?: string })?.error || "Malformed videos response");
        }

        applyPage(offset, data);
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
          nextOffsetRef.current = 0;
          seenIdsRef.current = new Set();
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
    [feedKey, pageSize, applyPage],
  );

  const indexReady = useVideoIndexReady();

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    // Read the stored library before the first page is asked for, so a repeat
    // visit is served locally from the very first request rather than making
    // one round trip and then going quiet. It parses once per page load.
    hydrateVideoIndex();
    // And bring it up to date once the page has finished loading.
    scheduleVideoIndexRefresh();
    loadedRef.current = 0;
    nextOffsetRef.current = 0;
    seenIdsRef.current = new Set();
    void fetchPage(0);
  }, [fetchPage, enabled, reloadToken]);

  // The library landing mid-visit — a first-ever load, or a cache that had to
  // be rebuilt — re-runs a feed that has nothing to show. A feed that already
  // has rows is left alone: replacing a grid the user is reading, to render
  // the same rows from a different source, would be a worse experience than
  // the one saved request it buys. Its next filter change is served locally.
  useEffect(() => {
    if (!enabled || !indexReady || loadedRef.current > 0) return;
    void fetchPage(0);
  }, [indexReady, enabled, fetchPage]);

  // Reached the ceiling with more still available: automatic paging stops and
  // the view puts the next page behind a button. `videos.length` rather than
  // `loadedRef` so this is state the render actually depends on.
  const atCapacity = hasMore && videos.length >= MAX_LOADED_VIDEOS;

  const loadMore = useCallback(
    (options?: { force?: boolean }) => {
      if (!enabled || isLoading || isLoadingMore || !hasMore) return;
      // Only a deliberate press gets past the ceiling, and only by one page:
      // `atCapacity` goes true again as soon as that page lands.
      if (atCapacity && !options?.force) return;
      void fetchPage(nextOffsetRef.current);
    },
    [enabled, isLoading, isLoadingMore, hasMore, atCapacity, fetchPage],
  );

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    videos,
    total,
    facets,
    hasMore,
    isLoading,
    isLoadingMore,
    errorMessage,
    atCapacity,
    loadMore,
    reload,
  };
}

/** Empty suggestion lists used until `/api/videos/meta` resolves. */
const EMPTY_SUGGESTIONS: VideoSuggestions = { keywords: [], tournaments: [] };

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
  /** Popular keyword and tournament searches shown under the video grid. */
  suggestions: VideoSuggestions;
  isLoading: boolean;
}

/**
 * Fetches the page-level video metadata once: library counts, lecture-category
 * cards, and the season topic/champion tables. This is the small companion to
 * the paginated feed and does not grow with the size of the library.
 *
 * @returns See {@link VideoMetaState}.
 */
export function useVideoMeta(suggestionFilters?: VideoFeedFilters): VideoMetaState {
  const [meta, setMeta] = useState<VideoMetaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const indexReady = useVideoIndexReady();

  const suggestionParams = useMemo(() => {
    const params = new URLSearchParams();
    if (suggestionFilters?.lecturesOnly) params.set("lecturesOnly", "1");
    if (suggestionFilters?.topPicksOnly) params.set("topPicks", "1");
    if (suggestionFilters?.categoryKey && suggestionFilters.categoryKey !== "all") params.set("category", suggestionFilters.categoryKey);
    if (suggestionFilters?.style) params.set("style", String(suggestionFilters.style));
    if (suggestionFilters?.year) params.set("year", suggestionFilters.year);
    return params.toString();
  }, [suggestionFilters?.lecturesOnly, suggestionFilters?.topPicksOnly, suggestionFilters?.categoryKey, suggestionFilters?.style, suggestionFilters?.year]);

  // Counts, category cards and popular searches are all derivable from the
  // cached library, so a browser that has it skips this request too. The
  // season topics and champions are not — they are a different dataset — but
  // they are static, cached by `grab`, and only the history panel reads them.
  useEffect(() => {
    if (!indexReady) return;
    // Pagination is meaningless here — the counts and chips describe the
    // whole library, or the whole category — so the page size is a formality.
    const local = queryVideoIndexMeta(toVideoQueryParams(suggestionFilters ?? {}, 0, 0));
    if (!local) return;
    setMeta((previous) => ({
      ...(previous ?? {}),
      counts: local.counts,
      lectureCategories: local.lectureCategories,
      suggestions: local.suggestions,
      backend: "index",
    }) as VideoMetaResponse);
    setIsLoading(false);
    // The filters are read through `suggestionParams`, which is the stable
    // serialisation of exactly the fields this uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexReady, suggestionParams]);

  useEffect(() => {
    let active = true;
    grab(`videos/meta${suggestionParams ? `?${suggestionParams}` : ""}`, { cache: true, baseURL: "/api/" })
      .then((data: VideoMetaResponse) => {
        if (!active) return;
        // grab resolves with an `error` field rather than throwing on a
        // non-2xx response, so a failure has to be checked for here.
        const failure = (data as { error?: string })?.error;
        if (!data || failure) {
          console.error("Failed to load video metadata", failure ?? "empty response");
          return;
        }
        // Keep whatever the cached library already answered for the fields it
        // owns; this response is authoritative for the rest (topics, champions).
        setMeta((previous) => (previous?.backend === "index" ? { ...data, ...previous, topics: data.topics, champions: data.champions, history: data.history } : data));
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
  }, [suggestionParams]);

  const lectureCategories = useMemo(() => meta?.lectureCategories ?? [], [meta]);
  const suggestions = useMemo(() => meta?.suggestions ?? EMPTY_SUGGESTIONS, [meta]);

  return {
    meta,
    counts: meta?.counts ?? EMPTY_COUNTS,
    lectureCategories,
    suggestions,
    isLoading,
  };
}
