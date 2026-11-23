import { describe, expect, it } from "vitest";
import { buildHsAllTimeSchools, buildHsEliteSchools, hsEliteAccomplishments, hsEliteKeys, HS_ELITE_COUNT } from "../src/school-elite";
import type { SchoolSeasonPoints } from "../src/school-seasons";
import { tocRecordsBySchool, type TocResult } from "../src/sync/toc-champions";

const toc = (year: number, school: string, place: TocResult["place"], event: TocResult["event"] = "Policy"): TocResult => ({
  year,
  event,
  place,
  school,
  competitors: "Ann One & Bo Two",
});

describe("buildHsEliteSchools", () => {
  it("follows each event's top 10 of the last decade from the bundled TOC history", () => {
    for (const event of ["Policy", "Lincoln-Douglas", "Public Forum"] as const) {
      const chart = buildHsEliteSchools([], event, 2026);
      expect(chart.schools).toHaveLength(HS_ELITE_COUNT);
      expect(chart.lastYear).toBe(2026);
      expect(chart.lastYear - chart.firstYear + 1).toBe(20);
      expect(chart.rankFromYear).toBe(2017);
      const totals = chart.schools.map((s) => s.total);
      expect(totals).toEqual([...totals].sort((a, b) => b - a));
      for (const school of chart.schools) expect(school.seasons).toHaveLength(chart.lastYear - chart.firstYear + 1);
      expect(chart.schools.map((s) => s.decadeRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
    // The chart is capped at the last 20 seasons, so each event starts at 2007.
    expect(buildHsEliteSchools([], "Public Forum", 2026).firstYear).toBe(2007);
    expect(buildHsEliteSchools([], "Policy", 2026).firstYear).toBe(2007);
  });

  it("adds ranked-entry points to the matching school and ranks each season by the trailing window", () => {
    const records = tocRecordsBySchool([toc(2020, "Alpha High School (TX)", "Champion"), toc(2021, "Beta Prep (CA)", "Runner-up")]);
    const rows: SchoolSeasonPoints[] = [
      { school: "alpha", year: 2022, points: 5, event: "Policy" },
      { school: "gamma", year: 2022, points: 40, event: "Policy" },
      { school: "gamma", year: 2022, points: 99, event: "Public Forum" },
    ];
    const teams = new Map([["gamma", [{ year: 2022, event: "Policy" as const, teams: [{ rank: 3, fieldSize: 500, name: "Cy & Di", bids: 4 }] }]]]);
    const chart = buildHsEliteSchools(rows, "Policy", 2022, teams, { records, window: 2, count: 3 });
    expect(chart.firstYear).toBe(2020);
    expect(chart.schools.map((s) => [s.school, s.handle, s.total])).toEqual([
      ["Gamma", "gamma", 40],
      ["Alpha High School (TX)", "alpha", 35],
      ["Beta Prep (CA)", undefined, 18],
    ]);
    const ranks = Object.fromEntries(chart.schools.map((s) => [s.school, s.seasons.map((x) => x.rank)]));
    expect(ranks["Alpha High School (TX)"]).toEqual([1, 1, 3]);
    expect(ranks["Beta Prep (CA)"]).toEqual([2, 2, 2]);
    expect(ranks.Gamma).toEqual([2, 3, 1]);
    expect(chart.schools[0]!.seasons[2]!.accomplishments).toEqual([
      { kind: "entry", label: "#3 nationally: Cy & Di · 4 TOC bids" },
    ]);
    expect(chart.schools[1]!.seasons[0]!.accomplishments[0]).toEqual({
      kind: "title",
      label: "TOC champion: Ann One & Bo Two",
    });
    expect(hsEliteKeys(rows, "Policy", 2022, 2, records)).toEqual(["gamma", "alpha"]);
  });

  it("lists TOC finishes in the event only", () => {
    const [record] = tocRecordsBySchool([toc(2010, "Delta (NY)", "Top speaker"), toc(2010, "Delta (NY)", "Champion", "Public Forum")]);
    expect(hsEliteAccomplishments("Policy", 2010, record!, [])).toEqual([
      { kind: "speaker", label: "TOC top speaker: Ann One & Bo Two" },
    ]);
  });

  it("is empty without any points", () => {
    expect(buildHsEliteSchools([], "Policy", 2022, new Map(), { records: [] }).schools).toEqual([]);
  });
});

describe("buildHsAllTimeSchools", () => {
  it("ranks every program of all time in the event, TOC-only programs included", () => {
    const records = tocRecordsBySchool([
      toc(1990, "Alpha High School (TX)", "Champion"),
      toc(2021, "Beta Prep (CA)", "Runner-up"),
      toc(2021, "Beta Prep (CA)", "Champion", "Public Forum"),
    ]);
    const rows: SchoolSeasonPoints[] = [
      { school: "alpha", year: 2022, points: 5, event: "Policy" },
      { school: "gamma", year: 2022, points: 40, event: "Policy" },
      { school: "gamma", year: 2023, points: 99, event: "Policy" },
    ];
    expect(buildHsAllTimeSchools(rows, "Policy", 2022, { records })).toEqual([
      { rank: 1, school: "Gamma", handle: "gamma", score: 40, titles: 0 },
      { rank: 2, school: "Alpha High School (TX)", handle: "alpha", score: 35, titles: 1 },
      { rank: 3, school: "Beta Prep (CA)", handle: undefined, score: 18, titles: 0 },
    ]);
    expect(buildHsAllTimeSchools(rows, "Policy", 2022, { records, count: 1 })).toHaveLength(1);
  });

  it("covers the bundled TOC history in each event", () => {
    for (const event of ["Policy", "Lincoln-Douglas", "Public Forum"] as const) {
      const list = buildHsAllTimeSchools([], event, 2026);
      expect(list.length).toBeGreaterThan(20);
      expect(list[0]!.rank).toBe(1);
      expect(list[0]!.titles).toBeGreaterThan(0);
    }
  });
});
