/**
 * @fileoverview The video library's per-user stores — favourites, hidden
 * videos and reports — and the account sync and guest prompt around them.
 *
 * These three were the oldest `localStorage` writes in the package and the
 * only ones a user could *see* go missing: `useVideoState` kept favourites and
 * hidden videos as a bare `Set<string>` serialized straight to
 * `"debateVideosFavorites"` / `"debateVideosHidden"`, and the report dialog
 * pushed an unkeyed object onto `"debateVideoReports"`. Favourite fifty rounds
 * on a laptop, open the phone, and the library was empty again — the
 * "per-browser localStorage, not account-synced" Known gap, on the one tool
 * where a user curates a collection over a whole season.
 *
 * Three things had to change to close it:
 *
 * 1. **A record shape the sync can key.** `saved_tool_records` is keyed by
 *    `(user_id, collection, client_id)` and `toolRecordId` reads that id off a
 *    field of the record, so a JSON array of bare id strings cannot sync at
 *    all. Each store now holds objects — `{ videoId, savedAt }` and friends —
 *    and {@link normalizeVideoIdRecords} reads the legacy array-of-strings
 *    format so an existing browser upgrades on first read instead of losing a
 *    season of favourites to a format change.
 * 2. **Mirroring.** Each mutation calls `mirrorToolRecord*`, the same way
 *    `practiceRounds` and `judgeProfiles` do, so a signed-in save reaches the
 *    account immediately rather than waiting for the watcher's next tick.
 * 3. **Telling a guest.** A signed-out favourite still saves locally — the
 *    library works signed out and that is deliberate — but {@link requireSignIn}
 *    raises a prompt naming the feature, so the user finds out their
 *    collection is browser-only at the moment they start building one, not two
 *    devices later.
 *
 * The exported mutators return the full record list so the calling hook can
 * drive React state from one source of truth, rather than each caller
 * re-reading `localStorage` after every click.
 *
 * @module state/videoLibrary
 */

import {
  mirrorToolRecordDelete,
  mirrorToolRecordSave,
  mirrorToolRecordsClear,
} from "debate-data-sync/src/state/tool-record-mirror";
import { requireSignIn } from "debate-data-sync/src/state/sign-in-prompt";
import { readLocalRecords, writeLocalRecords } from "./localRecordStore";

/** The `localStorage` key and sync collection for favourited videos. */
export const VIDEO_FAVORITES_KEY = "debateVideosFavorites";
/** The `localStorage` key and sync collection for hidden videos. */
export const VIDEO_HIDDEN_KEY = "debateVideosHidden";
/** The `localStorage` key and sync collection for submitted video reports. */
export const VIDEO_REPORTS_KEY = "debateVideoReports";

/** A favourited video. */
export interface VideoFavorite {
  /** The video's id — this record's id within the collection. */
  videoId: string;
  /** When it was favourited, ISO-8601. */
  savedAt: string;
}

/** A video the user has hidden from their grids. */
export interface HiddenVideo {
  videoId: string;
  /** When it was hidden, ISO-8601. */
  hiddenAt: string;
}

/** A report a user submitted about a video. */
export interface VideoReport {
  /** This record's id within the collection. */
  id: string;
  videoId: string;
  title: string;
  report: string;
  /** When it was submitted, ISO-8601. */
  date: string;
}

/**
 * Reads a `{ videoId, … }` store, upgrading the legacy bare-string format.
 *
 * Both formats can be present at once — a browser that favourited videos
 * before this change and then synced from an account that has the new shape —
 * so this normalizes per entry rather than per store, and de-duplicates by
 * `videoId` because the two formats can name the same video.
 *
 * @param key - The store to read.
 * @param stampField - The record's timestamp field.
 * @returns The records, oldest first, one per video.
 */
function normalizeVideoIdRecords<T extends { videoId: string }>(
  key: string,
  stampField: "savedAt" | "hiddenAt",
): T[] {
  const byId = new Map<string, T>();
  for (const entry of readLocalRecords(key)) {
    // The legacy format: a bare video id. Dated to the epoch rather than to
    // now, so an upgrade doesn't reorder a collection built over a season.
    if (typeof entry === "string") {
      if (entry.trim() === "" || byId.has(entry)) continue;
      byId.set(entry, { videoId: entry, [stampField]: new Date(0).toISOString() } as T);
      continue;
    }
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const videoId = record.videoId;
    if (typeof videoId !== "string" || videoId.trim() === "") continue;
    const stamp = record[stampField];
    byId.set(videoId, {
      ...record,
      videoId,
      [stampField]: typeof stamp === "string" ? stamp : new Date(0).toISOString(),
    } as unknown as T);
  }
  return [...byId.values()];
}

/** Every favourited video, oldest first. */
export function listVideoFavorites(): VideoFavorite[] {
  return normalizeVideoIdRecords<VideoFavorite>(VIDEO_FAVORITES_KEY, "savedAt");
}

