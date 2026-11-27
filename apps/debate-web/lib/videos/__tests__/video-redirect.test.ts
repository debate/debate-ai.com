/**
 * @fileoverview Old round addresses redirect to the short `/<topic code>/…`
 * one. Resolves a request the way the watch page does (`resolveVideoRoute`,
 * then `videoRedirectTarget`) over a few real rounds copied from the library.
 */

import { describe, expect, it, vi } from "vitest";
import { buildVideoRows, type VideoTuple } from "@debate-ai/videos/src/data/video-rows";
import type { VideoType } from "@debate-ai/videos";

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: () => {
    throw new Error("no database in tests");
  },
}));

const ROUNDS = [
  ["kyR3michDtm", "Kentucky 2026 - Round 3 - Michigan GV vs Dartmouth CG", "2026-10-10", "Kentucky Debate", 120, "", 4, "Kentucky", "Round 3", "Michigan GV", "Dartmouth CG", null, null, null, null, false, null, 2027],
  ["qx7Xx_6exzk", "NDT 2022 - Finals - Dartmouth SV (Aff) vs Michigan PR (Neg)", "2022-04-05", "Jacob Wilkus", 23533, "NDT 2022 - Finals", 4, "NDT 2022", "Finals", "Dartmouth SV", "Michigan PR", null, null, null, null, true],
  ["ldNovRound1", "Harvard 2022 - Octas - Alpha AB vs Beta CD", "2022-11-12", "LD", 100, "", 3, "Harvard", "Octafinals", "Alpha AB", "Beta CD", null, null, null, null, false, null, 2023],
] as unknown as VideoTuple[];

vi.mock("@debate-ai/webview/lib/videos/video-json-source", () => ({
  getVideoRowsFromJson: async () =>
    buildVideoRows({ rounds: [{ data: ROUNDS }], lectures: { data: [] }, topPicks: { data: [] } }),
}));

const { resolveVideoRoute } = await import("../video-repository");
const { videoRedirectTarget } = await import("../video-redirect");

/** What the page answers a request for `path` with: a redirect target, `current`, or `missing`. */
async function answer(path: string, query: Record<string, string | string[]> = {}, segments?: string[]) {
  const matched = await resolveVideoRoute(segments ?? path.replace(/^\/videos\//, "").split("/"));
  if (!matched) return "missing";
  return videoRedirectTarget(matched.video as unknown as VideoType, matched.suffix, query, path) ?? "current";
}

describe("a round's old /videos address", () => {
  it("308s to the topic-code address", async () => {
    expect(await answer("/videos/26-27/cpd/kentucky/r3/michigan-gv-dartmouth-cg")).toBe(
      "/cpd27/kentucky/r3/michigan-gv-dartmouth-cg",
    );
    expect(await answer("/videos/21-22/cpd/ndt/finals/dartmouth-sv-michigan-pr")).toBe(
      "/cpd22/ndt/finals/dartmouth-sv-michigan-pr",
    );
  });

  it("keeps the speech and view after it", async () => {
    expect(await answer("/videos/26-27/cpd/kentucky/r3/michigan-gv-dartmouth-cg/1nc/llm")).toBe(
      "/cpd27/kentucky/r3/michigan-gv-dartmouth-cg/1nc/llm",
    );
    expect(await answer("/videos/26-27/cpd/kentucky/r3/michigan-gv-dartmouth-cg/2ar")).toBe(
      "/cpd27/kentucky/r3/michigan-gv-dartmouth-cg/2ar/summary",
    );
  });

  it("keeps other query parameters and folds the old speech parameters into the path", async () => {
    expect(
      await answer("/videos/26-27/cpd/kentucky/r3/michigan-gv-dartmouth-cg", { t: "90", speech: "2ar", tab: "alternatives" }),
    ).toBe("/cpd27/kentucky/r3/michigan-gv-dartmouth-cg/2ar/alternatives?t=90");
  });

  it("follows the older spellings through to the short address", async () => {
    // Bare-year season, a long prelim name and the pre-format path.
    expect(await answer("/videos/2027/cpd/kentucky/round-3/michigan-gv-dartmouth-cg")).toBe(
      "/cpd27/kentucky/r3/michigan-gv-dartmouth-cg",
    );
    expect(await answer("/videos/2022/ndt/finals/dartmouth-sv-michigan-pr")).toBe(
      "/cpd22/ndt/finals/dartmouth-sv-michigan-pr",
    );
  });

  it("gives an LD round the letter of the topic it was published under", async () => {
    expect(await answer("/videos/22-23/ld/harvard/octafinals/alpha-ab-beta-cd")).toBe(
      "/ldb23/harvard/octafinals/alpha-ab-beta-cd",
    );
  });
});

describe("a round's short address, read back as the /videos segments it stands for", () => {
  it("is already current, speech and view included", async () => {
    const segments = ["26-27", "cpd", "kentucky", "r3", "michigan-gv-dartmouth-cg"];
    expect(await answer("/cpd27/kentucky/r3/michigan-gv-dartmouth-cg", {}, segments)).toBe("current");
    expect(await answer("/cpd27/kentucky/r3/michigan-gv-dartmouth-cg/1nc/llm", {}, [...segments, "1nc", "llm"])).toBe("current");
  });

  it("redirects a code in another case to the lowercase one", async () => {
    const segments = ["26-27", "cpd", "kentucky", "r3", "michigan-gv-dartmouth-cg"];
    expect(await answer("/CPD27/kentucky/r3/michigan-gv-dartmouth-cg", {}, segments)).toBe(
      "/cpd27/kentucky/r3/michigan-gv-dartmouth-cg",
    );
  });

  it("finds nothing under another season's code, and redirects another LD topic's letter to the video's own", async () => {
    expect(await answer("/cpd26/kentucky/r3/michigan-gv-dartmouth-cg", {}, ["25-26", "cpd", "kentucky", "r3", "michigan-gv-dartmouth-cg"])).toBe("missing");
    expect(await answer("/lda23/harvard/octafinals/alpha-ab-beta-cd", {}, ["22-23", "ld", "harvard", "octafinals", "alpha-ab-beta-cd"])).toBe(
      "/ldb23/harvard/octafinals/alpha-ab-beta-cd",
    );
  });
});
