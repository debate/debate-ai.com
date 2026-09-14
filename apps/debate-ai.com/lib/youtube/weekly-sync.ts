/**
 * @fileoverview The weekly YouTube job behind the Worker's cron trigger.
 *
 * `wrangler.jsonc` declares one schedule (`0 8 * * 1` — Mondays 08:00 UTC) and
 * the `scheduled` export in `worker/index.ts` hands the tick to this module.
 * Two things have to happen on that tick, and they are separate passes:
 *
 * 1. **Scan for new videos.** {@link resyncYouTubeRounds} walks every
 *    subscribed channel's uploads, classifies which uploads are rounds, and
 *    upserts them into the admin queue. It only ever sees videos a channel
 *    published, so it is the half that finds *new* content.
 * 2. **Refresh view counts.** {@link resyncVideoViewCounts} refetches the
 *    watch count of every *already stored* video — the published `videos`
 *    table included, which the scan never touches — and writes back the ones
 *    that moved. Counts are captured once at ingest and then drift, and the
 *    library's "most viewed" sort is built on them.
 *
 * The scan runs first so anything published since the last tick is in the
 * database before the refresh pass enumerates it. The refresh then runs
 * regardless of whether the scan succeeded: a single channel listing blowing
 * up should not also cost the library a week of accurate view counts.
 * @module lib/youtube/weekly-sync
 */

import { getDBFromContext } from "../database/context";
import { describeError } from "../database/errors";
import { resyncVideoViewCounts, type ViewCountResyncResult } from "../videos/resync-view-counts";
import { resyncYouTubeRounds } from "./resync-rounds";

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

/** Outcome of one weekly tick. Each pass reports independently. */
export interface WeeklyYouTubeSyncResult {
  /** The new-video scan. See {@link resyncYouTubeRounds}. */
  rounds: WeeklySyncStep<Awaited<ReturnType<typeof resyncYouTubeRounds>>>;
  /** The view-count refresh. See {@link resyncVideoViewCounts}. */
  viewCounts: WeeklySyncStep<ViewCountResyncResult>;
}

/**
 * Runs one pass, turning a throw into a reported failure.
 *
 * Neither pass may abort the other, so nothing here rethrows — the caller
 * gets a result either way and the tick carries on to the next pass.
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
 * Scans the subscribed channels for new videos, then refreshes the stored
 * view counts — the whole of what the weekly cron trigger is for.
 *
 * Both passes call the YouTube API, so they run in sequence rather than
 * concurrently: one tick's worth of requests against the daily quota, spread
 * out, instead of two bursts at once. Together they are the same work the
 * admin page's "Resync videos" and "Resync view counts" buttons do by hand.
 *
 * Never rejects — a failed pass is reported in the returned result and
 * logged, so the tick's other pass still runs and the Worker does not surface
 * a scheduled-handler exception for a job that partly succeeded.
 *
 * @returns Each pass's outcome. See {@link WeeklyYouTubeSyncResult}.
 */
export async function runWeeklyYouTubeSync(): Promise<WeeklyYouTubeSyncResult> {
  const rounds = await runStep("YouTube round scan", () => resyncYouTubeRounds(CRON_TRIGGERED_BY));

  const viewCounts = await runStep("view count refresh", async () =>
    resyncVideoViewCounts(await getDBFromContext()),
  );

  return { rounds, viewCounts };
}
