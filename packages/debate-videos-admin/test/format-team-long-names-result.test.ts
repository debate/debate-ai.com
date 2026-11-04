import { describe, expect, it } from "vitest";
import { formatTeamLongNamesProgress } from "../src/lib/format-team-long-names-result";

const base = { done: 0, total: 0, updated: 0, unresolved: 0, missingTables: [] as string[], finished: true };

describe("formatTeamLongNamesProgress", () => {
  it("says when nothing is left", () => {
    expect(formatTeamLongNamesProgress(base)).toBe("No initials-only teams left to fill.");
  });

  it("reports progress mid-run", () => {
    expect(formatTeamLongNamesProgress({ ...base, done: 2, total: 11, updated: 40, finished: false })).toBe(
      "Working… 2 of 11 seasons, 40 videos filled.",
    );
  });

  it("sums up a finished run with what wasn't found or loaded", () => {
    expect(
      formatTeamLongNamesProgress({ ...base, done: 11, total: 11, updated: 412, unresolved: 3, missingTables: ["hspf 2019"] }),
    ).toBe("Filled 412 videos across 11 of 11 seasons; 3 teams not found in that season's rankings (couldn't load hspf 2019).");
  });
});
