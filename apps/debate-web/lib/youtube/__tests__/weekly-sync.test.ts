/**
 * @fileoverview Pins what the scheduled YouTube ticks are obliged to do.
 *
 * The new-video scan runs on a daily cron and the view-count refresh on the
 * weekly one, so a pass that silently stops running costs a day or a week
 * before anyone notices. Each pass must report a failure instead of
 * rejecting, and the daily cron string must stay in step with wrangler.jsonc.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const resyncYouTubeRounds = vi.fn();
const resyncVideoViewCounts = vi.fn();
const getDBFromContext = vi.fn();

vi.mock("../resync-rounds", () => ({
  resyncYouTubeRounds: (triggeredBy: string | null, publishedAfterDate?: string, scope?: string) =>
    resyncYouTubeRounds(triggeredBy, publishedAfterDate, scope),
}));
vi.mock("../../videos/resync-view-counts", () => ({
  resyncVideoViewCounts: (db: unknown) => resyncVideoViewCounts(db),
}));
vi.mock("../../database/context", () => ({
  getDBFromContext: () => getDBFromContext(),
}));

const { CRON_TRIGGERED_BY, YOUTUBE_SCAN_CRON, dailyScanScope, runDailyYouTubeScan, runWeeklyYouTubeSync } =
  await import("../weekly-sync");

/** A Tuesday and a Monday, at the cron's 06:00 UTC. */
const TUESDAY = new Date("2026-10-20T06:00:00Z");
const MONDAY = new Date("2026-10-19T06:00:00Z");

/** A successful scan, shaped like `resyncYouTubeRounds`'s return. */
const SCAN = { success: true, runId: 1, channelsSynced: 36, videosFetched: 900, videosUpserted: 12 };

/** A successful refresh, trimmed to the fields asserted on below. */
const REFRESH = { videosChecked: 4200, viewCountsFetched: 4190, missing: 10, updated: 3100 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  getDBFromContext.mockResolvedValue("db");
  resyncYouTubeRounds.mockResolvedValue(SCAN);
  resyncVideoViewCounts.mockResolvedValue(REFRESH);
});

describe("runDailyYouTubeScan", () => {
  it("scans for new videos and nothing else", async () => {
    const result = await runDailyYouTubeScan();

    expect(resyncYouTubeRounds).toHaveBeenCalledOnce();
    expect(resyncVideoViewCounts).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, result: SCAN });
  });

  it("marks the scan as cron-triggered so the run history tells it from an admin's", async () => {
    await runDailyYouTubeScan(TUESDAY);

    expect(resyncYouTubeRounds).toHaveBeenCalledWith(CRON_TRIGGERED_BY, undefined, "active");
    // Not an email, so it can never collide with a real admin's address.
    expect(CRON_TRIGGERED_BY).not.toContain("@");
  });

  it("skips defunct channels except on Mondays", async () => {
    expect(dailyScanScope(TUESDAY)).toBe("active");
    expect(dailyScanScope(MONDAY)).toBe("all");

    await runDailyYouTubeScan(MONDAY);
    expect(resyncYouTubeRounds).toHaveBeenCalledWith(CRON_TRIGGERED_BY, undefined, "all");
  });

  it("reports a failed scan instead of rejecting", async () => {
    resyncYouTubeRounds.mockRejectedValue(new Error("channel listing failed"));

    const result = await runDailyYouTubeScan();

    expect(result).toEqual({ ok: false, error: expect.stringContaining("channel listing failed") });
  });

  it("runs every day, on a schedule wrangler.jsonc declares", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const wrangler = readFileSync(fileURLToPath(new URL("../../../wrangler.jsonc", import.meta.url)), "utf8");

    expect(YOUTUBE_SCAN_CRON.split(" ").slice(2)).toEqual(["*", "*", "*"]);
    expect(wrangler).toContain(`"${YOUTUBE_SCAN_CRON}"`);
  });
});

describe("runWeeklyYouTubeSync", () => {
  it("refreshes view counts without rescanning the channels", async () => {
    const result = await runWeeklyYouTubeSync();

    expect(resyncVideoViewCounts).toHaveBeenCalledExactlyOnceWith("db");
    expect(resyncYouTubeRounds).not.toHaveBeenCalled();
    expect(result).toEqual({ viewCounts: { ok: true, result: REFRESH } });
  });

  it("reports a failed refresh instead of rejecting, so the tick is not an unhandled error", async () => {
    resyncVideoViewCounts.mockRejectedValue(new Error("YouTube API key not configured"));

    const result = await runWeeklyYouTubeSync();

    expect(result.viewCounts).toEqual({
      ok: false,
      error: expect.stringContaining("YouTube API key not configured"),
    });
  });
});
