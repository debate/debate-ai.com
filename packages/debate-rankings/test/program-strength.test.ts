import { describe, expect, it } from "vitest";
import type { NdtSchoolHistory } from "../src/sync/ndt-school-history";
import type { CollegeHistoryEntry } from "../src/college-history";
import {
  buildProgramStrengths,
  latestStrengthYear,
  programScore,
  programSeasonSeries,
  rankingPoints,
  rankProgram,
  rankPrograms,
  seasonLabel,
  speakerPoints,
  STRENGTH_WEIGHTS,
} from "../src/leaderboard/profile/programStrength";

const school = (name: string, extra: Partial<NdtSchoolHistory> = {}): NdtSchoolHistory => ({
  school: name,
  years: [],
  elims: [],
  championships: [],
  atLargeBids: [],
  copelandWinners: [],
  speakerAwards: [],
  coachingAwards: [],
  ...extra,
});

const ndt = [
  school("Northwestern University (IL)", {
    years: [2000, 2002],
    elims: [{ year: 2000, team: "A & B", round: "Champion" }],
    championships: [
      { year: 2000, team: "A & B" },
      // Missing from the elim list: still counts as a title.
      { year: 2002, team: "C & D" },
    ],
    atLargeBids: [{ year: 2000, team: "A & B" }],
    copelandWinners: [{ year: 2000, team: "A & B" }],
    speakerAwards: [
      { year: 2000, speaker: "A", rank: 1 },
      { year: 2000, speaker: "B", rank: 7 },
    ],
  }),
  school("Harvard University (MA)", { years: [2002], elims: [{ year: 2002, team: "E & F", round: "Octas" }] }),
];

const row = (rank: number, schoolName: string): CollegeHistoryEntry => ({
  rank,
  school: schoolName,
  name: "X & Y",
  rating: 0,
  mu: 0,
  sigma: 0,
});

const ceda = [{ school: "Northwestern University", titles: [{ year: 2002, school: "Northwestern University", team: "G & H" }] }];

describe("program strength", () => {
  const programs = buildProgramStrengths({
    ndt,
    ceda,
    rankings: [{ year: 2002, entries: [row(1, "Northwestern"), row(81, "Harvard"), row(50, "Nowhere State")] }],
  });
  const byName = (name: string) => programs.find((p) => p.name === name)!;

  it("weights each result", () => {
    expect(rankingPoints(1)).toBe(5);
    expect(rankingPoints(101)).toBe(0);
    expect(speakerPoints(1)).toBe(10);
    expect(speakerPoints(7)).toBe(3);
    expect(speakerPoints(undefined)).toBe(1);
    const nu = byName("Northwestern University");
    // attendance 2 + title 30 + bid 4 + Copeland 12 + speakers 10 + 3
    expect(nu.seasons.get(2000)).toMatchObject({ total: 61, parts: { elims: 30, copeland: 12, speakers: 13 } });
    // attendance 2 + title 30 + CEDA 20 + #1 team 5
    expect(nu.seasons.get(2002)).toMatchObject({ total: 57, parts: { ceda: 20, rankings: 5 } });
  });

  it("counts a Shirley title like a CEDA title, a final loss at half, and never above an NDT title", () => {
    const shirley = [
      {
        school: "Northwestern University",
        championships: 1,
        secondPlaces: 0,
        // November 2001 opens the 2001–02 season (2002).
        results: [{ year: 2001, place: "Champion" as const, school: "Northwestern University", team: "G & H" }],
      },
      {
        school: "Canisius University",
        championships: 0,
        secondPlaces: 2,
        results: [
          { year: 2001, place: "Second place" as const, school: "Canisius University" },
          // Opens a season no other source covers yet, so it waits.
          { year: 2002, place: "Second place" as const, school: "Canisius University" },
        ],
      },
    ];
    const withShirley = buildProgramStrengths({ ndt, ceda, shirley, rankings: [{ year: 2002, entries: [] }] });
    const nu = withShirley.find((p) => p.name === "Northwestern University")!;
    expect(nu.seasons.get(2002)?.parts).toMatchObject({ shirley: 20, ceda: 20, elims: 30 });
    expect(STRENGTH_WEIGHTS.shirley.Champion).toBe(STRENGTH_WEIGHTS.ceda);
    expect(STRENGTH_WEIGHTS.ndtElim.Champion).toBeGreaterThan(STRENGTH_WEIGHTS.shirley.Champion);
    const canisius = withShirley.find((p) => p.name === "Canisius University")!;
    expect([...canisius.seasons.keys()]).toEqual([2002]);
    expect(canisius.seasons.get(2002)?.parts.shirley).toBe(10);
  });

  it("merges every source's spelling into one program", () => {
    expect(programs.map((p) => p.name).sort()).toEqual(["Harvard University", "Northwestern University", "Nowhere State"]);
    expect(byName("Harvard University").seasons.get(2002)?.total).toBe(2 + 5 + 1);
  });

  it("counts only each program's best two top-100 teams a season", () => {
    const [nu] = buildProgramStrengths({
      ndt: [],
      ceda: [],
      rankings: [{ year: 2010, entries: [row(41, "Nowhere State"), row(1, "Nowhere State"), row(21, "Nowhere State")] }],
    });
    // #1 (5) + #21 (4); #41 is left out
    expect(nu.seasons.get(2010)?.parts.rankings).toBe(9);
    expect(nu.seasons.get(2010)?.rankedTeams?.map((t) => t.rank)).toEqual([1, 21]);
  });

  it("ranks programs over a span", () => {
    expect(latestStrengthYear(programs)).toBe(2002);
    expect(programScore(byName("Northwestern University"))).toBe(118);
    expect(rankProgram(programs, byName("Harvard University").key, 2002, 2002)).toEqual({ rank: 2, score: 8, of: 3 });
    expect(rankProgram(programs, byName("Harvard University").key, 2000, 2000)).toBeNull();
  });

  it("lists every program over a span with the same ranks", () => {
    for (const [from, to] of [
      [2002, 2002],
      [-Infinity, Infinity],
    ]) {
      const list = rankPrograms(programs, from, to);
      expect(list.length).toBe(rankProgram(programs, list[0].key, from, to)!.of);
      for (const row of list) {
        expect(rankProgram(programs, row.key, from, to)).toEqual({ rank: row.rank, score: row.score, of: list.length });
      }
      expect(list.map((row) => row.score)).toEqual([...list.map((row) => row.score)].sort((a, b) => b - a));
    }
    expect(rankPrograms(programs, 1990, 1990)).toEqual([]);
  });

  it("fills empty seasons for the chart", () => {
    expect(programSeasonSeries(byName("Northwestern University"), 2003).map((s) => [s.year, s.total])).toEqual([
      [2000, 61],
      [2001, 0],
      [2002, 57],
      [2003, 0],
    ]);
    expect(seasonLabel(2025)).toBe("2024–25");
  });
});
