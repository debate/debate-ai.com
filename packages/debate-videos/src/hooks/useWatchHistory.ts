/**
 * @fileoverview React access to the watch history.
 *
 * Deliberately not props: the grid renders hundreds of memoised cards, and
 * threading a progress map from the page down through the grid, the stack
 * slot and the card would re-render every card on screen each time playback
 * advanced a single record. `useSyncExternalStore` over the store's own
 * subscription gives each card its own subscription to its own video, so a
 * position write re-renders the one card it concerns.
 *
 * @module hooks/useWatchHistory
 */

import { useSyncExternalStore } from "react";
import {
  getWatchHistoryEntry,
  subscribeToWatchHistory,
  watchHistoryById,
  watchStatus,
  type WatchHistoryEntry,
  type WatchStatus,
} from "../state/videoWatchHistory";

/** Server snapshot: nothing is known about a visitor until the client reads it. */
const NO_ENTRY = null;
const EMPTY_HISTORY: Map<string, WatchHistoryEntry> = new Map();

/**
 * One video's watch record, kept current as playback advances.
 *
 * @param videoId - The video to watch (may be empty, which never has a record).
 * @returns Its record, or `null` when it has never been played.
 */
export function useWatchHistoryEntry(videoId: string): WatchHistoryEntry | null {
  return useSyncExternalStore(
    subscribeToWatchHistory,
    () => (videoId ? getWatchHistoryEntry(videoId) : NO_ENTRY),
    () => NO_ENTRY,
  );
}

/**
 * One video's watch status — the band the grid's icon is chosen from.
 *
 * @param videoId - The video to look up.
 * @returns See {@link WatchStatus}.
 */
export function useWatchStatus(videoId: string): WatchStatus {
  return watchStatus(useWatchHistoryEntry(videoId));
}

/**
 * The whole history, for views that list it rather than look one video up.
 *
 * @returns Every watch record, by video id.
 */
export function useWatchHistory(): Map<string, WatchHistoryEntry> {
  return useSyncExternalStore(
    subscribeToWatchHistory,
    watchHistoryById,
    () => EMPTY_HISTORY,
  );
}
