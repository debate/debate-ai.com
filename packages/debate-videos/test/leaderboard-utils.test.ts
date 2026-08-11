import { describe, expect, it } from "vitest";
import {
  DIVISION_CONFIG,
  VALID_DIVISIONS,
  getNumericValue,
  getStringValue,
  hasValue,
  sortEntries,
} from "../src/panels/leaderboard/leaderboardUtils";
import type { LeaderboardEntry } from "debate-data-sync/src/rankings/sync-rankings-debatedrills";

const entry = (over: Partial<LeaderboardEntry>) =>
  ({ teamName: "Team", rank: "--", eloRank: "--", ...over }) as LeaderboardEntry;

describe("cell value helpers", () => {
  it("maps empty cells to -Infinity so they sort last", () => {
    expect(getNumericValue(null)).toBe(-Infinity);
    expect(getNumericValue(undefined)).toBe(-Infinity);
    expect(getNumericValue("--")).toBe(-Infinity);
    expect(getNumericValue("not a number")).toBe(-Infinity);
  });

  it("coerces numeric strings", () => {
    expect(getNumericValue("42")).toBe(42);
    expect(getNumericValue(7)).toBe(7);
  });

  it("lowercases string cells and blanks out nullish ones", () => {
    expect(getStringValue("Michigan")).toBe("michigan");
    expect(getStringValue(null)).toBe("");
    expect(getStringValue(undefined)).toBe("");
  });

  it("treats the -- placeholder as no value", () => {
    expect(hasValue("--")).toBe(false);
    expect(hasValue(null)).toBe(false);
    expect(hasValue(0)).toBe(true);
  });
});

describe("sortEntries", () => {
  const entries = [
    entry({ teamName: "B", rank: 2, eloRank: 4 }),
    entry({ teamName: "A", rank: 1, eloRank: 9 }),
    entry({ teamName: "C", rank: "--", eloRank: "--" }),
  ];

  it("returns the input untouched when no sort is active", () => {
    expect(sortEntries(entries, null)).toBe(entries);
  });

  it("does not mutate the input array", () => {
    const copy = [...entries];
    sortEntries(entries, { key: "rank", dir: "asc" });
    expect(entries).toEqual(copy);
  });

  it("sorts ascending by rank with empty cells last", () => {
    const sorted = sortEntries(entries, { key: "rank", dir: "asc" });
    expect(sorted.map((e) => e.teamName)).toEqual(["A", "B", "C"]);
  });

  it("keeps empty cells last when sorting descending", () => {
    const sorted = sortEntries(entries, { key: "rank", dir: "desc" });
    expect(sorted[sorted.length - 1].teamName).toBe("C");
  });

  it("sorts by the derived elo-to-bid ratio", () => {
    const sorted = sortEntries(entries, { key: "eloToBid", dir: "asc" });
    expect(sorted.map((e) => e.teamName)).toEqual(["B", "A", "C"]);
  });

  it("sorts state alphabetically", () => {
    const byState = [
      entry({ teamName: "X", state: "TX" }),
      entry({ teamName: "Y", state: "CA" }),
    ];
    expect(
      sortEntries(byState, { key: "state", dir: "asc" }).map((e) => e.teamName),
    ).toEqual(["Y", "X"]);
  });
});

describe("division config", () => {
  it("describes every valid division exactly once", () => {
    expect(DIVISION_CONFIG.map((d) => d.value).sort()).toEqual(
      [...VALID_DIVISIONS].sort(),
    );
  });

  it("gives every division a label and a logo", () => {
    for (const division of DIVISION_CONFIG) {
      expect(division.label.length, division.value).toBeGreaterThan(0);
      expect(division.logoSrc, division.value).toMatch(/^https?:\/\//);
    }
  });
});
