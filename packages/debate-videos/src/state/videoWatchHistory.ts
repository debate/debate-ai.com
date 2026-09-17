/**
 * @fileoverview The per-user watch history: how far into each video the user
 * has actually got, kept per browser and synced to the account.
 *
 * The library already remembered *where* a video was paused — `videoPlayerPersistence`
 * keeps a rolling window of fifty timestamps for 24 hours so the floating
 * player can resume mid-sentence. That is a resume cursor, not a history: it
 * expires, it is capped at fifty, it never reaches the account, and nothing in
 * the grid reads it. A user who watched two thirds of a 2019 NDT final last
 * season had no way to see that from the grid, and no way to see it at all on
 * another device.
 *
 * This store is the history half:
 *
 * - **One record per video, keyed by `videoId`**, in the shape
 *   `saved_tool_records` can sync — so `debateVideoWatchHistory` is a catalog
 *   collection like favourites and hidden videos, and a signed-in user's
 *   history follows them between devices. Signed out it still works, in this
 *   browser, like every other store here.
 * - **Percentage, not just seconds.** A position alone says nothing without
 *   the video's length, and nothing in the `videos` table stores a duration —
 *   so the duration the embed reports is recorded alongside the position, and
 *   {@link watchPercent} is what the grid actually renders.
 * - **Written from the player's own message handler**, throttled here rather
 *   than at each call site: both players post a position several times a
 *   second, and the grid only needs a coarse record of it.
 *
 * @module state/videoWatchHistory
 */

import {
  mirrorToolRecordSave,
  mirrorToolRecordDelete,
  mirrorToolRecordsClear,
} from "debate-data-sync/src/state/tool-record-mirror";
import { readLocalRecords, writeLocalRecords } from "./localRecordStore";

/** The `localStorage` key and sync collection for the watch history. */
export const VIDEO_WATCH_HISTORY_KEY = "debateVideoWatchHistory";

/**
 * How many videos the history keeps, newest-watched first.
 *
 * Generous — a season of heavy viewing is a few hundred videos — but bounded,
 * because the whole store is serialized on every write and pushed to the
 * account as individual records.
 */
export const MAX_WATCH_HISTORY_ENTRIES = 500;

/**
 * How long between two local writes for the same video, in ms.
 *
 * The embed reports its position roughly every 250ms while playing; at that
 * rate the store would be rewritten (and re-pushed) hundreds of times per
 * video. Twenty seconds keeps the grid honest to within a fraction of a
 * percent on anything but the shortest clip, and a pause, an ended video or a
 * page leave flushes immediately anyway.
 */
export const WATCH_PROGRESS_WRITE_INTERVAL_MS = 20_000;

/** Below this many seconds of playback a video is not considered started. */
export const MIN_TRACKED_SECONDS = 5;

/** At or above this percentage a video counts as watched all the way through. */
export const WATCHED_PERCENT = 90;

/** At or above this percentage a video counts as mostly watched. */
export const MOSTLY_WATCHED_PERCENT = 55;

/** At or above this percentage a video counts as partly watched. */
export const PARTLY_WATCHED_PERCENT = 20;

/** One video's watch record. */
export interface WatchHistoryEntry {
  /** The video's id — this record's id within the collection. */
  videoId: string;
  /** Furthest-known playback position, in whole seconds. */
  positionSeconds: number;
  /** The video's length in whole seconds, `0` when the embed never said. */
  durationSeconds: number;
  /** The video's title when it was watched, so a history list can name it. */
  title: string;
  /** When it was last watched, ISO-8601. */
  watchedAt: string;
  /**
   * Whether playback ran to the end. Set when the embed reports its "ended"
   * state, which is the only reliable signal for it: a user who skips the
   * last thirty seconds of an hour-long round has still finished watching it,
   * and a position alone cannot say that.
   */
  completed: boolean;
}

/**
 * How far through a video the user is, as the grid describes it.
 *
 * `"unwatched"` is never stored — it is what {@link watchStatus} answers for a
 * video with no record, so callers can switch on one value.
 */
export type WatchStatus = "unwatched" | "started" | "partly" | "mostly" | "watched";

/** Human-readable label per status, used by the badge and its tooltip. */
export const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  unwatched: "Not watched",
  started: "Just started",
  partly: "Partly watched",
  mostly: "Mostly watched",
  watched: "Watched",
};

/**
 * Reads and normalizes every stored record, tolerating anything a browser or
 * an older version of this store hands back.
 *
 * @returns One record per video, in stored order (oldest first).
 */
