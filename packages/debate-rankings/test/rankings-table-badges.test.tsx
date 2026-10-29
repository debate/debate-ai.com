/**
 * @fileoverview Pins where the division rankings table puts its labels: the
 * Team column shows each team as a label pill (school logo, or the school's
 * name when it has none, then the debaters), followed by the school's
 * Schools-tab rank and then the legend badge ("PF Legend").
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { RankingEntry } from "@debate-ai/rankings";
import { RankingsTable } from "../src/leaderboard/RankingsTable";
import { schoolRankingsFor, schoolRankOf, schoolRanksByName } from "../src/leaderboard/leaderboardUtils";
import { hasSchoolLogo } from "../src/leaderboard/lib/schoolLogos";

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

  it("draws the team as a label pill, with the school's rank after it", () => {
    // Harker has a logo: the pill shows it, keeping the name only for screen readers.
    expect(rows[0]).toMatch(/data-team-label=""[^>]*>.*<img[^>]*harker\.png/);
    expect(rows[0]).toContain('<span class="sr-only">Harker</span>');
    // The school-rank badge follows the pill.
    expect(rows[0]).toMatch(/<\/a><\/span><\/span><span[^>]*>#1<\/span>/);
    // College Prep is not in the school ranks, so it has no school-rank badge.
    expect(rows[1]).toContain("College Prep");
    expect(rows[1]).toContain("Falk &amp; Sabnani");
    expect(rows[1]).not.toMatch(/>#\d/);
  });
});

describe("school logo coverage", () => {
  it("maps the recently indexed school logos", () => {
    for (const school of ["Michigan", "Kansas", "Texas", "UC Berkeley"]) {
      expect(hasSchoolLogo(school)).toBe(true);
    }
    // A school with no logo still renders its name. (College Prep got one.)
    expect(hasSchoolLogo("Nowhere High")).toBe(false);
  });
});
