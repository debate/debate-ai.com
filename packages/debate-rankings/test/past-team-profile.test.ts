import { describe, expect, it } from "vitest";
import type { CollegeHistoryEntry } from "@debate-ai/rankings";
import { cedaTitlesBySchool, findCedaSchoolTitles } from "../src/sync/ceda-champions";
import type { NdtSchoolHistory } from "../src/sync/ndt-school-history";
import {
  findPastTeamProfile,
  parseTeamHandle,
  pastTeamHref,
  pastTeamNamesHref,
  pastTeamVideoSearch,
  type PastTeamSources,
} from "../src/leaderboard/profile/pastTeamHelpers";

const row = (rank: number, school: string, name: string): CollegeHistoryEntry => ({
  rank,
  school,
  name,
  rating: 30 - rank / 10,
  mu: 34,
  sigma: 1.4,
});

const NDT: NdtSchoolHistory[] = [
  {
    school: "Harvard University (MA)",
    years: [2012, 2013],
    elims: [{ year: 2012, team: "Stephen Weil & Andrew Halpern", round: "Quarters", record: "6-2", seed: 4 }],
    championships: [],
    atLargeBids: [{ year: 2013, team: "Andrew Halpern & Stephen Weil", rank: 3 }],
    copelandWinners: [],
    speakerAwards: [],
    coachingAwards: [],
  },
];

const sources = (overrides: Partial<PastTeamSources> = {}): PastTeamSources => ({
  collegeHistory: new Map([
    [2012, [row(3, "Harvard", "Halpern & Weil"), row(9, "Georgetown", "Arsht & Markoff")]],
    [2013, [row(1, "Harvard University", "Weil & Halpern")]],
    [2020, [row(5, "Kansas", "Smith & Jones")]],
  ]),
  ndt: NDT,
  cedaTitles: (school) => findCedaSchoolTitles(school, cedaTitlesBySchool()),
  ...overrides,
});

describe("pastTeamHref", () => {
  it("drops the NDT's state tag and uses the team's initials", () => {
    expect(pastTeamHref({ school: "Harvard University (MA)", name: "Stephen Weil & Andrew Halpern" })).toBe(
      "/@harvard-university-wh",
    );
    expect(pastTeamHref({ school: "Harvard", name: "Halpern & Weil" })).toBe("/@harvard-hw");
  });
});

describe("parseTeamHandle", () => {
  it("splits a handle into school words and initials", () => {
    expect(parseTeamHandle("harvard-university-wh")).toEqual({ school: "harvard university", code: "WH" });
    expect(parseTeamHandle("%40harvard-hw")).toEqual({ school: "harvard", code: "HW" });
  });

  it("rejects handles without a two-letter initials segment", () => {
    expect(parseTeamHandle("michigan")).toBeNull();
    expect(parseTeamHandle("boston-college")).toBeNull();
    expect(parseTeamHandle("wh")).toBeNull();
  });
});

describe("findPastTeamProfile", () => {
  it("collects a team's seasons and NDT results across school spellings and name orders", () => {
    const team = findPastTeamProfile(sources(), "harvard-university-wh");
    expect(team).not.toBeNull();
    expect(team!.school).toBe("Harvard University");
    expect(team!.seasons.map((s) => [s.season, s.entry.rank])).toEqual([
      [2013, 1],
      [2012, 3],
    ]);
    expect(team!.ndt.map((r) => [r.year, r.kind])).toEqual([
      [2013, "First-round bid"],
      [2012, "Elims"],
    ]);
    // The latest naming wins; debatedata's table comes first on a tie.
    expect(team!.name).toBe("Weil & Halpern");
  });

  it("finds a team named only in the CEDA champions list", () => {
    const team = findPastTeamProfile(sources({ collegeHistory: new Map(), ndt: null }), "towson-university-lc");
    expect(team?.ceda.map((t) => t.year)).toEqual([2008]);
    expect(team?.school).toBe("Towson University");
  });

  it("resolves a names link and joins the same people's rows from other sources", () => {
    const href = pastTeamNamesHref({ school: "Harvard University (MA)", name: "Stephen Weil & Andrew Halpern" });
    expect(href).toBe("/@harvard-university-stephen-weil-andrew-halpern");
    const team = findPastTeamProfile(sources(), href.slice(2));
    expect(team?.ndt.map((r) => r.year)).toEqual([2013, 2012]);
    expect(team?.seasons.map((s) => s.season)).toEqual([2013, 2012]);
  });

  it("keeps a names link to its own pair when another pair shares the initials", () => {
    const history = new Map([
      [2024, [row(2, "University of Michigan", "Gao & Shih"), row(7, "University of Michigan", "Gies & Sanchez")]],
      [2023, [row(4, "University of Michigan", "Gao & Shih")]],
    ]);
    const s = sources({ collegeHistory: history });
    const team = findPastTeamProfile(s, pastTeamNamesHref({ school: "University of Michigan", name: "Gies & Sanchez" }).slice(2));
    expect(team?.seasons.map((x) => [x.season, x.entry.name])).toEqual([[2024, "Gies & Sanchez"]]);
  });

  it("is null when no source has the school and initials", () => {
    expect(findPastTeamProfile(sources(), "harvard-zz")).toBeNull();
    expect(findPastTeamProfile(sources(), "michigan")).toBeNull();
  });
});

describe("pastTeamVideoSearch", () => {
  it("searches college policy rounds for the school and the initials in either order", () => {
    const search = pastTeamVideoSearch({ school: "Harvard University", code: "WH" });
    expect(search.styles).toEqual([4]);
    expect(search.competitors).toContain("harvard wh");
    expect(search.competitors).toContain("harvard hw");
    expect(search.label).toBe("Harvard University WH");
  });
});
