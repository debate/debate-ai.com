import { describe, expect, it } from "vitest";
import {
  debaterLastNames,
  debaterNameKey,
  loadRankingDataset,
  matchTournamentEntry,
  rankingDatasetsForEvent,
  type RankingEntry,
} from "../src/index";

function entry(overrides: Partial<RankingEntry>): RankingEntry {
  return { rank: 1, school: "", name: "", rating: 1500, ...overrides } as RankingEntry;
}

describe("rankingDatasetsForEvent", () => {
  it("maps an event to the rankings of its format", () => {
    expect(rankingDatasetsForEvent({ name: "Varsity Public Forum", abbr: "VPF" })).toEqual(["hspf"]);
    expect(rankingDatasetsForEvent({ name: "Lincoln Douglas", abbr: "LD" })).toEqual(["hsld"]);
    expect(rankingDatasetsForEvent({ name: "Open", abbr: "JVLD" })).toEqual(["hsld"]);
    expect(rankingDatasetsForEvent({ name: "Open", abbr: "CX-O" })).toEqual(["hscx", "cpd"]);
    expect(rankingDatasetsForEvent({ name: "Open Policy (NDT/CEDA)", abbr: "OPEN" })).toEqual(["cpd"]);
    expect(rankingDatasetsForEvent({ name: "High School Policy", abbr: "HSCX" })).toEqual(["hscx"]);
  });

  it("finds nothing for formats the rankings don't cover", () => {
    expect(rankingDatasetsForEvent({ name: "Congress", abbr: "CON", type: "congress" })).toEqual([]);
    expect(rankingDatasetsForEvent({ name: "Parliamentary", abbr: "PARLI" })).toEqual([]);
    expect(rankingDatasetsForEvent({ name: "Public Forum", abbr: "PF", type: "speech" })).toEqual([]);
  });
});

describe("debater names", () => {
  it("keys a team by sorted last names and one debater by full name", () => {
    expect(debaterNameKey("Le & Luo")).toBe(debaterNameKey("Alex Luo & Ben Le"));
    expect(debaterNameKey("Siddhartha Daswani")).toBe("siddhartha daswani");
  });

  it("shortens to last names", () => {
    expect(debaterLastNames("Falk & Sabnani")).toBe("Falk & Sabnani");
    expect(debaterLastNames("Siddhartha Daswani")).toBe("Daswani");
  });
});

describe("matchTournamentEntry", () => {
  const rows = [
    entry({ rank: 1, school: "Harker", name: "Le & Luo" }),
    entry({ rank: 2, school: "College Prep", name: "Falk & Sabnani" }),
    entry({ rank: 3, school: "Harker", name: "Lin & Lam" }),
    entry({ rank: 4, school: "Strake Jesuit College Prep", name: "Fu & Shah" }),
  ];

  it("matches by the debaters' names, narrowed by school", () => {
    expect(matchTournamentEntry(rows, { name: "Luo & Le", school: "Harker School" })?.rank).toBe(1);
    expect(matchTournamentEntry(rows, { name: "Le & Luo", school: "Greenhill" })).toBeNull();
  });

  it("matches a code by school and initials", () => {
    expect(matchTournamentEntry(rows, { code: "College Prep FS" })?.rank).toBe(2);
    expect(matchTournamentEntry(rows, { code: "Strake Jesuit SF" })?.rank).toBe(4);
  });

  it("leaves an ambiguous code unmatched", () => {
    // Both Harker teams have the initials LL.
    expect(matchTournamentEntry(rows, { code: "Harker LL" })).toBeNull();
    expect(matchTournamentEntry(rows, { code: "Harker LL", name: "Lin & Lam" })?.rank).toBe(3);
  });

  it("returns nothing for a code with no initials", () => {
    expect(matchTournamentEntry(rows, { code: "1001" })).toBeNull();
  });

  it("finds a real team in the current PF rankings", async () => {
    const dataset = await loadRankingDataset("hspf");
    const top = dataset.entries[0];
    expect(matchTournamentEntry(dataset.entries, { name: top.name, school: top.school })?.hash).toBe(top.hash);
  });
});
