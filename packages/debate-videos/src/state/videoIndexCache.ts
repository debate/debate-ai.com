/**
 * @fileoverview The browser's copy of the whole video library, and the
 * incremental sync that keeps it current.
 *
 * ## Why the library moved into the browser
 *
 * `/api/videos` serves one page per request, so every filter change, season
 * dropdown, search keystroke and scroll-to-bottom was another round trip —
 * for rows the browser had, in most cases, already been sent. The library is
 * also *small*: a few thousand videos, about a megabyte of JSON, and it
 * changes a handful of rows a week. That is a dataset to hold, not to page.
 *
 * So the client fetches it once into `localStorage`, and {@link queryVideoIndex}
 * answers the grid's filter/sort/search locally with the very same functions
 * the server runs (`debate-data-sync/src/videos/video-query`), which is what
 * keeps a locally-served page identical to the one the API would have sent.
 * After the first visit the only request the video pages make is "what
 * changed since `syncedAt`?", which normally answers with an empty list.
 *
 * ## The three things that make a client-side cache go wrong
 *
 * 1. **Staleness.** Every refresh sends the stored cursor and merges what
 *    comes back, so a new video appears on the next page load rather than on
 *    a cache expiry. The grid never waits for it: a hydrated cache serves the
 *    first paint and the delta merges behind it.
 * 2. **Deletions.** A delta cannot express a removed row. The server sends
 *    the library's true `total` with every response, so a merge that does not
 *    match it refetches in full — one extra request on the rare load after a
 *    video is pulled, instead of a tombstone table.
 * 3. **Quota.** `localStorage` is ~5 MB and shared with every other store in
 *    the app. A write that is refused costs the *cache*, never the page: the
 *    index stays in memory for this visit and the next load simply fetches
 *    again.
 *
 * Nothing per-user lives here — favourites, hidden videos and watch history
 * are their own account-synced stores. This is a cache of public library data
 * and is treated as disposable at every point.
 *
 * @module state/videoIndexCache
 */

import grab from "grab-url";
import {
  VIDEO_INDEX_FORMAT_VERSION,
  indexTupleToVideoRow,
  type VideoIndexResponse,
  type VideoIndexTuple,
} from "debate-data-sync/src/videos/video-index";
import {
  computeVideoFacets,
  computeLectureCategories,
  computeVideoSuggestions,
  filterVideoRows,
  queryVideoRows,
  type LectureCategoryFacet,
  type VideoFacets,
  type VideoQueryParams,
  type VideoSuggestions,
} from "debate-data-sync/src/videos/video-query";
import { videoRowToTuple, type VideoRow } from "debate-data-sync/src/videos/video-rows";
import type { VideoType } from "../types/videos";

/** Where the cached index lives in `localStorage`. */
export const VIDEO_INDEX_STORAGE_KEY = "debateVideoIndex";

/**
 * How old a cached index may be before a refresh is forced to run in the
 * foreground rather than merely being scheduled. Only relevant to a tab that
 * stays open for days.
 */
export const VIDEO_INDEX_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** What is kept in `localStorage`. */
interface StoredVideoIndex {
  /** {@link VIDEO_INDEX_FORMAT_VERSION} the rows were written in. */
  version: number;
  /** Cursor to send as `since` on the next refresh. */
  syncedAt: number;
  /** The library, one index tuple per video. */
  rows: VideoIndexTuple[];
}

/** What callers can learn about the cache without reading the library itself. */
export interface VideoIndexState {
  /** Whether the index can answer queries. */
  ready: boolean;
  /** How many videos it holds. */
  count: number;
  /** When it was last synced with the server (epoch ms), `0` when never. */
  syncedAt: number;
  /** Whether the last write to `localStorage` succeeded. */
  persisted: boolean;
  /** Set when the last refresh failed; the cache keeps serving regardless. */
  error: string;
}

/** The library in memory, or `null` before hydration/first fetch. */
let rows: VideoRow[] | null = null;
/** The stored tuples, kept so a delta can be merged and rewritten cheaply. */
let tuples: VideoIndexTuple[] | null = null;
let syncedAt = 0;
let persisted = true;
let lastError = "";
/** Whether `localStorage` has been read this page load. */
let hydrated = false;
/** The in-flight refresh, so concurrent callers share one request. */
let refreshing: Promise<VideoIndexState> | null = null;

