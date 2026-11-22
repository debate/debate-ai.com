import { describe, expect, it } from "vitest";
import { parseNdtSchoolHistory } from "../src/sync/ndt-school-history";
import { findNdtSchoolHistory } from "../src/leaderboard/profile/rankingProfileHelpers";
import {
  averageNdtElim,
  latestNdtYear,
  mergeElimsAndBids,
  ndtElimScore,
  rankAllNdtElimScores,
  rankNdtElimScore,
} from "../src/leaderboard/profile/ndtHistory";

const HTML = `
<button class="accordion" aria-expanded="false">Harvard University (MA)</button>
<div class="panel" hidden="">
  <div class="section"><p><strong>Years in Attendance (2): </strong>
    <a href="x">1950</a> <a href="y">1961</a></p></div>
  <div class="section"><strong>Elim Qualifiers (1):</strong><ul><li>
    <a href="x">1961</a> Octas - Gene Clements &amp; Laurence Tribe (6-2, Seed: 5)</li></ul></div>
  <div class="section"><strong>Speaker Awards (1):</strong><ul><li>
    <a href="x">1954</a> - Robert O'Neil ( 11 )</li></ul></div>
  <div class="section"><strong>Coaching Awards (1):</strong><ul><li>
    1990 - Dallas Perkins - Ross K. Smith National Coach of the Year</li></ul></div>
</div>
<button class="accordion" aria-expanded="false">Michigan State University (MI)</button>
<div class="panel" hidden=""><div class="section"><p><strong>Years in Attendance (1): </strong><a href="x">1970</a></p></div></div>
<button class="accordion" aria-expanded="false">University of Michigan (MI)</button>
<div class="panel" hidden=""><div class="section"><p><strong>Years in Attendance (1): </strong><a href="x">1971</a></p></div></div>
`;

describe("parseNdtSchoolHistory", () => {
  const schools = parseNdtSchoolHistory(HTML);

  it("reads every school and its attendance", () => {
    expect(schools.map((s) => s.school)).toEqual([
      "Harvard University (MA)",
      "Michigan State University (MI)",
      "University of Michigan (MI)",
    ]);
    expect(schools[0].years).toEqual([1950, 1961]);
  });

  it("reads elims, speaker and coaching awards", () => {
    expect(schools[0].elims).toEqual([
      { year: 1961, team: "Gene Clements & Laurence Tribe", round: "Octas", record: "6-2", seed: 5 },
    ]);
    expect(schools[0].speakerAwards).toEqual([{ year: 1954, speaker: "Robert O'Neil", rank: 11 }]);
    expect(schools[0].coachingAwards[0]).toEqual({
      year: 1990,
      coach: "Dallas Perkins",
      award: "Ross K. Smith National Coach of the Year",
    });
  });

  it("matches ranking school names to NDT names", () => {
    expect(findNdtSchoolHistory(schools, "Harvard")?.school).toBe("Harvard University (MA)");
    expect(findNdtSchoolHistory(schools, "Michigan")?.school).toBe("University of Michigan (MI)");
    expect(findNdtSchoolHistory(schools, "Michigan State")?.school).toBe("Michigan State University (MI)");
    expect(findNdtSchoolHistory(schools, "Yale")).toBeNull();
  });

  it("prefers the university over a same-named college unless the name says College", () => {
    const named = [
      { school: "Boston College (MA)" },
      { school: "Boston University (MA)" },
      { school: "Georgetown College (KY)" },
      { school: "Georgetown University (DC)" },
    ];
    expect(findNdtSchoolHistory(named, "Georgetown")?.school).toBe("Georgetown University (DC)");
    expect(findNdtSchoolHistory(named, "Georgetown University")?.school).toBe("Georgetown University (DC)");
    expect(findNdtSchoolHistory(named, "Georgetown College")?.school).toBe("Georgetown College (KY)");
    expect(findNdtSchoolHistory(named, "Boston College")?.school).toBe("Boston College (MA)");
    expect(findNdtSchoolHistory(named, "Boston University")?.school).toBe("Boston University (MA)");
  });

  it("matches state-system campuses by their short forms, and the bare system name to the main campus", () => {
    const named = [
      { school: "University of California - Berkeley" },
      { school: "University of California - Davis" },
      { school: "University of California - Los Angeles" },
      { school: "University of Southern California" },
      { school: "University of Texas - Arlington" },
      { school: "University of Texas - Austin" },
      { school: "University of Texas - Dallas" },
      { school: "Texas Tech University" },
      { school: "University of Wisconsin - Eau Claire" },
      { school: "University of Missouri" },
      { school: "University of Missouri - Kansas City" },
    ];
    const find = (name: string) => findNdtSchoolHistory(named, name)?.school ?? null;
    for (const name of ["UC Berkeley", "uc-berkeley", "Cal", "Berkeley", "California", "University of California, Berkeley"]) {
      expect(find(name)).toBe("University of California - Berkeley");
    }
    expect(find("UC Davis")).toBe("University of California - Davis");
    expect(find("UCLA")).toBe("University of California - Los Angeles");
    expect(find("USC")).toBe("University of Southern California");
    for (const name of ["Texas", "University of Texas", "UT Austin", "University of Texas - Austin"]) {
      expect(find(name)).toBe("University of Texas - Austin");
    }
    expect(find("UT Dallas")).toBe("University of Texas - Dallas");
    expect(find("Texas Tech")).toBe("Texas Tech University");
    expect(find("Wisconsin")).toBeNull();
    expect(find("Missouri")).toBe("University of Missouri");
    expect(find("UMKC")).toBe("University of Missouri - Kansas City");
    expect(find("University of Missouri - Kansas City")).toBe("University of Missouri - Kansas City");
  });
});

