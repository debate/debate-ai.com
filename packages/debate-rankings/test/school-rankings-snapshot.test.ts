/**
 * @fileoverview The precomputed Schools table: building the snapshot, its
 * change hash, and the browser cache's revalidation against the server.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RankingDataset, RankingEntry } from "@debate-ai/rankings";

const m = vi.hoisted(() => ({ loadRankingDataset: vi.fn() }));
vi.mock("@debate-ai/rankings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@debate-ai/rankings")>()),
  loadRankingDataset: m.loadRankingDataset,
}));

const { currentRankingSeasonYear } = await import("@debate-ai/rankings");
const {
  buildSchoolRankingsSnapshot,
  hashText,
  isSchoolRankingsSnapshot,
  SCHOOL_SCOPES,
} = await import("../src/leaderboard/schoolRankingsSnapshot");
const { fetchSchoolRankingsSnapshot, isStale, refreshSchoolRankings, CURRENT_SEASON_MAX_AGE_MS } = await import(
  "../src/leaderboard/schoolRankingsCache"
);

function entry(name: string, school: string, adjustedRating: number): RankingEntry {
  return {
    rank: 1,
    name,
    school,
    adjustedRating,
    deviation: 40,
    matches: 20,
    rating: adjustedRating + 80,
    hash: name,
    affWinRate: null,
    negWinRate: null,
    affElimWinRate: null,
    negElimWinRate: null,
  } as RankingEntry;
}

function dataset(id: string, entries: RankingEntry[]): RankingDataset {
  return { id, label: id, tournaments: [], majors: [], entries, field: null } as unknown as RankingDataset;
}

const NDT = [
  {
    school: "Northwestern University",
    championships: [{ year: 2019 }, { year: 2020 }],
    elims: [{ year: 2019 }, { year: 2020 }, { year: 2021 }],
  },
] as never;

const DATASETS = {
  VPF: dataset("hspf", [entry("Kim & Lee", "Harker", 90.1234), entry("Ng & Oh", "Harker", 80)]),
  NDT: dataset("cpd", [entry("Smith & Jones", "Northwestern University", 95)]),
};

describe("buildSchoolRankingsSnapshot", () => {
  it("holds every scope's rows, rounded, and the NDT summary of matching schools", () => {
    const snap = buildSchoolRankingsSnapshot(DATASETS, 2026, NDT, new Date("2026-01-01T00:00:00Z"));
    expect(Object.keys(snap.scopes).sort()).toEqual([...SCHOOL_SCOPES].sort());
    expect(snap.scopes.all.map((r) => r.school).sort()).toEqual(["Harker", "Northwestern University"]);
    expect(snap.scopes.VPF.map((r) => r.school)).toEqual(["Harker"]);
    expect(snap.scopes.VLD).toEqual([]);
    expect(snap.scopes.VPF[0]!.bestRating).toBe(90.12);
    expect(snap.ndt["Northwestern University"]).toMatchObject({ ndtTitles: 2, elims: 3 });
    expect(snap.ndt.Harker).toBeUndefined();
    expect(snap.builtAt).toBe("2026-01-01T00:00:00.000Z");
    expect(isSchoolRankingsSnapshot(JSON.parse(JSON.stringify(snap)))).toBe(true);
  });

  it("keeps the hash when only the build time changes, and changes it with the data", () => {
    const a = buildSchoolRankingsSnapshot(DATASETS, 2026, NDT, new Date(1));
    const b = buildSchoolRankingsSnapshot(DATASETS, 2026, NDT, new Date(2));
    const c = buildSchoolRankingsSnapshot({ ...DATASETS, VLD: dataset("hsld", [entry("A", "Harker", 70)]) }, 2026, NDT);
    expect(a.hash).toBe(b.hash);
    expect(c.hash).not.toBe(a.hash);
    expect(hashText("abc")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("rejects other shapes", () => {
    expect(isSchoolRankingsSnapshot(null)).toBe(false);
    expect(isSchoolRankingsSnapshot({ version: 0, seasonYear: 2026, hash: "x", scopes: { all: [] }, ndt: {} })).toBe(false);
  });
});

describe("school rankings browser cache", () => {
  const season = currentRankingSeasonYear();
  const known = buildSchoolRankingsSnapshot(DATASETS, season, NDT);
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    m.loadRankingDataset.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is stale after a day for the current season and a week for past ones", () => {
    expect(isStale(season, 0, CURRENT_SEASON_MAX_AGE_MS - 1)).toBe(false);
    expect(isStale(season, 0, CURRENT_SEASON_MAX_AGE_MS)).toBe(true);
    expect(isStale(2020, 0, CURRENT_SEASON_MAX_AGE_MS * 2)).toBe(false);
  });

  it("sends its hash and keeps its copy when the server says unchanged", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ unchanged: true, hash: known.hash })));
    expect(await refreshSchoolRankings(season, known)).toBe(known);
    expect(String(fetchMock.mock.calls[0]![0])).toContain(`hash=${known.hash}`);
    expect(m.loadRankingDataset).not.toHaveBeenCalled();
  });

  it("takes the server's snapshot when it changed", async () => {
    const next = buildSchoolRankingsSnapshot(DATASETS, season, null);
    fetchMock.mockResolvedValue(new Response(JSON.stringify(next)));
    expect((await refreshSchoolRankings(season, known)).hash).toBe(next.hash);
  });

  it("keeps a stored copy rather than computing when the server is down", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await refreshSchoolRankings(season, known)).toBe(known);
    expect(m.loadRankingDataset).not.toHaveBeenCalled();
  });

  it("computes in the browser when the server is down and nothing is stored", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 502 }));
    m.loadRankingDataset.mockImplementation(async (id: string) => dataset(id, [entry("X", `School ${id}`, 80)]));
    const snap = await refreshSchoolRankings(season);
    expect(snap.scopes.all).toHaveLength(4);
  });

  it("ignores a snapshot for another season", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...known, seasonYear: 2001 })));
    expect(await fetchSchoolRankingsSnapshot(season)).toBeNull();
  });
});