const listeners = new Set<() => void>();
/** Snapshot handed to `useSyncExternalStore`; replaced on every change. */
let state: VideoIndexState = {
  ready: false,
  count: 0,
  syncedAt: 0,
  persisted: true,
  error: "",
};

/** Recomputes the public snapshot and tells subscribers. */
function publish(): void {
  state = {
    ready: rows !== null,
    count: rows?.length ?? 0,
    syncedAt,
    persisted,
    error: lastError,
  };
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A broken subscriber must not stop the others hearing about a sync.
    }
  }
}

/**
 * Subscribes to cache changes — hydration, a merged delta, a failed refresh.
 *
 * @param listener - Called after every change.
 * @returns An unsubscribe function.
 */
export function subscribeToVideoIndex(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current cache state; a stable object between changes. */
export function getVideoIndexState(): VideoIndexState {
  return state;
}

/** Whether the cache can answer a query right now. */
export function isVideoIndexReady(): boolean {
  return rows !== null;
}

/** Parses stored tuples into library rows, dropping anything malformed. */
function toRows(stored: VideoIndexTuple[]): VideoRow[] {
  const built: VideoRow[] = [];
  for (const tuple of stored) {
    if (!Array.isArray(tuple)) continue;
    const row = indexTupleToVideoRow(tuple);
    if (row) built.push(row);
  }
  return built;
}

/**
 * Reads the cache out of `localStorage`, once per page load.
 *
 * Called from the feed's own effect rather than at import time: it is a
 * megabyte of JSON to parse, which belongs after the first render and off the
 * server entirely.
 *
 * @returns `true` when an index is now in memory.
 */
export function hydrateVideoIndex(): boolean {
  if (hydrated) return rows !== null;
  hydrated = true;
  if (typeof localStorage === "undefined") return false;

  try {
    const raw = localStorage.getItem(VIDEO_INDEX_STORAGE_KEY);
    if (!raw) return false;
    const stored = JSON.parse(raw) as StoredVideoIndex;
    // A cache written by an older format is not worth interpreting — it is
    // one request to replace it, and a wrong interpretation is a wrong grid.
    if (!stored || stored.version !== VIDEO_INDEX_FORMAT_VERSION || !Array.isArray(stored.rows)) {
      localStorage.removeItem(VIDEO_INDEX_STORAGE_KEY);
      return false;
    }
    tuples = stored.rows;
    rows = toRows(stored.rows);
    syncedAt = typeof stored.syncedAt === "number" ? stored.syncedAt : 0;
    publish();
    return true;
  } catch {
    // Truncated by a quota failure mid-write, or written by something else
    // entirely: drop it and fetch again rather than failing the page.
    try {
      localStorage.removeItem(VIDEO_INDEX_STORAGE_KEY);
    } catch {
      // Nothing more to do; the fetch below is the fallback either way.
    }
    return false;
  }
}

/** Writes the cache back, tolerating a refused quota. */
function persist(): void {
  if (typeof localStorage === "undefined" || !tuples) return;
  try {
    localStorage.setItem(
      VIDEO_INDEX_STORAGE_KEY,
      JSON.stringify({ version: VIDEO_INDEX_FORMAT_VERSION, syncedAt, rows: tuples }),
    );
    persisted = true;
  } catch {
    // Out of quota — this visit still has the index in memory, and a partial
    // write left behind is discarded on the next hydrate.
    persisted = false;
    try {
      localStorage.removeItem(VIDEO_INDEX_STORAGE_KEY);
    } catch {
      // Ignored: the version check on read is the backstop.
    }
  }
}

/** Replaces the cache with a whole library. */
function adopt(payload: VideoIndexResponse): void {
  tuples = payload.rows;
  rows = toRows(payload.rows);
  syncedAt = payload.syncedAt;
  persist();
  publish();
}

/**
 * Merges a delta into the cache.
 *
 * @param payload - A `partial: true` response.
 * @returns `false` when the merge left the cache out of step with the
 *   server's row count, meaning a full refetch is needed.
 */
function merge(payload: VideoIndexResponse): boolean {
  const byId = new Map<string, VideoIndexTuple>();
  for (const tuple of tuples ?? []) {
    if (Array.isArray(tuple) && typeof tuple[0] === "string") byId.set(tuple[0], tuple);
  }
  for (const tuple of payload.rows) {
    if (Array.isArray(tuple) && typeof tuple[0] === "string") byId.set(tuple[0], tuple);
  }

  // The server's count is the authority. A cache that no longer matches it
  // has missed a deletion — the one change a delta cannot describe.
  if (byId.size !== payload.total) return false;

  tuples = [...byId.values()];
  rows = toRows(tuples);
  syncedAt = payload.syncedAt;
  persist();
  publish();
  return true;
}

/** Whether a grab response is usable, given grab resolves errors rather than throwing. */
function isIndexPayload(data: unknown): data is VideoIndexResponse {
  const payload = data as VideoIndexResponse | { error?: string } | null;
  return Boolean(
    payload &&
      !(payload as { error?: string }).error &&
      Array.isArray((payload as VideoIndexResponse).rows),
  );
}

/**
 * Brings the cache up to date: hydrates it, then asks the server for whatever
 * has changed since it was last synced (or for the whole library, the first
 * time or after a format change).
 *
 * Safe to call on every page load and from several places at once — the
 * in-flight request is shared, and a failure leaves the existing cache in
 * place and serving.
 *
 * @param options.force - Fetch the whole library, ignoring the stored cursor.
 * @returns The cache state afterwards.
 */
export async function refreshVideoIndex(
  options: { force?: boolean } = {},
): Promise<VideoIndexState> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    hydrateVideoIndex();
    const full = options.force === true || rows === null || syncedAt <= 0;

    try {
      const payload: VideoIndexResponse = await grab(
        "videos/index",
        full ? {} : { since: String(syncedAt) },
      );
      if (!isIndexPayload(payload)) {
        throw new Error((payload as { error?: string })?.error || "Malformed video index");
      }
      if (payload.version !== VIDEO_INDEX_FORMAT_VERSION) {
        // The server has moved on; take its rows as the whole library and
        // store them under the version this client knows how to read.
        adopt({ ...payload, partial: false });
      } else if (!payload.partial) {
        adopt(payload);
      } else if (!merge(payload)) {
        // A video was removed. One more request, unconditional this time.
        const whole: VideoIndexResponse = await grab("videos/index", {});
        if (isIndexPayload(whole)) adopt(whole);
      }
      lastError = "";
      publish();
    } catch (error) {
      // The cache is an optimisation: a refresh that fails leaves whatever is
      // already cached serving the grid, and the feed falls back to the API
      // when there is nothing cached at all.
      lastError = error instanceof Error ? error.message : "Failed to sync video index";
      console.error("Failed to sync the video index", error);
      publish();
    } finally {
      refreshing = null;
    }
    return state;
  })();

  return refreshing;
}

