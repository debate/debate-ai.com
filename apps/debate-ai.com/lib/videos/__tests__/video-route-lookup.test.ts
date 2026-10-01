/**
 * @fileoverview Resolving a video from the addresses people actually share.
 *
 * Runs against the JSON fallback (no database is reachable here), fed a few
 * real videos copied from the library's former `data/videos` assets: an old
 * `/videos/watch/<title>-<id>` link, and a round's current and older paths
 * under `/videos`.
 */

import { describe, expect, it, vi } from "vitest";
import { buildVideoRows, type VideoTuple } from "debate-data-sync/src/videos/video-rows";
import { legacyVideoRouteHref, videoRouteHref, type VideoType } from "debate-videos";

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: () => {
    throw new Error("no database in tests");
  },
}));

/** Copied from `rounds-college.json` (descriptions shortened). */
const COLLEGE_ROUNDS = [
  ["uQ1-3BOv_6E", "NDT 2026 - Octas - AFF Kansas LS v NEG Michigan SS", "2026-04-02", "Kansas Debate", 1840, "", 4, "NDT", "Octas", "Kansas LS", "Michigan SS", null, null, null, null, false, null],
  ["qx7Xx_6exzk", "NDT 2022 - Finals - Dartmouth SV (Aff) vs Michigan PR (Neg)", "2022-04-05", "Jacob Wilkus", 23533, "NDT 2022 - Finals", 4, "NDT 2022", "Finals", "Dartmouth SV", "Michigan PR", null, null, null, null, true],
] as unknown as VideoTuple[];

/** Copied from `debate-lectures.json` (description shortened). */
const LECTURES = [
  ["Afl7_hl-H0c", "2022 NDT Finals - Dartmouth SV vs Michigan PR  - Round Analysis Infographic for Classrooms", "2026-08-03", "d3v", 1, "Full Round: https://www.youtube.com/watch?v=qx7Xx_6exzk", "Round Analysis"],
] as unknown as VideoTuple[];

vi.mock("../video-json-source", () => ({
  getVideoRowsFromJson: async () =>
    buildVideoRows({
      rounds: [{ data: COLLEGE_ROUNDS }],
      lectures: { data: LECTURES },
      topPicks: { data: [] },
    }),
}));

const { getVideoBySlug, getVideoByRouteSegments, getVideoPage } = await import(
  "../video-repository"
);

/** Splits a `/videos/...` path into its segments. */
const segmentsOf = (href: string) => href.replace(/^\/videos\//, "").split("/");

describe("getVideoBySlug", () => {
  it("resolves an old watch slug by the video id appended to it", async () => {
    const video = await getVideoBySlug(
      "2022-ndt-finals-dartmouth-sv-vs-michigan-pr-round-analysis-infographic-for-Afl7_hl-H0c",
    );
    expect(video?.[0]).toBe("Afl7_hl-H0c");
  });

  it("resolves a bare title slug", async () => {
    const page = await getVideoPage({ source: "all", limit: 1, offset: 0 });
    const [first] = page.videos;
    const { slugifyVideoTitle } = await import("debate-videos");
    const video = await getVideoBySlug(slugifyVideoTitle(first[1] as string));
    expect(video && slugifyVideoTitle(video[1] as string)).toBe(
      slugifyVideoTitle(first[1] as string),
    );
  });

  it("returns null for a slug naming nothing", async () => {
    expect(await getVideoBySlug("no-such-video-anywhere-zzzz")).toBeNull();
  });
});

describe("getVideoByRouteSegments", () => {
  it("resolves a tagged round at its four-segment and older three-segment paths", async () => {
    const page = await getVideoPage({ source: "all", limit: 200, offset: 0 });
    const round = page.videos.find((v) => {
      const href = videoRouteHref(v as unknown as VideoType);
      return href.split("/").length === 6;
    }) as unknown as VideoType | undefined;
    expect(round).toBeDefined();

    const current = await getVideoByRouteSegments(segmentsOf(videoRouteHref(round!)));
    expect(current?.[0]).toBe(round![0]);

    const legacy = await getVideoByRouteSegments(segmentsOf(legacyVideoRouteHref(round!)));
    expect(legacy && videoRouteHref(legacy as unknown as VideoType)).toBe(
      videoRouteHref(round!),
    );
  });

  it("resolves a round read from a lecture's title, stored under another season", async () => {
    const video = await getVideoByRouteSegments([
      "2022",
      "ndt",
      "finals",
      "dartmouth-sv-michigan-pr",
      "analysis",
    ]);
    expect(video?.[0]).toBe("Afl7_hl-H0c");
  });

  it("resolves the analysis at the four-segment path it had before", async () => {
    const video = await getVideoByRouteSegments([
      "2022",
      "ndt",
      "finals",
      "dartmouth-sv-vs-michigan-pr-round-analysis",
    ]);
    expect(video?.[0]).toBe("Afl7_hl-H0c");
  });

  it("returns null for a path naming nothing", async () => {
    expect(await getVideoByRouteSegments(["2022", "ndt", "finals", "nobody-vs-noone"])).toBeNull();
    expect(await getVideoByRouteSegments(["2022"])).toBeNull();
  });
});
