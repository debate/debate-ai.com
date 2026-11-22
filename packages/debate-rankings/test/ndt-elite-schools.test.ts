import { describe, expect, it } from "vitest";
import type { NdtSchoolHistory } from "../src/sync/ndt-school-history";
import { buildNdtAllSeasons } from "../src/leaderboard/profile/ndtAllSeasons";
import { buildEliteSchools, eliteAccomplishments, eliteShortName, ELITE_COUNT, ELITE_RANK_SEASONS, ELITE_SEASONS } from "../src/leaderboard/profile/ndtEliteSchools";
import history from "../data/ndt-school-history.json";

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

describe("buildEliteSchools", () => {
  it("picks and orders the top 10 by the last decade's points, charting twenty seasons", () => {
    const data = history as NdtSchoolHistory[];
    const table = buildNdtAllSeasons(data);
    const chart = buildEliteSchools(data, table);
    expect(chart.schools).toHaveLength(ELITE_COUNT);
    expect(chart.schools.map((s) => s.decadeRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const totals = chart.schools.map((s) => s.total);
    expect(totals).toEqual([...totals].sort((x, y) => y - x));
    expect(chart.rankFromYear).toBe(chart.lastYear - ELITE_RANK_SEASONS + 1);
    // Each school's total is its points over the decade: the sum of those seasons' own points.
    for (const s of chart.schools) {
      const decade = s.seasons.filter((season) => season.year >= chart.rankFromYear!);
      expect(decade.reduce((sum, season) => sum + season.seasonPoints, 0)).toBeCloseTo(s.total, 1);
    }
    expect(chart.lastYear - chart.firstYear + 1).toBe(ELITE_SEASONS);
    expect(ELITE_SEASONS).toBe(20);
    for (const s of chart.schools) {
      expect(s.seasons).toHaveLength(ELITE_SEASONS);
      expect(s.seasons.every((season) => season.rank >= 1)).toBe(true);
    }
  });

  it("ranks each season by the trailing window's points, ties sharing a rank", () => {
    const a = school("A (XX)", { championships: [{ year: 2001, team: "Ann One & Bo Two" }] });
    const b = school("B (XX)", { atLargeBids: [{ year: 2002, team: "Cy Three & Di Four", rank: 1 }] });
    const c = school("C (XX)", { atLargeBids: [{ year: 2002, team: "Ed Five & Fa Six", rank: 2 }] });
    const chart = buildEliteSchools([a, b, c], undefined, { count: 3, seasons: 6, window: 2 });
    expect([chart.firstYear, chart.lastYear]).toEqual([1997, 2002]);
    const ranks = Object.fromEntries(chart.schools.map((s) => [s.school, s.seasons.map((x) => x.rank)]));
    // 2002: A still holds its 2001 title in the 2-season window.
    expect(ranks["A (XX)"].slice(-2)).toEqual([1, 1]);
    expect(ranks["B (XX)"].at(-1)).toBe(2);
    expect(ranks["C (XX)"].at(-1)).toBe(2);
  });

  it("puts the decade's leader first, not the all-time leader", () => {
    const titles = (years: number[]) => years.map((year) => ({ year, team: "Ann One & Bo Two" }));
    const old = school("Old (XX)", { championships: titles([1990, 1991, 1992, 1993, 1994, 1995]) });
    const recent = school("Recent (XX)", { championships: titles([2020]) });
    const chart = buildEliteSchools([old, recent], undefined, { count: 2, seasons: 20, rankSeasons: 10 });
    expect(chart.lastYear).toBe(2020);
    expect(chart.schools.map((s) => [s.school, s.decadeRank])).toEqual([["Recent (XX)", 1]]);
    // A school with no decade points drops out even though it leads all-time.
    expect(chart.schools.some((s) => s.school === "Old (XX)")).toBe(false);
  });

  it("lists a season's accomplishments, biggest first", () => {
    const s = school("A (XX)", {
      elims: [
        { year: 2010, team: "Ann One & Bo Two", round: "Quarters" },
        { year: 2010, team: "Cy Three & Di Four", round: "Finals" },
      ],
      championships: [{ year: 2011, team: "Ann One & Bo Two" }],
      copelandWinners: [{ year: 2010, team: "Cy Three & Di Four" }],
      speakerAwards: [{ year: 2010, speaker: "Cy Three", rank: 1 }, { year: 2010, speaker: "Ann One", rank: 22 }],
    });
    expect(eliteAccomplishments(s, 2010).map((a) => a.label)).toEqual([
      "Runner-up: Three & Four",
      "Quarters: One & Two",
      "Copeland Award: Three & Four",
      "Top speaker: Cy Three",
    ]);
    expect(eliteAccomplishments(s, 2011)).toEqual([{ kind: "title", label: "NDT champion: One & Two" }]);
  });
});

describe("eliteShortName", () => {
  it("drops University of / University / College for chips without a logo", () => {
    expect(eliteShortName("Northwestern University")).toBe("Northwestern");
    expect(eliteShortName("University of Kansas")).toBe("Kansas");
    expect(eliteShortName("Dartmouth College")).toBe("Dartmouth");
    expect(eliteShortName("Wake Forest")).toBe("Wake Forest");
  });
});