/** Whether a page load has already scheduled its refresh. */
let scheduled = false;

/**
 * Schedules the one refresh a page load makes: after `load`, at the browser's
 * next idle moment.
 *
 * Deliberately not during render or on mount — the point of the cache is that
 * the page is *faster*, and a megabyte of JSON fetched while the grid is
 * still painting would be a poor trade. Everything the user does in the
 * meantime is served by whatever is already cached, or by the API.
 */
export function scheduleVideoIndexRefresh(): void {
  if (scheduled || typeof window === "undefined") return;
  scheduled = true;

  const run = () => {
    void refreshVideoIndex();
  };
  const atIdle = () => {
    const idle = (window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (typeof idle === "function") idle(run, { timeout: 5_000 });
    else window.setTimeout(run, 1_200);
  };

  if (typeof document !== "undefined" && document.readyState === "complete") atIdle();
  else window.addEventListener("load", atIdle, { once: true });
}

/** Whether the cache is old enough that a refresh should not be deferred. */
export function isVideoIndexStale(now: number = Date.now()): boolean {
  return syncedAt <= 0 || now - syncedAt > VIDEO_INDEX_MAX_AGE_MS;
}

/** One page of a locally-served feed — the shape `/api/videos` would return. */
export interface LocalVideoPage {
  videos: VideoType[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  facets?: VideoFacets;
}

/**
 * Answers a feed request from the cached library.
 *
 * Runs the server's own query functions over the cached rows, so a page
 * served here matches the one `/api/videos` would have returned for the same
 * parameters — including the facet counts, which the season and style
 * dropdowns read.
 *
 * @param params - The same parameters the API takes.
 * @param includeFacets - Whether to compute the dropdown counts.
 * @returns The page, or `null` when the cache is not loaded.
 */
export function queryVideoIndex(
  params: VideoQueryParams,
  includeFacets = false,
): LocalVideoPage | null {
  if (!rows) return null;

  const offset = Math.max(0, params.offset ?? 0);
  const page = queryVideoRows(rows, { ...params, offset });
  return {
    videos: page.rows.map(videoRowToTuple) as VideoType[],
    total: page.total,
    offset,
    limit: params.limit ?? page.rows.length,
    hasMore: offset + page.rows.length < page.total,
    facets: includeFacets ? computeVideoFacets(rows, params) : undefined,
  };
}

/**
 * Resolves stacked playlists from the cache.
 *
 * @param keys - Stack keys read off the rows on screen.
 * @returns Members per key, ordered as the API orders them; `null` when the
 *   cache is not loaded.
 */
export function queryVideoIndexStacks(keys: string[]): Record<string, VideoType[]> | null {
  if (!rows) return null;
  const wanted = new Set(keys.filter(Boolean));
  if (wanted.size === 0) return {};

  const byKey: Record<string, VideoType[]> = {};
  const members = rows
    .filter((row) => row.stackKey && wanted.has(row.stackKey))
    .sort((a, b) => a.stackPosition - b.stackPosition);
  for (const row of members) {
    (byKey[row.stackKey as string] ??= []).push(videoRowToTuple(row) as VideoType);
  }
  // A key with one member is not a stack; the grid would draw flip arrows
  // over a lone video. Same rule the API applies.
  for (const [key, list] of Object.entries(byKey)) {
    if (list.length < 2) delete byKey[key];
  }
  return byKey;
}

/** Library-wide counts, computed locally for the quick-link cards. */
export interface LocalVideoCounts {
  total: number;
  rounds: number;
  lectures: number;
  lecturesOnly: number;
  topPicks: number;
  byStyle: Record<number, number>;
}

/**
 * The counts, category cards and popular searches `/api/videos/meta` serves,
 * computed from the cached library instead.
 *
 * @param params - Scope for the suggestion chips (a category page scopes them).
 * @returns The metadata, or `null` when the cache is not loaded.
 */
export function queryVideoIndexMeta(params: VideoQueryParams = {}): {
  counts: LocalVideoCounts;
  lectureCategories: LectureCategoryFacet[];
  suggestions: VideoSuggestions;
} | null {
  if (!rows) return null;

  const counts: LocalVideoCounts = {
    total: rows.length,
    rounds: 0,
    lectures: 0,
    lecturesOnly: 0,
    topPicks: 0,
    byStyle: {},
  };
  for (const row of rows) {
    if (row.source === "round") counts.rounds += 1;
    else counts.lectures += 1;
    if (row.style === null) counts.lecturesOnly += 1;
    else counts.byStyle[row.style] = (counts.byStyle[row.style] ?? 0) + 1;
    if (row.isTopPick) counts.topPicks += 1;
  }

  // Scoped with the *filter*, not the paged query: the chips describe the
  // whole category the user is looking at, and paging it would rank them off
  // the first sixty rows.
  const scoped = filterVideoRows(rows, { ...params, q: null });
  return {
    counts,
    lectureCategories: computeLectureCategories(rows),
    suggestions: computeVideoSuggestions(scoped.length > 0 ? scoped : rows),
  };
}

/** Every cached row, for callers that want the library itself. */
export function getVideoIndexRows(): VideoRow[] | null {
  return rows;
}

/** Drops the cache from memory and from `localStorage`. */
export function clearVideoIndex(): void {
  rows = null;
  tuples = null;
  syncedAt = 0;
  hydrated = false;
  persisted = true;
  lastError = "";
  try {
    localStorage?.removeItem(VIDEO_INDEX_STORAGE_KEY);
  } catch {
    // Already gone, or storage is unavailable; memory is what mattered.
  }
  publish();
}

/**
 * Resets every module-level piece of state, including the "already hydrated"
 * flag. Exported for tests, which install a fresh `localStorage` per case.
 */
export function resetVideoIndexForTests(): void {
  rows = null;
  tuples = null;
  syncedAt = 0;
  hydrated = false;
  persisted = true;
  lastError = "";
  refreshing = null;
  scheduled = false;
  publish();
}
