/**
 * @fileoverview Pins the leaderboard highlight tiers: top five ranks are
 * legendary, ratings of 80+ (bold 8 or 9) are gold, and the Schools table
 * marks its rows to match.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { rowTier } from "../src/panels/leaderboard/rowTier";
import { SchoolRankingsTable } from "../src/panels/leaderboard/SchoolRankingsTable";
import type { SchoolRanking } from "../src/panels/leaderboard/leaderboardTypes";

describe("rowTier", () => {
  it("makes the top five ranks legendary whatever the rating", () => {
    expect(rowTier(1, 40)).toBe("legendary");
    expect(rowTier(5, 95)).toBe("legendary");
  });

  it("gives ratings of 80 and up a gold border below the top five", () => {
    expect(rowTier(6, 79.6)).toBe("gold");
    expect(rowTier(12, 93)).toBe("gold");
    expect(rowTier(6, 79.4)).toBeNull();
    expect(rowTier(30, 55)).toBeNull();
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
