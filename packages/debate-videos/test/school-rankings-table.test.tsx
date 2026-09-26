/**
 * @fileoverview Pins the Schools table: one row per school with its best and
 * average rating, top entry and events, under matching headers.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { SchoolRankingsTable } from "../src/panels/leaderboard/SchoolRankingsTable";
import type { SchoolRanking } from "../src/panels/leaderboard/leaderboardTypes";

const rows: SchoolRanking[] = [
  {
    rank: 1,
    school: "Strake Jesuit",
    bestRating: 1312.4,
    bestEntry: "Doe & Roe",
    bestEvent: "PF",
    avgRating: 1101.6,
    teams: 4,
    events: ["PF", "LD"],
  },
];

describe("SchoolRankingsTable", () => {
  const html = renderToStaticMarkup(
    createElement(SchoolRankingsTable, { rows, sort: { key: "rank", dir: "asc" }, onToggleSort: () => {} }),
  );

  it("renders one header per cell", () => {
    expect(html.match(/<th[\s>]/g)).toHaveLength(7);
    expect(html.match(/<td[\s>]/g)).toHaveLength(7);
    for (const label of ["School", "Best Rating", "Top Entry", "Avg Rating", "Teams", "Events"]) {
      expect(html).toContain(label);
    }
  });

  it("shows the school's ratings, top entry and events", () => {
    expect(html).toContain('href="/schools/strake-jesuit"');
    expect(html).toContain('aria-label="1312"');
    expect(html).toContain('aria-label="1102"');
    expect(html).toContain("Doe &amp; Roe");
    expect(html).toContain("PF, LD");
    expect(html).toContain('aria-sort="ascending"');
  });
});