export function listWatchHistory(): WatchHistoryEntry[] {
  const byId = new Map<string, WatchHistoryEntry>();
  for (const raw of readLocalRecords(VIDEO_WATCH_HISTORY_KEY)) {
    if (typeof raw !== "object" || raw === null) continue;
    const record = raw as Record<string, unknown>;
    const videoId = typeof record.videoId === "string" ? record.videoId.trim() : "";
    if (videoId === "") continue;
    byId.set(videoId, {
      videoId,
      positionSeconds: finiteSeconds(record.positionSeconds),
      durationSeconds: finiteSeconds(record.durationSeconds),
      title: typeof record.title === "string" ? record.title : "",
      watchedAt:
        typeof record.watchedAt === "string" ? record.watchedAt : new Date(0).toISOString(),
      completed: record.completed === true,
    });
  }
  return [...byId.values()];
}

/** Coerces a stored number into a non-negative whole number of seconds. */
function finiteSeconds(value: unknown): number {
  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(seconds);
}

/**
 * The history as a lookup, cached so the grid's hundreds of cards share one
 * parse of the store rather than each re-reading `localStorage`.
 */
let cache: Map<string, WatchHistoryEntry> | null = null;

/** Subscribers to re-read the history — see {@link subscribeToWatchHistory}. */
const listeners = new Set<() => void>();

/** Whether the cross-tab/account-merge `storage` listener is attached. */
let storageBound = false;

/** Drops the cache and tells every subscriber to re-read. */
function invalidate(): void {
  cache = null;
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // One broken subscriber must not stop the others hearing about a write.
    }
  }
}

/**
 * The history keyed by video id, from cache when it is warm.
 *
 * The returned map is shared and must not be mutated by callers; it is
 * replaced wholesale whenever the store changes, which is what lets
 * `useSyncExternalStore` compare snapshots by identity.
 *
 * @returns Every watch record, by video id.
 */
export function watchHistoryById(): Map<string, WatchHistoryEntry> {
  if (!cache) {
    cache = new Map(listWatchHistory().map((entry) => [entry.videoId, entry]));
  }
  return cache;
}

/**
 * One video's watch record.
 *
 * @param videoId - The video to look up.
 * @returns Its record, or `null` when the video has never been watched.
 */
export function getWatchHistoryEntry(videoId: string): WatchHistoryEntry | null {
  return watchHistoryById().get(videoId) ?? null;
}

/**
 * Subscribes to watch-history changes — this tab's own writes, another tab's,
 * and the account merge that runs on sign-in.
 *
 * @param listener - Called after every change.
 * @returns An unsubscribe function.
 */
export function subscribeToWatchHistory(listener: () => void): () => void {
  listeners.add(listener);
  bindStorageListener();
  return () => {
    listeners.delete(listener);
  };
}

/** Attaches the `storage` listener once, if this host has a window. */
function bindStorageListener(): void {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (event: StorageEvent) => {
    // `null` is `localStorage.clear()` per the StorageEvent spec.
    if (event.key === null || event.key === VIDEO_WATCH_HISTORY_KEY) invalidate();
  });
}

/**
 * How much of a video has been watched, as a percentage of its length.
 *
 * @param entry - The video's record, or `null`/`undefined` for an unwatched one.
 * @returns 0–100; `100` for a completed video, `0` when the length is unknown.
 */
export function watchPercent(entry: WatchHistoryEntry | null | undefined): number {
  if (!entry) return 0;
  if (entry.completed) return 100;
  if (entry.durationSeconds <= 0) return 0;
  const percent = (entry.positionSeconds / entry.durationSeconds) * 100;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(100, Math.round(percent));
}

/**
 * Which band of the history a video falls in — what decides the grid's icon.
 *
 * A record whose duration the embed never reported still counts as `"started"`
 * rather than as unwatched: the user did play it, and a badge saying so with
 * no percentage is more honest than no badge at all.
 *
 * @param entry - The video's record, or `null` for an unwatched one.
 * @returns See {@link WatchStatus}.
 */
export function watchStatus(entry: WatchHistoryEntry | null | undefined): WatchStatus {
  if (!entry) return "unwatched";
  if (entry.completed) return "watched";
  if (entry.positionSeconds < MIN_TRACKED_SECONDS) return "unwatched";
  const percent = watchPercent(entry);
  if (percent >= WATCHED_PERCENT) return "watched";
  if (percent >= MOSTLY_WATCHED_PERCENT) return "mostly";
  if (percent >= PARTLY_WATCHED_PERCENT) return "partly";
  return "started";
}

/** Formats a whole number of seconds as `h:mm:ss` or `m:ss`. */
export function formatWatchClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

/**
 * The sentence the grid's tooltip shows for a watched video.
 *
 * @param entry - The video's record.
 * @returns E.g. `"Mostly watched — 68% (42:10 of 1:01:44)"`.
 */
export function describeWatchProgress(entry: WatchHistoryEntry): string {
  const label = WATCH_STATUS_LABELS[watchStatus(entry)];
  if (entry.durationSeconds <= 0) {
    return `${label} — ${formatWatchClock(entry.positionSeconds)} watched`;
  }
  const percent = watchPercent(entry);
  const position = entry.completed ? entry.durationSeconds : entry.positionSeconds;
  return `${label} — ${percent}% (${formatWatchClock(position)} of ${formatWatchClock(
    entry.durationSeconds,
  )})`;
}

