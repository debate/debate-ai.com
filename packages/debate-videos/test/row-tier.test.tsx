/**
 * @fileoverview Pins the leaderboard highlight tiers: each list's legendary
 * group is the 90+ or 80+ count closest to five (capped at seven), ratings of
 * 80+ (bold 8 or 9) are gold, and the Schools table marks its rows to match.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { legendaryCount, rowTier } from "../src/panels/leaderboard/rowTier";
import { SchoolRankingsTable } from "../src/panels/leaderboard/SchoolRankingsTable";
import type { SchoolRanking } from "../src/panels/leaderboard/leaderboardTypes";

describe("legendaryCount", () => {
  const list = (...counts: [number, number][]) => counts.flatMap(([rating, n]) => Array(n).fill(rating));

  it("takes the 90+ count when it is closer to five than the 80+ count", () => {
    // Four 90s, ten more 80s: 4 is closer to 5 than 14.
    expect(legendaryCount(list([95, 4], [85, 10], [60, 50]))).toBe(4);
  });

  it("takes the 80+ count when it is closer to five", () => {
    expect(legendaryCount(list([92, 1], [84, 5], [60, 50]))).toBe(6);
    // No 90s at all: the empty count never wins.
    expect(legendaryCount(list([87, 1], [81, 3], [70, 40]))).toBe(4);
  });

  it("picks the higher cutoff on a tie", () => {
    expect(legendaryCount(list([91, 3], [82, 4], [50, 9]))).toBe(3);
  });

  it("rounds ratings the way the table shows them", () => {
    expect(legendaryCount(list([89.6, 2], [89.4, 6], [50, 9]))).toBe(2);
  });

  it("keeps going down by tens when no row reaches 80", () => {
    expect(legendaryCount(list([77, 2], [66, 20]))).toBe(2);
    expect(legendaryCount([])).toBe(0);
  });

  it("never makes more than seven rows legendary", () => {
    expect(legendaryCount(list([85, 9], [60, 40]))).toBe(7);
  });
});

describe("rowTier", () => {
  it("makes ranks within the legendary count legendary whatever the rating", () => {
    expect(rowTier(1, 40, 3)).toBe("legendary");
    expect(rowTier(3, 95, 3)).toBe("legendary");
    expect(rowTier(1, 95, 0)).toBe("gold");
  });

  it("gives ratings of 80 and up a gold border below the legendary rows", () => {
    expect(rowTier(4, 79.6, 3)).toBe("gold");
    expect(rowTier(12, 93, 3)).toBe("gold");
    expect(rowTier(6, 79.4, 3)).toBeNull();
    expect(rowTier(30, 55, 3)).toBeNull();
  });
});

describe("SchoolRankingsTable tiers", () => {
  const row = (rank: number, balancedScore: number): SchoolRanking => ({
    rank,
    school: `School ${rank}`,
    bestRating: balancedScore,
    bestEntry: "A & B",
    bestEvent: "LD",
    avgRating: balancedScore,
    balancedScore,
    teams: 4,
    events: ["LD"],
  });
  const html = renderToStaticMarkup(
    createElement(SchoolRankingsTable, {
      rows: [row(1, 90), row(6, 84), row(7, 60)],
      legendary: 1,
      sort: { key: "rank", dir: "asc" },
      onToggleSort: () => {},
    }),
  );

  it("labels legendary rows and outlines gold ones", () => {
    expect(html.match(/data-tier="legendary"/g)).toHaveLength(1);
    expect(html.match(/data-tier="gold"/g)).toHaveLength(1);
    expect(html.match(/Legendary<\/span>/g)).toHaveLength(1);
  });
});
