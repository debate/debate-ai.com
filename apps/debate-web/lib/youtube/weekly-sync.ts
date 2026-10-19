/**
 * @fileoverview The scheduled YouTube jobs behind the Worker's cron triggers.
 *
 * `wrangler.jsonc` declares two schedules for them, and the `scheduled` export
 * in `worker/index.ts` tells them apart by `event.cron`:
 *
 * 1. **Scan for new videos — daily** ({@link YOUTUBE_SCAN_CRON}, 06:00 UTC).
 *    {@link resyncYouTubeRounds} walks every subscribed channel's uploads,
 *    classifies which uploads are rounds, and upserts them into the admin
 *    queue. It only ever sees videos a channel published, so it is the half
 *    that finds *new* content, and it runs every day so a round lands in the
 *    queue the day after it is uploaded rather than up to a week later.
 *    Channels with no upload in a year ("defunct", see `isChannelDefunct` in
 *    admin-channels.ts) are left out except on Mondays
 *    ({@link DEFUNCT_SCAN_UTC_DAY}), so a dead channel costs one scan a week
 *    instead of seven; the admin panel can still check them on demand.
 * 2. **Refresh view counts — weekly** (`0 8 * * MON`, Mondays 08:00 UTC).
 *    {@link resyncVideoViewCounts} refetches the watch count of every *already
 *    stored* video — the published `videos` table included, which the scan
 *    never touches — and writes back the ones that moved. Counts are captured
 *    once at ingest and then drift, and the library's "most viewed" sort is
 *    built on them.
 *
 * The daily scan's hour is earlier than the weekly tick's, so on Mondays
 * anything published since the last scan is in the database before the
 * refresh pass enumerates it. The two are separate invocations, so a channel
 * listing blowing up never also costs the library its view counts.
 * @module lib/youtube/weekly-sync
 */

import { getDBFromContext } from "../database/context";
import { describeError } from "../database/errors";
import { resyncVideoViewCounts, type ViewCountResyncResult } from "../videos/resync-view-counts";
import { resyncYouTubeRounds, type ChannelScanScope } from "./resync-rounds";

/**
 * Every day at 06:00 UTC: the new-video scan. Must match the entry in
 * wrangler.jsonc's `triggers.crons`.
 */
export const YOUTUBE_SCAN_CRON = "0 6 * * *";

/**
 * The UTC weekday (Monday) whose daily scan also walks the defunct channels.
 * Same day as the weekly view-count refresh, which runs two hours later.
 */
export const DEFUNCT_SCAN_UTC_DAY = 1;

/** Which channels the daily scan on `now`'s UTC day walks. */
export function dailyScanScope(now: Date = new Date()): ChannelScanScope {
  return now.getUTCDay() === DEFUNCT_SCAN_UTC_DAY ? "all" : "active";
}

/**
 * What the scheduled scan records in `youtube_sync_runs.triggered_by`.
 *
 * That column otherwise holds the admin email that pressed "Resync videos",
 * so a fixed sentinel is what tells the two apart in the run history — and
 * the only evidence, short of Workers Logs, that the cron fired at all. It is
 * not an address, so it can never collide with a real admin.
 */
export const CRON_TRIGGERED_BY = "cron";

/** One pass's outcome: what it did, or why it did not. */
export type WeeklySyncStep<T> = { ok: true; result: T } | { ok: false; error: string };

/** Outcome of the daily new-video scan. See {@link resyncYouTubeRounds}. */
export type DailyYouTubeScanResult = WeeklySyncStep<Awaited<ReturnType<typeof resyncYouTubeRounds>>>;

/** Outcome of one weekly tick. */
export interface WeeklyYouTubeSyncResult {
  /** The view-count refresh. See {@link resyncVideoViewCounts}. */
  viewCounts: WeeklySyncStep<ViewCountResyncResult>;
}

/**
 * Runs one pass, turning a throw into a reported failure.
 *
 * Nothing here rethrows — the caller gets a result either way, and the Worker
 * does not surface a scheduled-handler exception for a pass that failed.
 *
 * @param label - Job name, used for the log line.
 * @param run - The pass to execute.
 * @returns The pass's result, or the flattened error that stopped it.
 */
async function runStep<T>(label: string, run: () => Promise<T>): Promise<WeeklySyncStep<T>> {
  try {
    const result = await run();
    console.log(`Scheduled ${label} finished:`, JSON.stringify(result));
    return { ok: true, result };
  } catch (error) {
    // `describeError` keeps the driver's own complaint, which Drizzle hides
    // behind its "Failed query: …" wrapper.
    const details = describeError(error);
    console.error(`Scheduled ${label} failed:`, details, error);
    return { ok: false, error: details };
  }
}

/**
 * Scans the subscribed channels for new videos — the whole of what the daily
 * {@link YOUTUBE_SCAN_CRON} trigger is for. The same work as the admin page's
 * "Resync videos" button, except that defunct channels are only included on
 * Mondays (see {@link dailyScanScope}).
 *
 * Never rejects — a failed scan is reported in the returned result and logged.
 *
 * @param now - The tick's time; decides whether defunct channels are scanned.
 * @returns The scan's outcome. See {@link DailyYouTubeScanResult}.
 */
export async function runDailyYouTubeScan(now: Date = new Date()): Promise<DailyYouTubeScanResult> {
  const scope = dailyScanScope(now);
  return runStep("YouTube round scan", () => resyncYouTubeRounds(CRON_TRIGGERED_BY, undefined, scope));
}

/**
 * Refreshes the stored view counts — the YouTube half of the weekly cron
 * trigger. The same work as the admin page's "Resync view counts" button.
 *
 * Never rejects — a failed refresh is reported in the returned result and
 * logged, so the weekly tick's other jobs still run.
 *
 * @returns The refresh's outcome. See {@link WeeklyYouTubeSyncResult}.
 */
export async function runWeeklyYouTubeSync(): Promise<WeeklyYouTubeSyncResult> {
  const viewCounts = await runStep("view count refresh", async () =>
    resyncVideoViewCounts(await getDBFromContext()),
  );

  return { viewCounts };
}
