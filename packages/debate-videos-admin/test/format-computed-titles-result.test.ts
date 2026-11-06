import { describe, expect, it } from "vitest";
import { formatComputedTitlesProgress } from "../src/lib/format-computed-titles-result";

const base = { done: 1, total: 3, updated: 5, titled: 40, ranked: 12, missingTables: [] as string[], finished: false };

describe("formatComputedTitlesProgress", () => {
  it("reports progress, then the totals", () => {
    expect(formatComputedTitlesProgress(base)).toBe("Working… 1 of 3 seasons, 40 videos titled (5 updated, 12 teams ranked).");
    expect(formatComputedTitlesProgress({ ...base, done: 3, finished: true, missingTables: ["hspf 2019"] })).toBe(
      "Done: 40 videos titled across 3 of 3 seasons (5 updated, 12 teams ranked). Couldn't load hspf 2019.",
    );
  });

  it("says so when there is nothing to title", () => {
    expect(formatComputedTitlesProgress({ ...base, total: 0 })).toBe("No videos to title.");
  });
});
