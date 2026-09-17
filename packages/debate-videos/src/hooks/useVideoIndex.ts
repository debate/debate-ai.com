/**
 * @fileoverview React access to the browser's copy of the video library.
 *
 * Two things only: a subscription so a view re-renders when the library
 * finishes loading into the browser, and the one-line prefetch a page mounts
 * to start that happening. Everything else about the cache — hydration,
 * merging, eviction — lives in `state/videoIndexCache.ts`, which is
 * framework-free so the feed hooks and the tests can drive it directly.
 *
 * @module hooks/useVideoIndex
 */

import { useEffect, useSyncExternalStore } from "react";
import {
  getVideoIndexState,
  scheduleVideoIndexRefresh,
  subscribeToVideoIndex,
  type VideoIndexState,
} from "../state/videoIndexCache";

/** What the server render sees: nothing is cached until the client says so. */
const SERVER_STATE: VideoIndexState = {
  ready: false,
  count: 0,
  syncedAt: 0,
  persisted: true,
  error: "",
};

/**
 * The cache's state, kept current as it hydrates and syncs.
 *
 * @returns See {@link VideoIndexState}.
 */
export function useVideoIndexState(): VideoIndexState {
  return useSyncExternalStore(subscribeToVideoIndex, getVideoIndexState, () => SERVER_STATE);
}

/** Whether the cached library can answer queries. */
export function useVideoIndexReady(): boolean {
  return useVideoIndexState().ready;
}

/**
 * Starts the library downloading into this browser once the page has loaded.
 *
 * Idempotent across the whole page: several video views can each call it and
 * only one refresh runs.
 */
export function useVideoIndexPrefetch(): void {
  useEffect(() => {
    scheduleVideoIndexRefresh();
  }, []);
}

/**
 * Mountable form of {@link useVideoIndexPrefetch}, for an app shell that wants
 * the library cached on every page rather than only on the video pages.
 */
export function VideoIndexPrefetcher(): null {
  useVideoIndexPrefetch();
  return null;
}