/** Every hidden video, oldest first. */
export function listHiddenVideos(): HiddenVideo[] {
  return normalizeVideoIdRecords<HiddenVideo>(VIDEO_HIDDEN_KEY, "hiddenAt");
}

/** Every report this browser has submitted, oldest first. */
export function listVideoReports(): VideoReport[] {
  const reports: VideoReport[] = [];
  for (const entry of readLocalRecords(VIDEO_REPORTS_KEY)) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const videoId = typeof record.videoId === "string" ? record.videoId : "";
    if (videoId === "") continue;
    const date = typeof record.date === "string" ? record.date : new Date(0).toISOString();
    reports.push({
      // Reports predating the sync carry no id. Deriving one from the video and
      // the submission time keeps a re-read stable (the same report always
      // produces the same id) without a migration pass over the store.
      id: typeof record.id === "string" && record.id !== "" ? record.id : `${videoId}:${date}`,
      videoId,
      title: typeof record.title === "string" ? record.title : "",
      report: typeof record.report === "string" ? record.report : "",
      date,
    });
  }
  return reports;
}

/** The prompt a guest sees when they favourite a video. */
const FAVORITES_PROMPT = {
  feature: "video favorites",
  message:
    "Your favorites are saved in this browser only. Sign in to keep them on your account and open the same library on every device.",
};

/**
 * Adds or removes a favourite, saving locally either way and prompting a
 * signed-out user to keep the collection on an account.
 *
 * @param videoId - The video to toggle.
 * @param now - Injectable clock, for tests.
 * @returns The full favourites list after the toggle.
 */
export function toggleVideoFavorite(videoId: string, now: () => Date = () => new Date()): VideoFavorite[] {
  const favorites = listVideoFavorites();
  const existing = favorites.findIndex((favorite) => favorite.videoId === videoId);

  if (existing >= 0) {
    const next = favorites.filter((favorite) => favorite.videoId !== videoId);
    writeLocalRecords(VIDEO_FAVORITES_KEY, next);
    mirrorToolRecordDelete(VIDEO_FAVORITES_KEY, videoId);
    // Un-favouriting is not a moment to ask anyone to sign in — the user is
    // removing something, not building a collection worth keeping.
    return next;
  }

  const favorite: VideoFavorite = { videoId, savedAt: now().toISOString() };
  const next = [...favorites, favorite];
  writeLocalRecords(VIDEO_FAVORITES_KEY, next);
  mirrorToolRecordSave(VIDEO_FAVORITES_KEY, favorite);
  requireSignIn(FAVORITES_PROMPT);
  return next;
}

/**
 * Hides a video from the user's grids.
 *
 * @param videoId - The video to hide.
 * @param now - Injectable clock, for tests.
 * @returns The full hidden list afterwards.
 */
export function hideVideo(videoId: string, now: () => Date = () => new Date()): HiddenVideo[] {
  const hidden = listHiddenVideos();
  if (hidden.some((entry) => entry.videoId === videoId)) return hidden;

  const entry: HiddenVideo = { videoId, hiddenAt: now().toISOString() };
  const next = [...hidden, entry];
  writeLocalRecords(VIDEO_HIDDEN_KEY, next);
  mirrorToolRecordSave(VIDEO_HIDDEN_KEY, entry);
  requireSignIn({
    feature: "hidden videos",
    message:
      "This video is hidden in this browser only. Sign in to keep your hidden list on your account across devices.",
  });
  return next;
}

/**
 * Un-hides a video.
 *
 * @param videoId - The video to restore.
 * @returns The full hidden list afterwards.
 */
export function unhideVideo(videoId: string): HiddenVideo[] {
  const next = listHiddenVideos().filter((entry) => entry.videoId !== videoId);
  writeLocalRecords(VIDEO_HIDDEN_KEY, next);
  mirrorToolRecordDelete(VIDEO_HIDDEN_KEY, videoId);
  return next;
}

/**
 * Records a report about a video.
 *
 * @param report - The video, its title and what the user wrote.
 * @param now - Injectable clock, for tests.
 * @returns The stored record.
 */
export function saveVideoReport(
  report: { videoId: string; title: string; report: string },
  now: () => Date = () => new Date(),
): VideoReport {
  const date = now().toISOString();
  const stored: VideoReport = { id: `${report.videoId}:${date}`, ...report, date };
  writeLocalRecords(VIDEO_REPORTS_KEY, [...listVideoReports(), stored]);
  mirrorToolRecordSave(VIDEO_REPORTS_KEY, stored);
  return stored;
}

/** Clears every favourite, locally and on the account. */
export function clearVideoFavorites(): void {
  writeLocalRecords(VIDEO_FAVORITES_KEY, []);
  mirrorToolRecordsClear(VIDEO_FAVORITES_KEY);
}
