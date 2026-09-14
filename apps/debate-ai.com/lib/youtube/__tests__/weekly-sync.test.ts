/**
 * @fileoverview Pins what the weekly cron tick is obliged to do.
 *
 * The trigger in `wrangler.jsonc` fires once a week, so a pass that silently
 * stops running costs seven days before anyone notices. Two rules matter and
 * neither is visible from reading either pass on its own: the view-count
 * refresh runs on every tick, and it runs *even when the new-video scan
 * throws* — a channel listing that 403s must not also freeze the library's
 * view counts. The scan is ordered first so videos published since the last
 * tick are in the database before the refresh enumerates them.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const resyncYouTubeRounds = vi.fn();
const resyncVideoViewCounts = vi.fn();
const getDBFromContext = vi.fn();

vi.mock("../resync-rounds", () => ({
  resyncYouTubeRounds: (triggeredBy: string | null) => resyncYouTubeRounds(triggeredBy),
}));
vi.mock("../../videos/resync-view-counts", () => ({
  resyncVideoViewCounts: (db: unknown) => resyncVideoViewCounts(db),
}));
vi.mock("../../database/context", () => ({
  getDBFromContext: () => getDBFromContext(),
}));

const { CRON_TRIGGERED_BY, runWeeklyYouTubeSync } = await import("../weekly-sync");

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

describe("runWeeklyYouTubeSync", () => {
  it("scans for new videos and refreshes view counts on one tick", async () => {
    const result = await runWeeklyYouTubeSync();

    expect(resyncYouTubeRounds).toHaveBeenCalledOnce();
    expect(resyncVideoViewCounts).toHaveBeenCalledExactlyOnceWith("db");
    expect(result).toEqual({
      rounds: { ok: true, result: SCAN },
      viewCounts: { ok: true, result: REFRESH },
    });
  });

  it("scans before refreshing, so new videos are stored before they are counted", async () => {
    const order: string[] = [];
    resyncYouTubeRounds.mockImplementation(async () => {
      order.push("scan");
      return SCAN;
    });
    resyncVideoViewCounts.mockImplementation(async () => {
      order.push("refresh");
      return REFRESH;
    });

    await runWeeklyYouTubeSync();

    expect(order).toEqual(["scan", "refresh"]);
  });

  it("marks the scan as cron-triggered so the run history tells it from an admin's", async () => {
    await runWeeklyYouTubeSync();

    expect(resyncYouTubeRounds).toHaveBeenCalledWith(CRON_TRIGGERED_BY);
    // Not an email, so it can never collide with a real admin's address.
    expect(CRON_TRIGGERED_BY).not.toContain("@");
  });

  it("still refreshes view counts when the scan throws", async () => {
    resyncYouTubeRounds.mockRejectedValue(new Error("channel listing failed"));

    const result = await runWeeklyYouTubeSync();

    expect(resyncVideoViewCounts).toHaveBeenCalledOnce();
    expect(result.rounds).toEqual({ ok: false, error: expect.stringContaining("channel listing failed") });
    expect(result.viewCounts).toEqual({ ok: true, result: REFRESH });
  });

  it("reports a failed refresh instead of rejecting, so the tick is not an unhandled error", async () => {
    resyncVideoViewCounts.mockRejectedValue(new Error("YouTube API key not configured"));

    const result = await runWeeklyYouTubeSync();

    expect(result.rounds.ok).toBe(true);
    expect(result.viewCounts).toEqual({
      ok: false,
      error: expect.stringContaining("YouTube API key not configured"),
    });
  });
});
