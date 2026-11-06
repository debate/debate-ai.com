import { describe, expect, it } from "vitest";

import { buildComputedTitle, videoComputedTitle, videoDisplayTitle } from "../src/lib/computed-title";
import type { VideoType } from "../src/types/videos";

const round = (overrides: Record<number, unknown> = {}): VideoType => {
  const tuple: unknown[] = [
    "abc",
    "Harvard 2026 QF Iowa vs Emory",
    "2026-02-20",
    "Channel",
    10,
    "",
    4,
    "Harvard",
    "Quarters",
    "Iowa EW",
    "Emory GY",
    null,
    null,
    null,
    null,
    null,
    null,
    2026,
  ];
  for (const [i, v] of Object.entries(overrides)) tuple[Number(i)] = v;
  return tuple as VideoType;
};

describe("buildComputedTitle", () => {
  it("prints year, tournament, round, ranks and full last names", () => {
    expect(
      buildComputedTitle(round(), { aff: 6, neg: 1, affNames: "Eltyeb & Weimar", negNames: "Gallagher & Young" }),
    ).toBe("2026 Harvard Quarters: Iowa #6 Eltyeb & Weimar vs Emory #1 Gallagher & Young");
  });

  it("adds the arguments and keeps initials without names", () => {
    expect(buildComputedTitle(round({ 13: "K", 14: "Policy" }))).toBe(
      "2026 Harvard Quarters: Iowa EW (K) vs Emory GY (Policy)",
    );
  });

  it("is null for a lecture", () => {
    expect(buildComputedTitle(["id", "How to flow", "2024-01-01", "c", 1, "", "Lectures"] as VideoType)).toBeNull();
  });
});

describe("videoDisplayTitle", () => {
  it("prefers the stored computed title", () => {
    const video = round({ 18: null, 19: null, 20: "Stored title" });
    expect(videoComputedTitle(video)).toBe("Stored title");
    expect(videoDisplayTitle(video)).toBe("Stored title");
  });

  it("builds one for a round with none stored, and keeps a lecture's own", () => {
    expect(videoDisplayTitle(round())).toBe("2026 Harvard Quarters: Iowa EW vs Emory GY");
    expect(videoDisplayTitle(["id", "How to flow", "2024-01-01", "c", 1, "", "Lectures"] as VideoType)).toBe("How to flow");
  });
});
