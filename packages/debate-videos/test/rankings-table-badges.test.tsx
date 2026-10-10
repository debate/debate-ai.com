/**
 * @fileoverview Pins where the division rankings table puts its labels: the
 * legend badge ("PF Legend") follows the team's name, and the School column shows the
 * school's Schools-tab rank after its name.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { RankingEntry } from "@debate/rankings-adapter";
import { RankingsTable } from "../src/panels/leaderboard/RankingsTable";
import { schoolRankingsFor, schoolRankOf, schoolRanksByName } from "../src/panels/leaderboard/leaderboardUtils";

function entry(rank: number, school: string, name: string, rating: number): RankingEntry {
  return {
    rank,
    school,
    name,
    adjustedRating: rating,
    deviation: 1,
    matches: 10,
    rating,
    hash: `${school}-${name}`,
    affWinRate: 50,
    negWinRate: 50,
    affElimWinRate: null,
    negElimWinRate: null,
  };
}

const entries = [
  entry(1, "Harker", "Le & Luo", 95),
  entry(2, "College Prep", "Falk & Sabnani", 70),
  entry(3, "Harker", "Kim & Park", 90),
];

describe("schoolRanksByName", () => {
  it("matches the Schools tab ranking for the division and finds any spelling", () => {
    const rows = schoolRankingsFor({ VPF: { entries } as never }, "VPF");
    const ranks = schoolRanksByName(rows);
    expect(schoolRankOf(ranks, "Harker")).toBe(rows.find((r) => r.school === "Harker")!.rank);
    expect(schoolRankOf(ranks, " harker ")).toBe(schoolRankOf(ranks, "Harker"));
    expect(schoolRankOf(ranks, "Nowhere High")).toBeUndefined();
  });
});

describe("RankingsTable labels", () => {
  const html = renderToStaticMarkup(
    createElement(RankingsTable, {
      entries,
      legendary: 1,
      schoolRanks: new Map([["harker", 1]]),
      division: "VPF",
      sort: { key: "rank", dir: "asc" },
      onToggleSort: () => {},
    }),
  );
  const rows = html.split("<tr").slice(2);

  it("puts the format's legend badge after the team name", () => {
    expect(html.match(/PF Legend<\/span>/g)).toHaveLength(1);
    expect(html).not.toContain("Legendary</span>");
    expect(rows[0].indexOf("Le &amp; Luo")).toBeLessThan(rows[0].indexOf("PF Legend</span>"));
  });

  it("shows the school's rank after the school name only when it has one", () => {
    expect(rows[0]).toMatch(/Harker<\/a><span[^>]*>#1<\/span>/);
    expect(rows[1]).not.toMatch(/>#\d/);
  });
});