/** When each video was last written, so playback can be throttled per video. */
const lastWriteAt = new Map<string, number>();

/** What the caller knows about one moment of playback. */
export interface WatchProgressUpdate {
  videoId: string;
  /** Current playback position in seconds, as the embed reports it. */
  positionSeconds: number;
  /** The video's length in seconds; `0`/omitted when the embed never said. */
  durationSeconds?: number;
  /** The video's title, stored so a history list can name it. */
  title?: string;
  /** Set when playback reached the end. Always written, never throttled. */
  completed?: boolean;
  /**
   * Bypasses the throttle — used when playback pauses, ends, or the page is
   * being left, where the next position report may never come.
   */
  flush?: boolean;
}

/**
 * Records where playback has got to, throttled per video.
 *
 * Safe to call from a message handler on every position report: most calls
 * return `null` without touching `localStorage`. A record only ever moves
 * *forward* through a video unless the user seeks back more than a trivial
 * amount, so scrubbing to check one card in a round does not erase the fact
 * that the round was watched.
 *
 * @param update - See {@link WatchProgressUpdate}.
 * @param now - Injectable clock, for tests.
 * @returns The stored record, or `null` when the update was throttled or ignored.
 */
export function recordWatchProgress(
  update: WatchProgressUpdate,
  now: () => Date = () => new Date(),
): WatchHistoryEntry | null {
  const videoId = update.videoId?.trim();
  if (!videoId) return null;

  const position = finiteSeconds(update.positionSeconds);
  const completed = update.completed === true;
  if (!completed && position < MIN_TRACKED_SECONDS) return null;

  const at = now().getTime();
  const last = lastWriteAt.get(videoId);
  const due =
    completed ||
    update.flush === true ||
    last === undefined ||
    at - last >= WATCH_PROGRESS_WRITE_INTERVAL_MS;
  if (!due) return null;

  const history = listWatchHistory();
  const existing = history.find((entry) => entry.videoId === videoId) ?? null;
  const duration = finiteSeconds(update.durationSeconds) || existing?.durationSeconds || 0;

  const entry: WatchHistoryEntry = {
    videoId,
    // Furthest point reached, not the current one: the position goes backwards
    // whenever the user rewinds to re-hear an argument, and a history that
    // followed it would forget a video the moment it was re-examined.
    positionSeconds: Math.max(position, existing?.positionSeconds ?? 0),
    durationSeconds: duration,
    title: update.title?.trim() || existing?.title || "",
    watchedAt: new Date(at).toISOString(),
    completed: completed || existing?.completed === true,
  };

  // Nothing moved and nothing new was learned: skip the write (and the push
  // the sync watcher would make from it) rather than restamping the record.
  if (
    existing &&
    existing.positionSeconds === entry.positionSeconds &&
    existing.durationSeconds === entry.durationSeconds &&
    existing.completed === entry.completed &&
    existing.title === entry.title
  ) {
    lastWriteAt.set(videoId, at);
    return existing;
  }

  const next = [...history.filter((record) => record.videoId !== videoId), entry]
    // Newest last, so the cap below drops the least recently watched videos.
    .sort((a, b) => a.watchedAt.localeCompare(b.watchedAt))
    .slice(-MAX_WATCH_HISTORY_ENTRIES);

  writeLocalRecords(VIDEO_WATCH_HISTORY_KEY, next);
  lastWriteAt.set(videoId, at);
  invalidate();
  mirrorToolRecordSave(VIDEO_WATCH_HISTORY_KEY, entry);
  return entry;
}

/**
 * Forgets one video.
 *
 * @param videoId - The video to drop from the history.
 * @returns The history afterwards.
 */
export function forgetWatchedVideo(videoId: string): WatchHistoryEntry[] {
  const next = listWatchHistory().filter((entry) => entry.videoId !== videoId);
  writeLocalRecords(VIDEO_WATCH_HISTORY_KEY, next);
  lastWriteAt.delete(videoId);
  invalidate();
  mirrorToolRecordDelete(VIDEO_WATCH_HISTORY_KEY, videoId);
  return next;
}

/** Clears the whole history, locally and on the account. */
export function clearWatchHistory(): void {
  writeLocalRecords(VIDEO_WATCH_HISTORY_KEY, []);
  lastWriteAt.clear();
  invalidate();
  mirrorToolRecordsClear(VIDEO_WATCH_HISTORY_KEY);
}

/**
 * Drops the in-memory cache and throttle state.
 *
 * Exported for tests, which install a fresh `localStorage` per case and would
 * otherwise read the previous one's cache.
 */
export function resetWatchHistoryCache(): void {
  lastWriteAt.clear();
  invalidate();
}
