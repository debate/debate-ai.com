import { describe, expect, it } from "vitest";
import {
  buildHsAllTimeSchools,
  buildHsEliteSchools,
  hsEliteAccomplishments,
  hsEliteKeys,
  hsProgramStrength,
  HS_ELITE_COUNT,
} from "../src/school-elite";
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
  it("follows each event's top 20 of the last 20 years from the bundled TOC history", () => {
    for (const event of ["Policy", "Lincoln-Douglas", "Public Forum"] as const) {
      const chart = buildHsEliteSchools([], event, 2026);
      expect(chart.schools).toHaveLength(HS_ELITE_COUNT);
      expect(chart.lastYear).toBe(2026);
      expect(chart.lastYear - chart.firstYear + 1).toBe(20);
      expect(chart.rankFromYear).toBe(2007);
      const totals = chart.schools.map((s) => s.total);
      expect(totals).toEqual([...totals].sort((a, b) => b - a));
      for (const school of chart.schools) expect(school.seasons).toHaveLength(chart.lastYear - chart.firstYear + 1);
      expect(chart.schools.map((s) => s.decadeRank)).toEqual([...Array(HS_ELITE_COUNT)].map((_, i) => i + 1));
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

describe("hsProgramStrength", () => {
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

  it("ranks every program all time and over the decade, TOC-only programs counted in the field", () => {
    const { ranks } = hsProgramStrength(rows, "Policy", 2022, { decadeFrom: 2014, records });
    expect(Object.fromEntries(ranks)).toEqual({
      gamma: { allTime: { rank: 1, score: 40, of: 3 }, decade: { rank: 1, score: 40, of: 3 } },
      alpha: { allTime: { rank: 2, score: 35, of: 3 }, decade: { rank: 3, score: 5, of: 3 } },
      "toc:Beta Prep (CA)": { allTime: { rank: 3, score: 18, of: 3 }, decade: { rank: 2, score: 18, of: 3 } },
    });
  });

  it("leaves the decade out without a start", () => {
    const { ranks } = hsProgramStrength(rows, "Policy", 2022, { records });
    expect(ranks.get("alpha")).toEqual({ allTime: { rank: 2, score: 35, of: 3 }, decade: null });
  });

  it("matches the all-time Schools list's rank and points", () => {
    const { ranks } = hsProgramStrength(rows, "Policy", 2022, { records });
    for (const row of buildHsAllTimeSchools(rows, "Policy", 2022, { records })) {
      expect(ranks.get(row.handle ?? `toc:${row.school}`)?.allTime).toMatchObject({ rank: row.rank, score: row.score });
    }
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

  it("lists each program at its school page rank and points, in every event", () => {
    const rows: SchoolSeasonPoints[] = [
      { school: "montgomery-bell-academy", year: 2024, points: 9.9, event: "Policy" },
      { school: "harker", year: 2024, points: 13.2, event: "Lincoln-Douglas" },
      { school: "blake", year: 2024, points: 8, event: "Public Forum" },
      { school: "nowhere-prep", year: 2025, points: 3, event: "Policy" },
    ];
    for (const event of ["Policy", "Lincoln-Douglas", "Public Forum"] as const) {
      const { ranks } = hsProgramStrength(rows, event, 2026, { decadeFrom: 2018 });
      const list = buildHsAllTimeSchools(rows, event, 2026);
      for (const row of list) {
        expect(ranks.get(row.handle ?? `toc:${row.school}`)?.allTime, row.school).toMatchObject({ rank: row.rank, score: row.score });
      }
    }
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