describe("averageNdtElim", () => {
  const school = {
    school: "Test University (XX)",
    years: [2010, 2016, 2020, 2025],
    elims: [
      { year: 2010, team: "A & B", round: "Doubles" },
      { year: 2016, team: "C & D", round: "Octas" },
      { year: 2020, team: "E & F", round: "Champion" },
      { year: 2025, team: "G & H", round: "Quarters" },
    ],
    championships: [{ year: 2020, team: "E & F", round: "Champion" }],
    atLargeBids: [],
    copelandWinners: [],
    speakerAwards: [],
    coachingAwards: [],
  };

  it("averages elim depth (Doubles 1 … Champion 6) across all years", () => {
    // (1 + 2 + 6 + 3) / 4 = 3
    expect(averageNdtElim(school)).toEqual({ depth: 3, round: "Quarters", elims: 4 });
  });

  it("limits the average to a span of years", () => {
    // (2 + 6 + 3) / 3 = 3.67 → Semis
    expect(averageNdtElim(school, 2016)).toEqual({ depth: 3.7, round: "Semis", elims: 3 });
    expect(averageNdtElim(school, 2026)).toBeUndefined();
  });

  it("finds the latest NDT year across schools", () => {
    expect(latestNdtYear([school, { ...school, years: [1999] }])).toBe(2025);
  });
});

describe("ndt elim finish score", () => {
  const make = (school: string, elims: Array<[number, string]>, atLargeBids: Array<{ year: number; team: string }> = []) => ({
    school,
    years: [],
    elims: elims.map(([year, round], i) => ({ year, team: `${school} ${i} & Partner ${i}`, round })),
    championships: [],
    atLargeBids,
    copelandWinners: [],
    speakerAwards: [],
    coachingAwards: [],
  });
  // Three deep teams in one year beats one lucky title.
  const big = make("Big", [
    [2020, "Semis"],
    [2020, "Quarters"],
    [2020, "Octas"],
    [2020, "Doubles"],
  ]);
  const lucky = make("Lucky", [[2020, "Champion"]]);
  const old = make("Old", [
    [1990, "Champion"],
    [1991, "Champion"],
  ]);
  const schools = [big, lucky, old];

  it("scores each NDT as 70% its top three elim teams plus 30% the average of all", () => {
    // top 3: 5 + 3 + 2 = 10; average (5+3+2+1)/4 = 2.75 → 0.7×10 + 0.3×2.75 = 7.825
    expect(ndtElimScore(big)).toEqual({ score: 7.8, elims: 4 });
    // one team: 0.7×10 + 0.3×10
    expect(ndtElimScore(lucky)).toEqual({ score: 10, elims: 1 });
  });

  it("discounts seasons before the last decade", () => {
    expect(ndtElimScore(old)).toEqual({ score: 20, elims: 2 });
    expect(ndtElimScore(old, -Infinity, 2016)).toEqual({ score: 10, elims: 2 });
  });

  it("ranks schools by score as integer positions, matching each school's own rank", () => {
    const rows = rankAllNdtElimScores(schools, 2016, 2016);
    expect(rows.map((row) => [row.school, row.rank])).toEqual([
      ["Lucky", 1],
      ["Big", 2],
    ]);
    expect(rankNdtElimScore(schools, big, 2016, 2016)).toEqual({ rank: 2, of: 2 });
    expect(rankNdtElimScore(schools, old, 2016, 2016)).toBeUndefined();
    // Old's two titles at half weight tie Lucky's one: equal scores share a rank.
    expect(rankAllNdtElimScores(schools, -Infinity, 2016).map((row) => [row.school, row.rank])).toEqual([
      ["Old", 1],
      ["Lucky", 1],
      ["Big", 3],
    ]);
  });

  it("rewards programs with many deep teams over years", () => {
    const steady = make("Steady", [
      [2018, "Quarters"],
      [2019, "Quarters"],
      [2020, "Semis"],
      [2021, "Quarters"],
    ]);
    expect(rankNdtElimScore([steady, lucky], steady)).toEqual({ rank: 1, of: 2 });
  });

  it("merges first-round bids into the elim list", () => {
    const school = make("Bid U", [[1981, "Finals"]], [
      { year: 1981, team: "Bid U 0 & Partner 0 (Rank: 1 )" },
      { year: 1981, team: "Jo Smith & Al Jones (Rank: 13 )" },
    ]);
    const rows = mergeElimsAndBids(school);
    expect(rows.map((row) => [row.team, row.round, row.firstRound, row.bidRank])).toEqual([
      ["Bid U 0 & Partner 0", "Finals", true, 1],
      ["Jo Smith & Al Jones", undefined, true, 13],
    ]);
  });
});
