/**
 * @fileoverview The Extinction.GG loader: joining ratings and bids, parsing
 * team codes, the site scale, merging the CSVs' aff/neg win rates into the
 * current season, and falling back to the CSVs when the API is down.
 * `fetch` is stubbed; nothing here touches the network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RATING_MAX,
  clearExtinctionCache,
  currentRankingSeasonYear,
  extinctionEntries,
  extinctionFileName,
  extinctionFileUrl,
  extinctionSeasonCode,
  getDebateData,
  hasExtinctionSeason,
  loadCsvRankingDataset,
  loadRankingDataset,
  mergeSideWinRates,
  parseSchoolTeamCode,
  toSiteRating,
  EXTINCTION_ELO_SHIFT,
  type RankingEntry,
} from "../src/index";

const ATTRIBUTION = "Data from Extinction.GG (https://extinction.gg).";

const HSPOLICY_TEAMS = [
  { FullName1: "Darwin Boss", FullName2: "Samar Mohan", OverallELO: "1987", SchoolTeamCode: "Whitney Young BM: Boss & Mohan" },
  { FullName1: "Landon Adams", FullName2: "Joshua Chen", OverallELO: "891", SchoolTeamCode: "St Ignatius AC: Adams & Chen" },
  { FullName1: "Raj Reddy", FullName2: "Dylan Shah", OverallELO: "2019", SchoolTeamCode: "Greenhill RS: Reddy & Shah" },
];

const HSPOLICY_BIDS = {
  generated: "2026-11-02",
  tournaments: [
    { code: "Greenhill", name: "Greenhill Fall Classic", date: "2026-09-19", bid: "Octos", tabroomId: "1", bids: 16, source: "tabroom" },
  ],
  pending: [],
  teams: [
    { team: "Whitney Young BM: Boss & Mohan", bids: ["Greenhill", "UMich"] },
    { team: "whitney  young BM: Boss & Mohan", bids: ["UMich"] },
    { team: "Nowhere ZZ: Zed & Zee", bids: ["Greenhill"] },
  ],
};

type Routes = Record<string, unknown>;

function stubFetch(routes: Routes) {
  const fetchMock = vi.fn(async (url: string) => {
    const name = url.replace("https://extinction.gg/live/", "");
    if (!(name in routes)) return new Response("Forbidden", { status: 403, statusText: "Forbidden" });
    const body = routes[name];
    if (body instanceof Error) throw body;
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => clearExtinctionCache());
afterEach(() => vi.unstubAllGlobals());

describe("file names and seasons", () => {
  it("builds the live file name, with CollegePolicy casing", () => {
    expect(extinctionFileName("hspolicy", "26-27")).toBe("HSPolicy2627.json");
    expect(extinctionFileName("collegepolicy", "15-16")).toBe("CollegePolicy1516.json");
    expect(extinctionSeasonCode(2016)).toBe("15-16");
    expect(extinctionSeasonCode(2027)).toBe("26-27");
  });

  it("rejects bad seasons and formats", () => {
    expect(() => extinctionFileName("hspolicy", "2026-27")).toThrow(/YY-YY/);
    expect(() => extinctionFileName("hspolicy", "14-15")).toThrow(/consecutive/);
    expect(() => extinctionFileName("hspolicy", "20-22")).toThrow(/consecutive/);
    expect(() => extinctionFileName("bp" as never, "20-21")).toThrow(/Unsupported/);
  });

  it("covers the four full-season datasets from 2015-16 to now", () => {
    const now = currentRankingSeasonYear();
    expect(hasExtinctionSeason("hscx", 2016)).toBe(true);
    expect(hasExtinctionSeason("cpd", now)).toBe(true);
    expect(hasExtinctionSeason("hspf", 2015)).toBe(false);
    expect(hasExtinctionSeason("hspf", now + 1)).toBe(false);
    expect(hasExtinctionSeason("hsld_sepoct", now)).toBe(false);
  });
});

describe("extinctionFileUrl", () => {
  it("fetches Extinction.GG directly on the server", () => {
    expect(extinctionFileUrl("teams", "HSPolicy2526.json")).toBe("https://extinction.gg/live/teams/HSPolicy2526.json");
  });

  it("goes through the same-origin proxy in a browser, since Extinction.GG sends no CORS headers", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {});
    expect(extinctionFileUrl("bids", "HSPolicy2526.json")).toBe("/api/extinction/bids/HSPolicy2526.json");
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({ attribution: "x", teams: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await getDebateData("hspolicy", "25-26");
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "/api/extinction/teams/HSPolicy2526.json",
      "/api/extinction/bids/HSPolicy2526.json",
    ]);
  });
});

describe("parseSchoolTeamCode", () => {
  it("splits school, initials and names", () => {
    expect(parseSchoolTeamCode("Whitney Young BM: Boss & Mohan")).toEqual({ school: "Whitney Young", code: "BM", names: "Boss & Mohan" });
    expect(parseSchoolTeamCode("New Tech HS @ B.F. Darrell AA: Arias & Arias").school).toBe("New Tech HS @ B.F. Darrell");
    expect(parseSchoolTeamCode("TH PĐ: Phạm & Đào")).toEqual({ school: "TH", code: "PĐ", names: "Phạm & Đào" });
    expect(parseSchoolTeamCode("Edgemont SS: Singh")).toEqual({ school: "Edgemont", code: "SS", names: "Singh" });
    expect(parseSchoolTeamCode("Loner")).toEqual({ school: "Loner", code: "", names: "" });
  });
});

describe("getDebateData", () => {
  it("joins ratings (a JSON string) and bids on SchoolTeamCode", async () => {
    stubFetch({
      "teams/HSPolicy2627.json": { attribution: ATTRIBUTION, teams: JSON.stringify(HSPOLICY_TEAMS) },
      "bids/HSPolicy2627.json": HSPOLICY_BIDS,
    });
    const data = await getDebateData("hspolicy", "26-27");
    expect(data.attribution).toBe(ATTRIBUTION);
    expect(data.generated).toBe("2026-11-02");
    expect(data.teams[0]).toEqual({
      SchoolTeamCode: "Whitney Young BM: Boss & Mohan",
      FullName1: "Darwin Boss",
      FullName2: "Samar Mohan",
      OverallELO: 1987,
      tocBidCount: 2,
      tocBidTournamentCodes: ["Greenhill", "UMich"],
    });
    // Bid-only teams are kept, with null names and Elo.
    const bidOnly = data.teams.find((t) => t.SchoolTeamCode === "Nowhere ZZ: Zed & Zee");
    expect(bidOnly).toMatchObject({ FullName1: null, OverallELO: null, tocBidCount: 1 });
    expect(data.teams.find((t) => t.SchoolTeamCode.startsWith("St Ignatius"))?.tocBidCount).toBe(0);
  });

  it("treats College Policy as having no bids file", async () => {
    const fetchMock = stubFetch({
      "teams/CollegePolicy2526.json": { attribution: ATTRIBUTION, teams: HSPOLICY_TEAMS },
    });
    const data = await getDebateData("collegepolicy", "25-26");
    expect(data.teams).toHaveLength(3);
    expect(data.tournaments).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails when the ratings file is missing", async () => {
    stubFetch({});
    await expect(getDebateData("hspf", "20-21")).rejects.toThrow(/403/);
  });
});

describe("extinctionEntries", () => {
  it("ranks by Elo, names teams by surname pair (LD by full name) and keeps bids", async () => {
    stubFetch({
      "teams/HSPolicy2627.json": { attribution: ATTRIBUTION, teams: JSON.stringify(HSPOLICY_TEAMS) },
      "bids/HSPolicy2627.json": HSPOLICY_BIDS,
    });
    const entries = extinctionEntries(await getDebateData("hspolicy", "26-27"));
    expect(entries.map((e) => [e.rank, e.school, e.name])).toEqual([
      [1, "Greenhill", "Reddy & Shah"],
      [2, "Whitney Young", "Boss & Mohan"],
      [3, "St Ignatius", "Adams & Chen"],
      [4, "Nowhere", "Zed & Zee"],
    ]);
    expect(entries[1]).toMatchObject({ rating: 1987 - EXTINCTION_ELO_SHIFT, teamCode: "BM", tocBids: ["Greenhill", "UMich"] });
    expect(new Set(entries.map((e) => e.hash)).size).toBe(4);

    stubFetch({
      "teams/HSLD2627.json": { attribution: ATTRIBUTION, teams: [{ FullName1: "Samrajya Singh", FullName2: "", OverallELO: "1900", SchoolTeamCode: "Edgemont SS: Singh" }] },
    });
    const [ld] = extinctionEntries(await getDebateData("hsld", "26-27"));
    expect(ld).toMatchObject({ school: "Edgemont", name: "Samrajya Singh", debaters: ["Samrajya Singh"] });
  });

  it("puts the best team of a strong season at the cap (10.9)", () => {
    expect(toSiteRating(2303 - EXTINCTION_ELO_SHIFT)).toBe(RATING_MAX);
    expect(toSiteRating(2200 - EXTINCTION_ELO_SHIFT)).toBeGreaterThan(85);
  });
});

describe("mergeSideWinRates", () => {
  const csv = (school: string, name: string, aff: number): RankingEntry => ({
    rank: 1, school, name, adjustedRating: 1, deviation: 1, matches: 12, rating: 1, hash: "h",
    affWinRate: aff, negWinRate: 50, affElimWinRate: null, negElimWinRate: 40,
  });
  const ext = (school: string, name: string): RankingEntry => ({
    rank: 1, school, name, adjustedRating: 9, deviation: 0, matches: 0, rating: 9, hash: "x",
    affWinRate: null, negWinRate: null, affElimWinRate: null, negElimWinRate: null,
  });

  it("copies rates onto the same pair at a like school, keeping the Elo", () => {
    const [merged, other] = mergeSideWinRates(
      [ext("Whitney Young", "Boss & Mohan"), ext("Harker", "Kim & Lee")],
      [csv("Whitney Young Magnet", "Mohan & Boss", 80), csv("Other", "Kim & Park", 10)],
    );
    expect(merged).toMatchObject({ rating: 9, matches: 12, affWinRate: 80, negElimWinRate: 40 });
    expect(other.affWinRate).toBeNull();
  });

  it("matches a lone pair across school spellings, but not an ambiguous one", () => {
    expect(mergeSideWinRates([ext("Cuttlefish Independent", "A & B")], [csv("Interlake", "A & B", 70)])[0].affWinRate).toBe(70);
    expect(
      mergeSideWinRates([ext("Zed", "A & B")], [csv("Interlake", "A & B", 70), csv("Lakeside", "A & B", 60)])[0].affWinRate,
    ).toBeNull();
  });
});

describe("loadRankingDataset", () => {
  it("loads a past season from Extinction.GG alone", async () => {
    stubFetch({
      "teams/HSPolicy1920.json": { attribution: ATTRIBUTION, teams: JSON.stringify(HSPOLICY_TEAMS) },
      "bids/HSPolicy1920.json": { ...HSPOLICY_BIDS, generated: "2020-04-01" },
    });
    const dataset = await loadRankingDataset("hscx", 2020);
    expect(dataset).toMatchObject({ id: "hscx", source: "extinction", seasonYear: 2020, field: null });
    expect(dataset).not.toHaveProperty("attribution");
    expect(dataset.entries[0]).toMatchObject({ rank: 1, school: "Greenhill", rating: toSiteRating(2019 - EXTINCTION_ELO_SHIFT) });
    expect(dataset.bidTournaments?.[0].name).toBe("Greenhill Fall Classic");
  });

  it("merges the CSVs' win rates and side bias into the current season", async () => {
    const csv = await loadCsvRankingDataset("hscx");
    const top = csv.entries[0];
    const teams = [{ FullName1: "A", FullName2: "B", OverallELO: "1950", SchoolTeamCode: `${top.school} XX: ${top.name}` }];
    stubFetch({ [`teams/HSPolicy${extinctionSeasonCode(currentRankingSeasonYear()).replace("-", "")}.json`]: { attribution: ATTRIBUTION, teams } });
    const dataset = await loadRankingDataset("hscx");
    expect(dataset.source).toBe("extinction");
    expect(dataset.field).toEqual(csv.field);
    expect(dataset.entries[0]).toMatchObject({ name: top.name, affWinRate: top.affWinRate, matches: top.matches, rating: toSiteRating(1950 - EXTINCTION_ELO_SHIFT) });
  });

  it("falls back to the CSVs for the current season when Extinction.GG is down", async () => {
    stubFetch({});
    const dataset = await loadRankingDataset("hspf");
    expect(dataset.source).toBe("csv");
    expect(dataset.entries.length).toBeGreaterThan(0);
  });

  it("serves LD's Sep–Oct slice from the CSVs, and refuses seasons nobody has", async () => {
    const fetchMock = stubFetch({});
    expect((await loadRankingDataset("hsld_sepoct")).source).toBe("csv");
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(loadRankingDataset("hspf", 2010)).rejects.toThrow(/No HS Public Forum rankings/);
    await expect(loadRankingDataset("hspf", 2020)).rejects.toThrow(/403/);
  });
});
