/**
 * @fileoverview Video lengths for the grid and list views, fetched lazily by id.
 *
 * Durations are not part of the feed rows (they live in their own
 * `video_durations` table, filled by the admin backfill), so each card or row
 * that renders asks for its video's length here. Requests made in the same
 * tick are batched into one `/api/videos/durations` call per
 * {@link MAX_IDS_PER_REQUEST} ids, and every id is fetched at most once per
 * page load — infinite scroll and stack flipping only ever ask for new ids.
 * @module state/videoDurations
 */

import { useEffect, useSyncExternalStore } from "react";

/** Ids per request; matches the server's own ceiling. */
const MAX_IDS_PER_REQUEST = 200;

/** Seconds per video id; `null` once fetched and known to have none. */
const durations = new Map<string, number | null>();
/** Ids asked for but not yet sent. */
const queued = new Set<string>();
const listeners = new Set<() => void>();
let flushScheduled = false;

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function fetchBatch(ids: string[]): Promise<void> {
  let found: Record<string, number> = {};
  try {
    const response = await fetch(`/api/videos/durations?ids=${encodeURIComponent(ids.join(","))}`);
    if (response.ok) {
      const data = (await response.json()) as { durations?: Record<string, number> };
      found = data?.durations ?? {};
    }
  } catch (error) {
    // A missing length is not worth surfacing: the card simply shows none.
    console.error("Failed to load video durations", error);
  }
  for (const id of ids) {
    const seconds = found[id];
    durations.set(id, typeof seconds === "number" && seconds > 0 ? seconds : null);
  }
  notify();
}

function flush(): void {
  flushScheduled = false;
  const ids = [...queued];
  queued.clear();
  for (let start = 0; start < ids.length; start += MAX_IDS_PER_REQUEST) {
    void fetchBatch(ids.slice(start, start + MAX_IDS_PER_REQUEST));
  }
}

/**
 * Queues a video's length to be fetched, unless it already was.
 *
 * @param videoId - YouTube id.
 */
export function requestVideoDuration(videoId: string): void {
  if (!videoId || durations.has(videoId) || queued.has(videoId)) return;
  queued.add(videoId);
  // Mark it in flight so a second card for the same video does not re-queue it.
  durations.set(videoId, null);
  if (!flushScheduled) {
    flushScheduled = true;
    setTimeout(flush, 0);
  }
}

/**
 * The stored length of one video, fetched on first use.
 *
 * @param videoId - YouTube id.
 * @returns Seconds, or `null` while loading or when no length is stored.
 */
export function useVideoDuration(videoId: string): number | null {
  useEffect(() => {
    requestVideoDuration(videoId);
  }, [videoId]);

  return useSyncExternalStore(
    subscribe,
    () => durations.get(videoId) ?? null,
    () => null,
  );
}

/**
 * Formats a length the way the cards and rows show it.
 *
 * @param totalSeconds - Whole video length in seconds.
 * @returns E.g. `"1h 05m"` for an hour and five minutes, `"42m"`, or `"0:45"`
 *   for anything under a minute.
 */
export function formatVideoDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m`;
  return `0:${String(seconds).padStart(2, "0")}`;
}
